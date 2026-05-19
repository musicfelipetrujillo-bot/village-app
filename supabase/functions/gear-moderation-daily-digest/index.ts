// V4 Gear · Moderation daily digest email
//
// Closes the last SOP §10 to-do item. Once a day (09:00 ET via GH Action
// cron entry), pulls every open + recently-touched gear_listing_reports row,
// formats them into a counsel-grade HTML email, and sends to the configured
// moderator inbox addresses via Resend.
//
// Why email in addition to the real-time pager (gear-moderation-pager)?
// - The pager only fires on P0 reports past their 4hr SLA. Most reports
//   are P1/P2 — those need a once-daily nudge, not a real-time push.
// - Email gives the moderator a single artifact to triage from — a quick
//   skim of the digest in the morning is the operational pattern.
// - The digest also surfaces "what auto-actioned overnight" so the
//   moderator has visibility into the P0 auto-withdraw safety net.
//
// Triggered:
//   - Daily by .github/workflows/supabase-crons.yml at 13:00 UTC (09:00 ET)
//   - Manually via authenticated POST for testing
//
// Auth: service-role bearer.
//
// Env vars:
//   RESEND_API_KEY                       — Resend API key (https://resend.com)
//   GEAR_MODERATOR_DIGEST_EMAILS         — comma-separated recipient emails
//                                          (e.g. moderator@villieapp.com,
//                                           moderator-backup@villieapp.com)
//   GEAR_MODERATOR_DIGEST_FROM           — "from" address; must be on a
//                                          verified domain in your Resend
//                                          account. Default: noreply@villieapp.com
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — injected
//
// Failure modes:
//   - RESEND_API_KEY missing → returns 200 with reason='not_configured' so
//     the cron doesn't go red while you're still setting up Resend.
//   - No recipients → same.
//   - Empty queue (nothing to digest) → still sends a "quiet day" email
//     so the absence of an email tomorrow morning is a real signal
//     (cron broke, not "nothing happened"). Configurable via the
//     `send_when_empty` body param if you'd rather have silence on
//     quiet days.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RECIPIENT_LIST = (Deno.env.get('GEAR_MODERATOR_DIGEST_EMAILS') ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);
// Default uses the send.villieapp.com subdomain because that's what Resend's
// DNS verification covers (cleaner than verifying the bare domain — no
// collisions with whatever else might be on villieapp.com itself). Override
// via env var if you switch to a different verified sender domain.
const FROM_ADDRESS = Deno.env.get('GEAR_MODERATOR_DIGEST_FROM')
  ?? 'Villie Moderation <noreply@send.villieapp.com>';

interface ReportRow {
  id: string;
  listing_id: string;
  reporter_user_id: string;
  reason_code: string;
  severity: 'P0' | 'P1' | 'P2' | null;
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  description: string;
  created_at: string;
  auto_escalated: boolean;
  auto_acknowledged_at: string | null;
  resolved_at: string | null;
  // joined fields
  listing_title?: string;
  seller_id?: string;
  removed_reason?: string | null;
}

function isoAgo(iso: string): string {
  const ageMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (ageMin < 60) return `${ageMin}m ago`;
  if (ageMin < 1440) return `${Math.floor(ageMin / 60)}h ago`;
  return `${Math.floor(ageMin / 1440)}d ago`;
}

function reasonLabel(code: string): string {
  const map: Record<string, string> = {
    recalled_item: 'CPSC recall',
    prohibited_category: 'Prohibited category',
    counterfeit_or_fake: 'Counterfeit / fake',
    damaged_or_unsafe: 'Damaged / unsafe',
    misleading_description: 'Misleading description',
    price_or_scam: 'Price / scam concern',
    harassment_or_abuse: 'Harassment / abuse',
    other: 'Other',
  };
  return map[code] ?? code;
}

function severityChip(s: ReportRow['severity']): string {
  const color = s === 'P0' ? '#C73E2F' : s === 'P1' ? '#C07840' : '#7A4A28';
  const label = s ?? '?';
  return `<span style="display:inline-block;background:${color};color:#FDFBF6;font-family:'SF Mono',Menlo,monospace;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;letter-spacing:0.5px;">${label}</span>`;
}

