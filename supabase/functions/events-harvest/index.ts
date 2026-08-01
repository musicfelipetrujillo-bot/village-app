// events-harvest — AI harvester for venue/org event PAGES that publish no
// machine feed (Webflow sites like The Underline, city pages, studio sites).
// Tier A of the Plans sourcing architecture (2026-07-31):
//   registry row (events_partner_feeds with ics_url = 'harvest:<page url>')
//   → fetch page HTML → Haiku extracts structured events → upsert_ingested_event
//   → the EXISTING chain (events-geocode → ai-event-screen → founder review)
//   takes over. Nothing publishes without review unless the feed's
//   auto_publish_threshold says so (harvest sources ship at the 1.0 CHECK cap).
//
// The mom always finishes on the source site (tickets/registration) — the
// event's ticket link is appended to the description. villie sources; she buys.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.
// Invoked by the GH Actions cron (service-role Bearer) daily at 08:50 UTC,
// ahead of the 09:30 ai-event-screen sweep that mops up anything unscreened.

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const HARVEST_PREFIX = 'harvest:';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 villie-events/1.0';

// ── HTML → readable text (cheap, no DOM dep) ────────────────────────────
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // keep hrefs so the model can attach ticket links to events
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>/gi, ' [link: $1] ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .slice(0, 30000);
}

const EXTRACT_SYSTEM = `You extract REAL, DATED, upcoming events from the text of a venue/organization web page for a maternal-health app (audience: moms with 0-12 month babies).

Return ONLY a JSON array (no prose, no fences). Each element:
{
  "title": string,                       // exact event name from the page
  "description": string,                 // <=350 chars, faithful to the page — no invention
  "starts_at": string,                   // ISO 8601 WITH the utc offset for the venue timezone you are given
  "ends_at": string | null,              // ISO 8601 or null if the page gives no end
  "venue_name": string | null,
  "address": string | null,              // street address if shown, else null
  "event_url": string | null             // the event's own detail/ticket link from [link: ...] markers, absolute URL
}

HARD RULES:
- ONLY events with a determinable calendar date in the FUTURE (today's date is given). Skip past events.
- Skip anything undated, navigational, or promotional ("join our newsletter", venue hours, generic program blurbs).
- A recurring pattern stated on the page (e.g. "third Saturday of every month, 9am-12pm") COUNTS: emit the next 2 occurrences with computed dates.
- If a time is missing use 10:00 local. If the year is missing, infer the next future occurrence.
- Do NOT invent venues, addresses, or URLs — null when the page doesn't say.
- Max 20 events. If the page has none, return [].`;

interface HarvestedEvent {
  title: string; description: string; starts_at: string; ends_at: string | null;
  venue_name: string | null; address: string | null; event_url: string | null;
}

async function extractEvents(pageText: string, tz: string, sourceName: string): Promise<HarvestedEvent[]> {
  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3500,
    temperature: 0,
    system: [{ type: 'text', text: EXTRACT_SYSTEM, cache_control: { type: 'ephemeral' } }] as any,
    messages: [{
      role: 'user',
      content: `Today's date: ${new Date().toISOString()}\nVenue timezone: ${tz}\nSource: ${sourceName}\n\nPAGE TEXT:\n${pageText}`,
    }],
  });
  const raw = (resp.content.find((b: any) => b.type === 'text') as any)?.text ?? '[]';
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((e: any) => e && typeof e.title === 'string' && typeof e.starts_at === 'string');
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

async function invokeEdge(fnName: string, body: unknown) {
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify(body),
    });
  } catch { /* cron sweeps mop up */ }
}

