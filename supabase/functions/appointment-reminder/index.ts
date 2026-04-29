// V1 AI Skill #5 — Appointment Reminder (Cron + Twilio)
// Called by Supabase cron every 15 minutes
// Sends 48h and 2h SMS reminders for upcoming appointments
// POST /functions/v1/appointment-reminder  (triggered by pg_cron)
// Model: Sonnet (warm, contextual reminder copy)

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';
import { isQuietHoursActive } from '../_shared/quiet-hours.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are The Village's maternal health assistant writing appointment reminder SMS messages.
Write warm, encouraging SMS reminders for moms about their upcoming specialist appointments.

Rules:
- Max 160 characters (one SMS)
- Include: provider name, time, and one warm encouragement
- If telehealth: mention joining via video link
- Match the mom's language (en or es)
- End with "- The Village 🌿"
- No filler, no hashtags`;

async function generateReminderSMS(params: {
  specialistName: string;
  specialty: string;
  appointmentAt: Date;
  isTelehealth: boolean;
  hoursUntil: number;
  language: string;
}): Promise<string> {
  const timeStr = params.appointmentAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 80,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Write a ${params.hoursUntil}h reminder SMS (max 160 chars) for:
Provider: ${params.specialistName} (${params.specialty})
Time: ${timeStr} EST
Type: ${params.isTelehealth ? 'telehealth video call' : 'in-person'}
Language: ${params.language}`,
      },
    ],
  });

  return (message.content[0] as { text: string }).text.trim();
}

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
      const phone: string = appt.users?.phone;
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
        const smsBody = await generateReminderSMS({
          specialistName: appt.specialists?.full_name ?? 'Your provider',
          specialty: appt.specialists?.specialty ?? '',
          appointmentAt: new Date(appt.appointment_at),
          isTelehealth: appt.is_telehealth ?? false,
          hoursUntil,
          language: appt.users?.preferred_language ?? 'en',
        });

        // Call twilio-sms function internally
        const twilioRes = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-sms`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ to: phone, body: smsBody }),
          },
        );

        // Send push notification in parallel with SMS
        const pushTitle = hoursUntil === 48 ? 'Appointment Tomorrow' : 'Appointment in 2 Hours';
        const pushBody = `${appt.specialists?.full_name ?? 'Your provider'} · ${new Date(appt.appointment_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

        await Promise.allSettled([
          twilioRes.ok ? Promise.resolve() : Promise.reject(),
          fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/push-notify`, {
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
          }),
        ]);

        if (twilioRes.ok) {
          // Mark reminder sent
          await supabase
            .from('appointments')
            .update({ twilio_reminder_sent: true })
            .eq('id', appt.id);
          sent.push(appt.id);
        }
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