function statusBadge(s: ReportRow['status'], autoEscalated: boolean): string {
  if (autoEscalated && s === 'under_review') {
    return `<span style="color:#9F5F30;font-size:12px;font-weight:600;">⚠︎ auto-escalated</span>`;
  }
  return `<span style="color:#7A4A28;font-size:12px;">${s}</span>`;
}

function renderEmail(args: {
  overdueP0: ReportRow[];
  open: ReportRow[];
  autoEscalatedToday: ReportRow[];
  resolvedToday: ReportRow[];
  generatedAt: string;
}): { subject: string; html: string; text: string } {
  const { overdueP0, open, autoEscalatedToday, resolvedToday, generatedAt } = args;

  const totalActive = overdueP0.length + open.length;
  const subject = totalActive === 0
    ? `Villie · Gear moderation — quiet day (${generatedAt})`
    : `Villie · Gear moderation — ${totalActive} open${overdueP0.length ? `, ${overdueP0.length} P0 overdue` : ''}`;

  const overdueSection = overdueP0.length === 0 ? '' : `
    <h2 style="font-family:Georgia,serif;color:#C73E2F;font-size:18px;margin:24px 0 8px;">P0 overdue — needs immediate attention</h2>
    <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;font-size:13px;">
      ${overdueP0.map((r) => `
        <tr style="border-bottom:1px solid #E5DBC4;">
          <td style="padding:10px 8px 10px 0;vertical-align:top;width:60px;">${severityChip(r.severity)}</td>
          <td style="padding:10px 8px;vertical-align:top;">
            <strong style="color:#3D1F0E;">${reasonLabel(r.reason_code)}</strong>
            <span style="color:#7A4A28;font-size:12px;"> · ${isoAgo(r.created_at)}</span>
            <br><span style="color:#7A4A28;">${r.listing_title ?? '(listing)'}</span>
            <br><span style="color:#A77349;font-size:12px;font-style:italic;">"${(r.description ?? '').slice(0, 140)}${(r.description ?? '').length > 140 ? '…' : ''}"</span>
          </td>
        </tr>
      `).join('')}
    </table>
  `;

  const openSection = open.length === 0 ? '' : `
    <h2 style="font-family:Georgia,serif;color:#3D1F0E;font-size:18px;margin:24px 0 8px;">Open queue (${open.length})</h2>
    <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;font-size:13px;">
      ${open.map((r) => `
        <tr style="border-bottom:1px solid #E5DBC4;">
          <td style="padding:10px 8px 10px 0;vertical-align:top;width:60px;">${severityChip(r.severity)}</td>
          <td style="padding:10px 8px;vertical-align:top;">
            <strong style="color:#3D1F0E;">${reasonLabel(r.reason_code)}</strong>
            <span style="color:#7A4A28;font-size:12px;"> · ${isoAgo(r.created_at)} · ${statusBadge(r.status, r.auto_escalated)}</span>
            <br><span style="color:#7A4A28;">${r.listing_title ?? '(listing)'}</span>
          </td>
        </tr>
      `).join('')}
    </table>
  `;

  const autoSection = autoEscalatedToday.length === 0 ? '' : `
    <h2 style="font-family:Georgia,serif;color:#9F5F30;font-size:18px;margin:24px 0 8px;">Auto-actioned in the last 24h (${autoEscalatedToday.length})</h2>
    <p style="font-family:Georgia,serif;color:#7A4A28;font-size:13px;margin:0 0 10px;">P0 SLA-miss auto-withdraw fired on these listings. The seller has been notified via system message. <strong>Review the audit log entries</strong> to confirm the auto-action was correct, and resolve the underlying report.</p>
    <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;font-size:13px;">
      ${autoEscalatedToday.map((r) => `
        <tr style="border-bottom:1px solid #E5DBC4;">
          <td style="padding:10px 8px 10px 0;vertical-align:top;width:60px;">${severityChip(r.severity)}</td>
          <td style="padding:10px 8px;vertical-align:top;">
            <strong style="color:#3D1F0E;">${reasonLabel(r.reason_code)}</strong>
            <span style="color:#7A4A28;font-size:12px;"> · auto-ack'd ${isoAgo(r.auto_acknowledged_at ?? r.created_at)}</span>
            <br><span style="color:#7A4A28;">${r.listing_title ?? '(listing)'}</span>
          </td>
        </tr>
      `).join('')}
    </table>
  `;

  const quietSection = totalActive === 0 && autoEscalatedToday.length === 0 ? `
    <p style="font-family:Georgia,serif;color:#7A4A28;font-size:14px;margin:24px 0;">No open reports. No auto-actions in the last 24h. Quiet day.</p>
    <p style="font-family:Georgia,serif;color:#A77349;font-size:12px;margin:8px 0;font-style:italic;">If this is the third consecutive quiet day, sanity-check that the daily digest cron is still firing on real data, not just sending zero-state mails.</p>
  ` : '';

  const html = `<!DOCTYPE html><html><body style="background:#F4ECD8;padding:24px;margin:0;">
    <div style="max-width:640px;margin:0 auto;background:#FDFBF6;border-radius:14px;padding:32px 28px;border:1px solid #E5DBC4;">
      <p style="font-family:'SF Mono',monospace;color:#A77349;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;margin:0 0 6px;">Villie · Gear Moderation</p>
      <h1 style="font-family:Georgia,serif;color:#3D1F0E;font-size:24px;margin:0 0 4px;">Daily digest</h1>
      <p style="font-family:Georgia,serif;color:#7A4A28;font-size:13px;margin:0 0 24px;">${generatedAt}</p>
      ${overdueSection}
      ${openSection}
      ${autoSection}
      ${quietSection}
      <hr style="border:none;border-top:1px solid #E5DBC4;margin:28px 0 16px;">
      <p style="font-family:Georgia,serif;color:#A77349;font-size:11px;line-height:17px;margin:0;">
        Open reports in Supabase Studio · query: <code style="background:#F0EADB;padding:1px 5px;border-radius:3px;font-size:10px;">SELECT * FROM gear_listing_reports WHERE status IN ('open','under_review') ORDER BY severity, created_at;</code><br>
        Resolved reports today: ${resolvedToday.length} · auto-actioned: ${autoEscalatedToday.length} · open queue: ${open.length} · P0 overdue: ${overdueP0.length}
      </p>
    </div>
  </body></html>`;

  // Text fallback for clients that block HTML or for grep-ability in
  // case you forward the digest to a Slack channel.
  const textLines = [
    `VILLIE · GEAR MODERATION — DAILY DIGEST`,
    `${generatedAt}`,
    ``,
    `P0 overdue: ${overdueP0.length}`,
    `Open queue: ${open.length}`,
    `Auto-actioned in last 24h: ${autoEscalatedToday.length}`,
    `Resolved in last 24h: ${resolvedToday.length}`,
    ``,
    ...(overdueP0.length ? ['── P0 OVERDUE ──', ...overdueP0.map((r) => `  ${r.severity} · ${reasonLabel(r.reason_code)} · ${r.listing_title ?? '(listing)'} · ${isoAgo(r.created_at)}`), ''] : []),
    ...(open.length ? ['── OPEN ──', ...open.map((r) => `  ${r.severity} · ${reasonLabel(r.reason_code)} · ${r.listing_title ?? '(listing)'} · ${isoAgo(r.created_at)} · ${r.status}`), ''] : []),
    ...(autoEscalatedToday.length ? ['── AUTO-ACTIONED ──', ...autoEscalatedToday.map((r) => `  ${r.severity} · ${reasonLabel(r.reason_code)} · ${r.listing_title ?? '(listing)'}`), ''] : []),
  ];
  return { subject, html, text: textLines.join('\n') };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Body knobs (optional). `send_when_empty=false` lets the cron go silent
  // on quiet days; default is to send so missing emails are a real signal.
  let body: { send_when_empty?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body OK */ }
  const sendWhenEmpty = body.send_when_empty !== false;

  // Pre-flight: if either Resend or recipients aren't configured, no-op
  // gracefully so the cron stays green while you finish setup.
  if (!RESEND_API_KEY) {
    console.warn('[gear-moderation-daily-digest] RESEND_API_KEY not set; no-op');
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'not_configured_resend' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  if (RECIPIENT_LIST.length === 0) {
    console.warn('[gear-moderation-daily-digest] GEAR_MODERATOR_DIGEST_EMAILS empty; no-op');
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'not_configured_recipients' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 1. Pull each segment of the queue. ──
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  // P0 overdue (4hr+) still 'open' and not yet acknowledged by the pager
  const { data: overdueP0Raw } = await supabase
    .from('gear_listing_reports')
    .select(`id, listing_id, reporter_user_id, reason_code, severity, status,
             description, created_at, auto_escalated, auto_acknowledged_at, resolved_at,
             gear_listings ( title, seller_id )`)
    .eq('severity', 'P0')
    .eq('status', 'open')
    .lt('created_at', fourHoursAgo);

  // Everything else still open or under_review
  const { data: openRaw } = await supabase
    .from('gear_listing_reports')
    .select(`id, listing_id, reporter_user_id, reason_code, severity, status,
             description, created_at, auto_escalated, auto_acknowledged_at, resolved_at,
             gear_listings ( title, seller_id )`)
    .in('status', ['open', 'under_review'])
    .or(`severity.in.(P1,P2),and(severity.eq.P0,created_at.gte.${fourHoursAgo})`);

  // Auto-actioned in the last 24h
  const { data: autoRaw } = await supabase
    .from('gear_listing_reports')
    .select(`id, listing_id, reporter_user_id, reason_code, severity, status,
             description, created_at, auto_escalated, auto_acknowledged_at, resolved_at,
             gear_listings ( title, seller_id )`)
    .eq('auto_escalated', true)
    .gte('auto_acknowledged_at', oneDayAgo);

  // Resolved in the last 24h (counted only, not listed)
  const { count: resolvedCount } = await supabase
    .from('gear_listing_reports')
    .select('*', { count: 'exact', head: true })
    .in('status', ['resolved', 'dismissed'])
    .gte('resolved_at', oneDayAgo);

  // Flatten the joined listing title onto each row.
  const flatten = (rows: any[] | null): ReportRow[] =>
    (rows ?? []).map((r) => ({
      ...r,
      listing_title: r.gear_listings?.title,
      seller_id: r.gear_listings?.seller_id,
    }));

  const overdueP0 = flatten(overdueP0Raw);
  const open = flatten(openRaw);
  const autoEscalatedToday = flatten(autoRaw);
  const resolvedToday: ReportRow[] = []; // not surfaced in the email body, just count

  // ── 2. Decide whether to send. ──
  const totalActive = overdueP0.length + open.length + autoEscalatedToday.length;
  if (totalActive === 0 && !sendWhenEmpty) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'quiet_day_silenced' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // ── 3. Render + send. ──
  const generatedAt = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short',
  });

  const { subject, html, text } = renderEmail({
    overdueP0,
    open,
    autoEscalatedToday,
    resolvedToday,
    generatedAt,
  });

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: RECIPIENT_LIST,
      subject,
      html,
      text,
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    console.error('[gear-moderation-daily-digest] resend failed', resendRes.status, errText);
    return new Response(JSON.stringify({ error: 'resend_failed', status: resendRes.status, detail: errText.slice(0, 500) }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // ── 4. Audit log so we know the digest fired. ──
  await supabase.from('admin_audit_log').insert({
    action: 'gear_moderation_daily_digest_sent',
    target_table: 'gear_listing_reports',
    // No single target_id since the digest spans many; use a sentinel UUID
    // and put the row counts in metadata.
    target_id: '00000000-0000-0000-0000-000000000000',
    performed_by: 'system',
    metadata: {
      generated_at: generatedAt,
      recipients_count: RECIPIENT_LIST.length,
      overdue_p0_count: overdueP0.length,
      open_count: open.length,
      auto_escalated_today_count: autoEscalatedToday.length,
      resolved_today_count: resolvedCount ?? 0,
    },
  });

  return new Response(JSON.stringify({
    ok: true,
    sent: RECIPIENT_LIST.length,
    counts: {
      overdue_p0: overdueP0.length,
      open: open.length,
      auto_escalated_today: autoEscalatedToday.length,
      resolved_today: resolvedCount ?? 0,
    },
  }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
});
