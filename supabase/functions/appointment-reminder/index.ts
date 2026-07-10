// V1 AI Skill #5 — Appointment Reminder (Cron + Push)
// Called by Supabase cron every 15 minutes.
// Sends 48h and 2h reminders for upcoming appointments via OneSignal push.
// POST /functions/v1/appointment-reminder  (triggered by pg_cron)
//
// SMS RETIRED 2026-07-09: reminders are push-only. US carriers were silently
// dropping our Twilio texts (A2P 10DLC unregistered) while still billing for them,
// so the SMS leg was removed rather than pay for undelivered messages. users.phone +
// the twilio-sms function remain for future re-enable (toll-free); the column
// appointments.twilio_reminder_sent is now just the "reminder dispatched" flag.

import { createClient } from 'npm:@supabase/supabase-js';
import { isQuietHoursActive } from '../_shared/quiet-hours.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  try {
    const now = new Date();

    // Find appointments needing 48h reminder (47.5–48.5h window)
    const window48hStart = new Date(now.getTime() + 47.5 * 60 * 60 * 1000).toISOString();
    const window48hEnd = new Date(now.getTime() + 48.5 * 60 * 60 * 1000).toISOString();

    // Find appointments needing 2h reminder (1.75–2.25h window)
    const window2hStart = new Date(now.getTime() + 1.75 * 60 * 60 * 1000).toISOString();
    const window2hEnd = new Date(now.getTime() + 2.25 * 60 * 60 * 1000).toISOString();

    const [{ data: remind48 }, { data: remind2 }] = await Promise.all([
      supabase
        .from('appointments')
        .select(`
          id, appointment_at, is_telehealth, user_id,
          users(phone, preferred_language, full_name, notif_prefs),
          specialists(full_name, specialty)
        `)
        .in('status', ['confirmed'])
        .eq('twilio_reminder_sent', false)
        .gte('appointment_at', window48hStart)
        .lte('appointment_at', window48hEnd),
      supabase
        .from('appointments')
        .select(`
          id, appointment_at, is_telehealth, user_id,
          users(phone, preferred_language, full_name, notif_prefs),
          specialists(full_name, specialty)
        `)
        .in('status', ['confirmed'])
        .gte('appointment_at', window2hStart)
        .lte('appointment_at', window2hEnd),
    ]);

    const sent: string[] = [];
    const errors: string[] = [];

    const sendReminder = async (appt: any, hoursUntil: number) => {
      const userId: string = appt.user_id;

      // A2.b: respect the user's appointments/specialists notif pref. Default
      // is opt-in (true) so legacy rows without notif_prefs still get reminders.
      // Marking the row as "sent" even when suppressed prevents a re-attempt
      // every 15 minutes once the user toggles the pref back on — that's
      // acceptable because a skipped appointment reminder doesn't create risk.
      const prefs = appt.users?.notif_prefs ?? {};
      if (prefs.specialists === false) {
        await supabase
          .from('appointments')
          .update({ twilio_reminder_sent: true })
          .eq('id', appt.id);
        return;
      }

      // Quiet hours: cooperative suppression — do NOT mark as sent. The next
      // cron tick (15 min later) will re-check; if we've exited quiet hours
      // we catch the reminder within the same window. If the entire window
      // is quiet, the 48h reminder is legitimately skipped (we still fire
      // the 2h reminder separately; that row is not gated on twilio_reminder_sent).
      if (isQuietHoursActive(prefs)) {
        return;
      }

      try {
        const lang = appt.users?.preferred_language === 'es' ? 'es' : 'en';
        const provider = appt.specialists?.full_name ?? (lang === 'es' ? 'tu proveedor' : 'your provider');
        const timeStr = new Date(appt.appointment_at).toLocaleTimeString(lang === 'es' ? 'es-US' : 'en-US', {
          hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
        });
        const pushTitle = hoursUntil === 48
          ? (lang === 'es' ? 'Cita mañana' : 'Appointment tomorrow')
          : (lang === 'es' ? 'Cita en 2 horas' : 'Appointment in 2 hours');
        const pushBody = `${provider} · ${timeStr}`;

        // Push-only reminder (SMS retired — see header). The specialists pref +
        // quiet hours were already checked above, so just fire the push.
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/push-notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            user_id: userId,
            title: pushTitle,
            body: pushBody,
            data: { screen: 'appointments', appointment_id: appt.id },
          }),
        });

        // Mark the reminder dispatched so the 48h row doesn't re-fire every cron
        // tick. A reminder is a nudge, not safety-critical — mark it sent even if
        // push delivery fails, to avoid an infinite 15-min retry loop.
        await supabase
          .from('appointments')
          .update({ twilio_reminder_sent: true })
          .eq('id', appt.id);
        sent.push(appt.id);
      } catch (e) {
        errors.push(`${appt.id}: ${String(e)}`);
      }
    };

    // Process all reminders concurrently (capped at reasonable batch)
    await Promise.allSettled([
      ...(remind48 ?? []).map((a: any) => sendReminder(a, 48)),
      ...(remind2 ?? []).map((a: any) => sendReminder(a, 2)),
    ]);

    return new Response(
      JSON.stringify({ sent: sent.length, errors: errors.length, errorDetails: errors }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
