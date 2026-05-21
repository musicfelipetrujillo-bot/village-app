// V4 · Villie weekly user newsletter — Sunday morning digest
//
// User-facing email. NOT to be confused with gear-moderation-daily-digest
// (that one only goes to the moderator inbox). This one fans out a
// personalized digest to every user with `notif_prefs.newsletter = true`,
// each Sunday around 09:00 ET.
//
// Per-recipient content (built via get_newsletter_content_for_user):
//   - greeting + week badge (Week N postpartum, baby_name when set)
//   - top Manual video for the user's current week (prefers unwatched)
//   - "still on your list" reminder when the user has saved videos
//   - crisis-resources footer (988, Crisis Text Line, PSI)
//
// Trade-offs in V1:
//   - Events + perks blocks are NOT in V1 — they need PostGIS distance
//     queries that don't compose cleanly into one RPC. Follow-up phase.
//   - We don't render per-locale subject lines in V1 (subject is EN; body
//     respects the user's preferred_language). Subject locale-aware
//     formatting + ICU pluralization lands in a follow-up.
//   - Resend open/click tracking webhook handler is not wired yet. The
//     newsletter_sends table reserves `opened_at` / `first_click_at` /
//     `click_count` for when it ships.
//
// Triggered:
//   - Weekly by .github/workflows/supabase-crons.yml — Sunday 13:00 UTC
//   - Manually via authenticated POST for testing
//
// Auth: service-role bearer (JWT-decoded for role check; see
// gear-moderation-pager comment block).
//
// Env vars:
//   RESEND_API_KEY                     — Resend API key
//   VILLIE_NEWSLETTER_FROM             — "from" address on a verified
//                                        Resend domain. Default:
//                                        Villie <hello@villieapp.com>
//   VILLIE_NEWSLETTER_REPLY_TO         — optional reply-to (so users
//                                        actually have somewhere to write)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — injected
//
// Failure modes:
//   - RESEND_API_KEY missing → 200 with reason='not_configured' so the
//     cron doesn't redline while Resend is still being set up.
//   - Empty recipient list → 200 with reason='no_recipients'.
//   - Per-user send errors are caught + logged; the batch continues.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_ADDRESS = Deno.env.get('VILLIE_NEWSLETTER_FROM')
  ?? 'Villie <hello@villieapp.com>';
const REPLY_TO = Deno.env.get('VILLIE_NEWSLETTER_REPLY_TO') ?? '';