async function harvestFeed(feed: any): Promise<{ found: number; upserted: number; error?: string }> {
  const url = String(feed.ics_url).slice(HARVEST_PREFIX.length);
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`fetch_${res.status}`);
  const text = htmlToText(await res.text());
  if (text.length < 200) throw new Error('page_too_thin');

  const events = await extractEvents(text, feed.default_timezone, feed.partner_name);
  const horizon = Date.now() + 120 * 86400000;
  let upserted = 0;

  for (const ev of events) {
    const starts = Date.parse(ev.starts_at);
    if (!Number.isFinite(starts) || starts < Date.now() || starts > horizon) continue;

    // Stable per-occurrence uid → re-harvests update in place via the
    // (source_feed_id, source_uid) unique index, same as ICS ingest.
    const uid = `harvest-${slug(ev.title)}-${ev.starts_at.slice(0, 10)}`;

    // Cross-feed dedup — same guard the ICS path uses.
    const { data: dup } = await supabase.rpc('find_duplicate_event', {
      p_title: ev.title, p_starts_at: ev.starts_at, p_exclude_feed_id: feed.id,
    });
    if (dup) continue;

    const description = [
      (ev.description ?? '').slice(0, 3800),
      ev.event_url ? `\n\nDetails & tickets: ${ev.event_url}` : '',
    ].join('');

    const { data: idData, error } = await supabase.rpc('upsert_ingested_event', {
      p_source_feed_id: feed.id,
      p_source_uid: uid,
      p_type: feed.default_event_type ?? 'local',
      p_title: ev.title.slice(0, 200),
      p_description: description,
      p_host_name: feed.partner_name,
      p_host_avatar_url: feed.partner_avatar_url,
      p_is_partner: feed.is_partner,
      p_starts_at: new Date(starts).toISOString(),
      p_ends_at: ev.ends_at && Number.isFinite(Date.parse(ev.ends_at)) ? new Date(Date.parse(ev.ends_at)).toISOString() : null,
      p_timezone: feed.default_timezone,
      p_age_tags: feed.default_age_tags,
      p_venue_name: ev.venue_name,
      p_address: ev.address,
      p_city: feed.default_city,
      p_lat: null,
      p_lng: null,
      p_stream_url: null,
      p_platform: null,
    });
    if (error || !idData) {
      console.error(`[events-harvest] upsert failed ${feed.partner_name}/${uid}:`, error?.message);
      continue;
    }
    upserted++;
    // Geocode first so the screen pass sees a real location.
    await invokeEdge('events-geocode', { mode: 'event', event_id: idData });
    await invokeEdge('ai-event-screen', { mode: 'event', event_id: idData });
  }
  return { found: events.length, upserted };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));

    // Self-serve source registration (service-role callers only — this fn sits
    // behind verify_jwt). body.register = { partner_name, url, city?, timezone?,
    // age_tags?, event_type? }. Idempotent on the harvest URL. Falls through to
    // an immediate harvest so a new source shows results in the same call.
    if (body.register?.partner_name && body.register?.url) {
      const r = body.register;
      const ics_url = `${HARVEST_PREFIX}${r.url}`;
      const { data: existing } = await supabase.from('events_partner_feeds').select('id').eq('ics_url', ics_url).maybeSingle();
      if (!existing) {
        const { error: insErr } = await supabase.from('events_partner_feeds').insert({
          partner_name: r.partner_name,
          is_partner: false,
          ics_url,
          default_timezone: r.timezone ?? 'America/New_York',
          default_city: r.city ?? 'Miami',
          default_age_tags: r.age_tags ?? ['0-3mo', '3-6mo', '6-12mo'],
          default_event_type: r.event_type ?? 'local',
          is_active: true,
          auto_publish_threshold: 1.0, // CHECK caps at 1.0 — only a perfect-confidence event skips review
          notes: `Tier-A AI harvest source, self-registered ${new Date().toISOString().slice(0, 10)}.`,
        });
        if (insErr) return json({ error: insErr.message }, 500);
      }
    }

    let q = supabase.from('events_partner_feeds').select('*').eq('is_active', true).ilike('ics_url', `${HARVEST_PREFIX}%`);
    if (body.feed_id) q = q.eq('id', body.feed_id);
    const { data: feeds, error } = await q;
    if (error) return json({ error: error.message }, 500);

    const report: Record<string, unknown> = {};
    for (const feed of feeds ?? []) {
      try {
        const r = await harvestFeed(feed);
        report[feed.partner_name] = r;
        await supabase.from('events_partner_feeds').update({
          last_synced_at: new Date().toISOString(),
          last_sync_status: `harvested ${r.upserted}/${r.found}`,
          consecutive_failures: 0,
        }).eq('id', feed.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        report[feed.partner_name] = { error: msg };
        const failures = (feed.consecutive_failures ?? 0) + 1;
        const patch: Record<string, unknown> = {
          last_synced_at: new Date().toISOString(),
          last_sync_status: `error: ${msg}`.slice(0, 200),
          consecutive_failures: failures,
        };
        if (failures >= 3) patch.is_active = false;
        await supabase.from('events_partner_feeds').update(patch).eq('id', feed.id);
      }
    }
    return json({ ok: true, feeds: (feeds ?? []).length, report });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