// JWT-decode based auth (same pattern as the other ops fns).
function isServiceRoleRequest(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const token = match[1].trim();
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return false;
    const normalized = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const payload = JSON.parse(atob(padded));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

// Sunday-anchored week start in UTC. We anchor to UTC because the cron is
// UTC and we want all recipients in a given Sunday-13:00 UTC firing to
// share the same period_start regardless of local timezone.
function sundayOfThisWeekUTC(d = new Date()): string {
  const day = d.getUTCDay(); // 0 = Sun
  const sunday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return sunday.toISOString().slice(0, 10); // YYYY-MM-DD
}

interface Recipient {
  user_id: string;
  email: string;
  full_name: string | null;
  preferred_language: 'en' | 'es';
  pregnancy_stage: string | null;
  current_week: number | null;
  baby_first_name: string | null;
  zip_code: string | null;
}

interface ContentSnapshot {
  locale: 'en' | 'es';
  current_week: number;
  stage: string | null;
  top_video: {
    id: string; audience: string; category: string;
    title: string; description: string;
    duration_seconds: number; thumbnail_url: string | null;
  } | null;
  saved_count: number;
  saved_top_3: Array<{
    id: string; title: string;
    thumbnail_url: string | null; duration_seconds: number;
  }>;
}

// ─── Copy. EN + ES, kept inline since the dictionary is tiny and the
//     mobile i18n JSON doesn't ship to edge functions. Match clinician-
//     handoff tone per project_hospital_discharge_distribution memory.
const COPY = {
  en: {
    greeting: (name: string | null) => name ? `Hi ${name.split(' ')[0]},` : 'Hi,',
    weekBadge: (w: number) => w > 0 ? `Week ${w} postpartum` : '',
    intro: 'Your villie roundup for the week — short, postpartum-tested, useful.',
    topVideoEyebrow: 'TODAY\'S TIP · 2 MINUTES',
    topVideoLead: 'Watch this if you have a minute today:',
    topVideoCta: 'Watch in villie',
    savedHeader: (n: number) => n === 1 ? '1 video still on your list' : `${n} videos still on your list`,
    savedLead: 'You saved these for later — here are the most recent:',
    savedCta: 'See all saved',
    crisisHeader: 'If you need someone tonight',
    crisisLines: [
      '988 — Suicide & Crisis Lifeline (call or text)',
      'Text HOME to 741741 — Crisis Text Line',
      '1-800-944-4773 — Postpartum Support International',
    ],
    footerSettings: 'Manage email preferences',
    footerUnsub: 'Unsubscribe',
    footerHouse: 'villie · A village for every mom · villieapp.com',
  },
  es: {
    greeting: (name: string | null) => name ? `Hola ${name.split(' ')[0]},` : 'Hola,',
    weekBadge: (w: number) => w > 0 ? `Semana ${w} postparto` : '',
    intro: 'Tu resumen semanal de villie — corto, probado en postparto, útil.',
    topVideoEyebrow: 'EL CONSEJO DE HOY · 2 MINUTOS',
    topVideoLead: 'Mira esto si tienes un minuto hoy:',
    topVideoCta: 'Ver en villie',
    savedHeader: (n: number) => n === 1 ? '1 video aún en tu lista' : `${n} videos aún en tu lista`,
    savedLead: 'Guardaste estos para después — los más recientes:',
    savedCta: 'Ver todos los guardados',
    crisisHeader: 'Si necesitas a alguien esta noche',
    crisisLines: [
      '988 — Línea de Crisis y Suicidio (llamada o texto)',
      'Envía AYUDA al 741741 — Crisis Text Line',
      '1-800-944-4773 — Postpartum Support International',
    ],
    footerSettings: 'Administrar preferencias de correo',
    footerUnsub: 'Cancelar suscripción',
    footerHouse: 'villie · Una aldea para cada mamá · villieapp.com',
  },
} as const;

// Format duration "M:SS" — same shape as in-app + landing page.
function fmtDuration(s: number): string {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// Cheap HTML-escape so titles with quotes/ampersands don't bust the email
// in clients that don't tolerate stray entities. Subject + plain text use
// raw strings.
function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Build the per-recipient email body. Returns { subject, html, text }.
// The subject is intentionally short (postpartum eyes) and the preheader
// (first ~80 chars of the email) carries the tip headline.
function buildEmail(args: {
  recipient: Recipient;
  content: ContentSnapshot;
}): { subject: string; html: string; text: string } {
  const { recipient, content } = args;
  const c = COPY[content.locale ?? 'en'];
  const v = content.top_video;
  const baby = recipient.baby_first_name;

  // Subject: lead with the video title when present (drives opens better
  // than a generic "your weekly villie"); fall back when no video matched.
  const subject = v
    ? `${v.title} · villie`
    : (content.locale === 'es' ? 'Tu resumen semanal de villie' : 'Your weekly villie');

  const greetingLine = baby
    ? c.greeting(recipient.full_name).replace(',', ` · ${esc(baby)},`)
    : c.greeting(recipient.full_name);
  const weekBadge = c.weekBadge(content.current_week);

  // Per-link tracking via UTM. open_email/click_video etc. lets the
  // marketing dashboard answer "which subject lines / which videos drove
  // the open → click ratio" once Resend webhooks are wired.
  const baseUtm = `utm_source=villie&utm_medium=email&utm_campaign=weekly_${args.recipient.user_id.slice(0, 8)}`;
  const videoUrl = v ? `https://villieapp.com/m/?v=${v.id}&${baseUtm}&utm_content=top_video` : '';
  const appUrl   = `https://villieapp.com?${baseUtm}&utm_content=app`;
  const savedUrl = `https://villieapp.com?${baseUtm}&utm_content=saved`;
  const settingsUrl = `https://villieapp.com?${baseUtm}&utm_content=settings`;
  const unsubUrl    = `https://villieapp.com?${baseUtm}&utm_content=unsub`;

  // ─── HTML email ───
  // Inline styles (no <style> block) so every major client renders OK.
  // Brand tokens cribbed from project_brand_kit_v2 (cream, cocoa, cinnamon).
  // 580px max width matches the landing page so a tap-through feels seamless.
  const cream = '#F4ECD8';
  const cocoa = '#3D1F0E';
  const walnut = '#7A4A28';
  const amber = '#A77349';
  const cinnamon = '#C07840';
  const cinnamonDk = '#9F5F30';
  const paper = '#FDFBF6';
  const border = '#E5DBC4';

  const topVideoBlock = v ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 28px;">
      <tr><td>
        <p style="margin: 0 0 6px; font: 600 11px/1.4 'JetBrains Mono', monospace; color: ${amber}; letter-spacing: 0.22em; text-transform: uppercase;">${c.topVideoEyebrow}</p>
        <p style="margin: 0 0 12px; font: 400 14px/1.55 'Plus Jakarta Sans', Arial, sans-serif; color: ${walnut};">${c.topVideoLead}</p>
        ${v.thumbnail_url ? `
          <a href="${videoUrl}" style="display: block; text-decoration: none;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius: 14px; overflow: hidden; background: #1a1a1a;">
              <tr><td>
                <img src="${esc(v.thumbnail_url)}" alt="${esc(v.title)}" width="580" style="display: block; width: 100%; height: auto; border-radius: 14px;" />
              </td></tr>
            </table>
          </a>` : ''}
        <h2 style="margin: 14px 0 6px; font: 700 22px/1.2 'Playfair Display', Georgia, serif; color: ${cocoa};">${esc(v.title)}</h2>
        <p style="margin: 0 0 6px; font: 600 12px/1.4 'JetBrains Mono', monospace; color: ${amber}; letter-spacing: 0.06em;">${fmtDuration(v.duration_seconds)}</p>
        <p style="margin: 0 0 16px; font: 400 14px/1.6 'Plus Jakarta Sans', Arial, sans-serif; color: ${walnut};">${esc(v.description)}</p>
        <a href="${videoUrl}" style="display: inline-block; padding: 13px 24px; background: ${cinnamon}; color: ${paper}; font: 600 14px/1 'Plus Jakarta Sans', Arial, sans-serif; text-decoration: none; border-radius: 999px;">${c.topVideoCta}</a>
      </td></tr>
    </table>` : '';

  const savedBlock = content.saved_count > 0 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 28px; padding: 22px; background: ${paper}; border: 1px solid ${border}; border-radius: 14px;">
      <tr><td>
        <p style="margin: 0 0 6px; font: 700 15px/1.3 'Playfair Display', Georgia, serif; color: ${cocoa};">${c.savedHeader(content.saved_count)}</p>
        <p style="margin: 0 0 14px; font: 400 13px/1.6 'Plus Jakarta Sans', Arial, sans-serif; color: ${walnut};">${c.savedLead}</p>
        ${(content.saved_top_3 || []).slice(0, 3).map((s) => `
          <p style="margin: 6px 0; font: 500 13px/1.4 'Plus Jakarta Sans', Arial, sans-serif; color: ${cocoa};">
            <a href="https://villieapp.com/m/?v=${s.id}&${baseUtm}&utm_content=saved_${esc(s.id).slice(0, 8)}" style="color: ${cocoa}; text-decoration: none;">
              · ${esc(s.title)}
              <span style="color: ${amber}; font: 400 12px 'JetBrains Mono', monospace;">  &nbsp; ${fmtDuration(s.duration_seconds)}</span>
            </a>
          </p>`).join('')}
        <p style="margin: 14px 0 0;"><a href="${savedUrl}" style="color: ${cinnamon}; font: 600 13px/1 'Plus Jakarta Sans', Arial, sans-serif; text-decoration: underline;">${c.savedCta} →</a></p>
      </td></tr>
    </table>` : '';

  const html = `<!DOCTYPE html>
<html lang="${content.locale}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background: ${cream}; color: ${cocoa};">
  <!-- preheader (hidden snippet in the inbox preview line) -->
  <div style="display: none; max-height: 0; overflow: hidden;">${esc(v ? v.title : c.intro)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${cream};">
    <tr><td align="center" style="padding: 28px 16px 48px;">
      <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width: 580px; width: 100%;">

        <!-- Brand strip -->
        <tr><td style="padding: 0 0 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font: 400 26px/1 'Caprasimo', Georgia, serif; color: ${cocoa}; letter-spacing: -0.5px; padding-right: 10px;">villie</td>
              <td style="font: 500 10px/1 'JetBrains Mono', monospace; color: ${amber}; letter-spacing: 0.22em; text-transform: uppercase; padding-top: 4px;">${weekBadge}</td>
            </tr>
          </table>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding: 0 0 24px;">
          <h1 style="margin: 0 0 8px; font: 700 26px/1.2 'Playfair Display', Georgia, serif; color: ${cocoa};">${esc(greetingLine)}</h1>
          <p style="margin: 0; font: 400 14px/1.6 'Plus Jakarta Sans', Arial, sans-serif; color: ${walnut};">${c.intro}</p>
        </td></tr>

        <!-- Top video -->
        <tr><td>${topVideoBlock}</td></tr>

        <!-- Saved reminder -->
        <tr><td>${savedBlock}</td></tr>

        <!-- Crisis footer (always present per Risk & Compliance) -->
        <tr><td style="padding: 14px 18px; background: ${paper}; border: 1px solid ${border}; border-radius: 12px;">
          <p style="margin: 0 0 6px; font: 600 12px/1.3 'JetBrains Mono', monospace; color: ${cinnamonDk}; letter-spacing: 0.12em; text-transform: uppercase;">${c.crisisHeader}</p>
          ${c.crisisLines.map((line) => `<p style="margin: 4px 0; font: 400 13px/1.5 'Plus Jakarta Sans', Arial, sans-serif; color: ${cocoa};">${esc(line)}</p>`).join('')}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding: 32px 0 0; border-top: 1px solid ${border}; margin-top: 32px;">
          <p style="margin: 24px 0 6px; font: 400 12px/1.5 'Plus Jakarta Sans', Arial, sans-serif; color: ${amber}; text-align: center;">${c.footerHouse}</p>
          <p style="margin: 0; font: 400 12px/1.5 'Plus Jakarta Sans', Arial, sans-serif; color: ${amber}; text-align: center;">
            <a href="${settingsUrl}" style="color: ${amber}; text-decoration: underline;">${c.footerSettings}</a>
            &nbsp;·&nbsp;
            <a href="${unsubUrl}" style="color: ${amber}; text-decoration: underline;">${c.footerUnsub}</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // Plain text fallback. Every client renders this if they reject HTML
  // (Apple Mail "Privacy Protection", screen readers, some corporate
  // gateways). Keep parallel to the HTML so the experience doesn't
  // diverge.
  const textLines: string[] = [];
  textLines.push(`villie · ${weekBadge}`);
  textLines.push('');
  textLines.push(greetingLine);
  textLines.push(c.intro);
  textLines.push('');
  if (v) {
    textLines.push(c.topVideoEyebrow);
    textLines.push(c.topVideoLead);
    textLines.push('');
    textLines.push(`${v.title} (${fmtDuration(v.duration_seconds)})`);
    textLines.push(v.description);
    textLines.push(`Watch: ${videoUrl}`);
    textLines.push('');
  }
  if (content.saved_count > 0) {
    textLines.push(c.savedHeader(content.saved_count));
    textLines.push(c.savedLead);
    (content.saved_top_3 || []).slice(0, 3).forEach((s) => {
      textLines.push(`  · ${s.title} (${fmtDuration(s.duration_seconds)})`);
    });
    textLines.push(`${c.savedCta}: ${savedUrl}`);
    textLines.push('');
  }
  textLines.push(c.crisisHeader);
  c.crisisLines.forEach((line) => textLines.push(`  · ${line}`));
  textLines.push('');
  textLines.push(c.footerHouse);
  textLines.push(`${c.footerSettings}: ${settingsUrl}`);
  textLines.push(`${c.footerUnsub}: ${unsubUrl}`);

  return { subject, html, text: textLines.join('\n') };
}

interface ResendOk { id: string }
interface ResendErr { name: string; message?: string }

async function sendViaResend(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ id: string } | { error: string }> {
  if (!RESEND_API_KEY) return { error: 'resend_not_configured' };
  const body: Record<string, unknown> = {
    from: FROM_ADDRESS,
    to: [args.to],
    subject: args.subject,
    html: args.html,
    text: args.text,
  };
  if (REPLY_TO) body.reply_to = REPLY_TO;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    return { error: `resend_${res.status}: ${errBody.slice(0, 200)}` };
  }
  const j = (await res.json()) as ResendOk;
  return { id: j.id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  if (!isServiceRoleRequest(req)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ ok: true, reason: 'not_configured' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Optional override for ad-hoc testing: { period_start: 'YYYY-MM-DD' }.
  const reqBody = await req.json().catch(() => ({} as Record<string, unknown>));
  const periodStart = typeof reqBody.period_start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(reqBody.period_start)
    ? reqBody.period_start
    : sundayOfThisWeekUTC();

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: recipients, error: recipientsErr } = await supabase
    .rpc('list_newsletter_recipients', { p_period_start: periodStart });
  if (recipientsErr) {
    return new Response(JSON.stringify({ error: recipientsErr.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  if (!recipients || recipients.length === 0) {
    return new Response(JSON.stringify({ ok: true, period_start: periodStart, reason: 'no_recipients' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const results = { period_start: periodStart, total: recipients.length, sent: 0, failed: 0, errors: [] as string[] };

  // Sequential fan-out for predictable rate-limit behavior. Resend's free
  // tier is 100/s; even a few hundred users serialized completes well under
  // the 60s function timeout. Switch to a batch endpoint if we ever cross
  // a thousand active opt-ins per send.
  for (const r of recipients as Recipient[]) {
    try {
      const { data: contentJson, error: contentErr } = await supabase
        .rpc('get_newsletter_content_for_user', { p_user_id: r.user_id });
      if (contentErr) throw contentErr;
      const content = (contentJson ?? {}) as ContentSnapshot;
      const { subject, html, text } = buildEmail({ recipient: r, content });
      const sendResult = await sendViaResend({ to: r.email, subject, html, text });
      if ('error' in sendResult) throw new Error(sendResult.error);
      await supabase.rpc('record_newsletter_sent', {
        p_user_id: r.user_id,
        p_period_start: periodStart,
        p_resend_id: sendResult.id,
        p_context: { top_video_id: content.top_video?.id ?? null, saved_count: content.saved_count ?? 0 },
      });
      results.sent += 1;
    } catch (e) {
      results.failed += 1;
      results.errors.push(`${r.user_id}: ${(e as Error)?.message ?? String(e)}`);
      // Don't abort the batch — keep going on per-user failure.
    }
  }

  return new Response(JSON.stringify({ ok: true, ...results }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
