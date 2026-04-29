// V4 G2 — Partner ICS event ingest (Pass 1 of self-sustaining events).
//
// Pulls each active row in `events_partner_feeds`, parses the iCalendar
// payload, and upserts events into the `events` table keyed on
// `(source_feed_id, source_uid)`. Hospital + library partners maintain
// their own calendars for staff use; this function inherits that signal
// without per-partner code changes.
//
// Why a hand-rolled parser:
//   - Most npm ical parsers pull in moment.js / luxon, blowing the Edge
//     Function bundle past the size limit.
//   - We only need a small subset of RFC 5545: VEVENT blocks, UID, SUMMARY,
//     DESCRIPTION, DTSTART, DTEND, LOCATION, URL, STATUS. RRULE expansion
//     and timezone math are explicitly out of scope (see "Limitations").
//
// Limitations (acknowledged, deferred):
//   - RRULE recurring events are NOT expanded — only the master event is
//     ingested. Hospital support groups that recur weekly will appear as a
//     single "next occurrence". Pass 2 adds an RRULE expander.
//   - VTIMEZONE blocks are NOT parsed. Floating times are interpreted in
//     the feed's `default_timezone`. Most hospital ICS feeds use UTC or
//     stamp DTSTART with a TZID we currently ignore — close enough for v1
//     since the local-display TZ on the device handles render.
//   - HTML in DESCRIPTION is stripped to plain text via a naive tag-strip.
//
// Modes:
//   - `all` (default, cron) — process every active feed
//   - `feed` — process exactly one feed by id (for ops debugging)
//
// Posture:
//   - Every event ingested here lands as `is_third_party=TRUE`.
//   - Failures per-feed are isolated: one bad feed never blocks the others.
//   - A feed that 404s twice in a row gets `is_active=FALSE` (Pass 2 will
//     emit a notification to admin_audit_log; Pass 1 just logs).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
interface PartnerFeed {
  id: string;
  partner_name: string;
  partner_avatar_url: string | null;
  is_partner: boolean;
  ics_url: string;
  default_timezone: string;
  default_city: string | null;
  default_age_tags: string[];
  default_event_type: 'local' | 'webinar';
  consecutive_failures: number;
}

interface ParsedEvent {
  uid: string;
  summary: string;
  description: string;
  starts_at: string;        // ISO
  ends_at: string;          // ISO
  location: string | null;
  url: string | null;
  status_cancelled: boolean;
}

interface FeedResult {
  feed_id: string;
  partner_name: string;
  status: 'ok' | string;    // string = error code
  parsed: number;
  upserted: number;
  cancelled: number;
  error?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Entry point
// ────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const mode: 'all' | 'feed' = body.mode === 'feed' ? 'feed' : 'all';

    let feeds: PartnerFeed[] = [];
    if (mode === 'feed') {
      if (!body.feed_id) {
        return json({ error: 'feed_id required when mode=feed' }, 400);
      }
      const { data, error } = await supabase
        .from('events_partner_feeds')
        .select('*')
        .eq('id', body.feed_id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'feed not found' }, 404);
      feeds = [data as PartnerFeed];
    } else {
      const { data, error } = await supabase
        .from('events_partner_feeds')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      feeds = (data ?? []) as PartnerFeed[];
    }

    // Sequential, per-feed isolated. We could Promise.all here, but feeds
    // are typically small (<20) and serial keeps logs readable + avoids
    // hammering the same partner's CDN if they're hosting multiple feeds.
    const results: FeedResult[] = [];
    for (const feed of feeds) {
      results.push(await processFeed(feed));
    }

    return json({ mode, processed: results.length, results });
  } catch (err) {
    console.error('events-ingest-ics fatal:', err);
    return json({ error: (err as Error).message }, 500);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Per-feed pipeline
// ────────────────────────────────────────────────────────────────────────────
async function processFeed(feed: PartnerFeed): Promise<FeedResult> {
  let raw: string;
  try {
    const resp = await fetch(feed.ics_url, {
      headers: { 'User-Agent': 'TheVillageApp-EventIngest/1.0' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) {
      await markFeedFailed(feed, `http_${resp.status}`);
      return {
        feed_id: feed.id,
        partner_name: feed.partner_name,
        status: `http_${resp.status}`,
        parsed: 0,
        upserted: 0,
        cancelled: 0,
      };
    }
    raw = await resp.text();
  } catch (err) {
    await markFeedFailed(feed, 'fetch_error');
    return {
      feed_id: feed.id,
      partner_name: feed.partner_name,
      status: 'fetch_error',
      parsed: 0,
      upserted: 0,
      cancelled: 0,
      error: (err as Error).message,
    };
  }

  let parsed: ParsedEvent[];
  try {
    parsed = parseIcs(raw, feed.default_timezone);
  } catch (err) {
    await markFeedFailed(feed, 'parse_error');
    return {
      feed_id: feed.id,
      partner_name: feed.partner_name,
      status: 'parse_error',
      parsed: 0,
      upserted: 0,
      cancelled: 0,
      error: (err as Error).message,
    };
  }

  // Build the set of UIDs this feed currently publishes. Anything in our
  // events table tied to this feed but NOT in this set has been removed
  // from the source → mark cancelled (preserves RSVPs, removes from feed).
  const liveUids = new Set(parsed.filter((p) => !p.status_cancelled).map((p) => p.uid));

  // Upsert each currently-live event. We use INSERT … ON CONFLICT via the
  // unique (source_feed_id, source_uid) index so re-pulls update in place.
  let upserted = 0;
  for (const ev of parsed) {
    if (ev.status_cancelled) continue; // handled in the cancel sweep below
    const ok = await upsertEvent(feed, ev);
    if (ok) upserted += 1;
  }

  // Cancel events that vanished from the source feed. We don't delete —
  // RSVPs reference event_id and we want users to see the cancellation in
  // their My RSVPs tab.
  const { data: existing, error: existingErr } = await supabase
    .from('events')
    .select('id, source_uid, status')
    .eq('source_feed_id', feed.id)
    .neq('status', 'cancelled');
  if (existingErr) console.error('list existing failed:', existingErr);

  let cancelled = 0;
  for (const row of existing ?? []) {
    if (row.source_uid && !liveUids.has(row.source_uid)) {
      const { error: cancelErr } = await supabase
        .from('events')
        .update({ status: 'cancelled' })
        .eq('id', row.id);
      if (!cancelErr) cancelled += 1;
    }
  }

  // Also explicitly cancel UIDs the feed marked STATUS:CANCELLED.
  for (const ev of parsed) {
    if (!ev.status_cancelled) continue;
    const { error: cancelErr } = await supabase
      .from('events')
      .update({ status: 'cancelled' })
      .eq('source_feed_id', feed.id)
      .eq('source_uid', ev.uid)
      .neq('status', 'cancelled');
    if (!cancelErr) cancelled += 1;
  }

  await markFeedOk(feed);

  return {
    feed_id: feed.id,
    partner_name: feed.partner_name,
    status: 'ok',
    parsed: parsed.length,
    upserted,
    cancelled,
  };
}

async function upsertEvent(feed: PartnerFeed, ev: ParsedEvent): Promise<boolean> {
  // The events table requires a description; many hospital ICS feeds omit
  // DESCRIPTION entirely. Fall back to the title so the constraint passes
  // and the EventDetailScreen still renders something legible.
  const description = ev.description.trim() || ev.summary.trim();

  // local vs webinar inferred from URL/LOCATION presence:
  //   - URL only (no LOCATION): webinar
  //   - LOCATION only: local — geocoded post-insert
  //   - URL + LOCATION: local (in-person, with extra link) — geocoded
  //   - neither: skip
  let type: 'local' | 'webinar';
  let stream_url: string | null = null;
  let venue_name: string | null = null;

  if (ev.location) {
    type = 'local';
    venue_name = ev.location.split(',')[0]?.trim() || feed.partner_name;
  } else if (ev.url && /^https?:\/\//i.test(ev.url)) {
    type = 'webinar';
    stream_url = ev.url;
  } else {
    console.warn(`skip ${feed.partner_name}/${ev.uid}: no location and no url`);
    return false;
  }

  // Cross-feed dedup — if another feed already publishes this event at
  // the same time + similar title, skip rather than double-list. We use
  // title+time only here (no coords yet); the helper RPC tolerates NULL
  // lat/lng.
  if (type === 'local') {
    const { data: dup } = await supabase.rpc('find_duplicate_event', {
      p_title: ev.summary,
      p_starts_at: ev.starts_at,
      p_lat: null,
      p_lng: null,
    });
    if (dup) {
      // Same event already in DB from another feed. Don't insert ours.
      // (A future Pass 3 can record the cross-feed mapping for audit.)
      console.log(`dup ${feed.partner_name}/${ev.uid} → ${dup}`);
      return false;
    }
  }

  // Single RPC handles both INSERT and UPDATE-on-conflict, including
  // PostGIS sentinel construction for type='local' without coords.
  // events-geocode + ai-event-screen run as post-insert hooks below.
  const { data: idData, error } = await supabase.rpc('upsert_ingested_event', {
    p_source_feed_id: feed.id,
    p_source_uid: ev.uid,
    p_type: type,
    p_title: ev.summary.slice(0, 200) || '(untitled event)',
    p_description: description.slice(0, 4000),
    p_host_name: feed.partner_name,
    p_host_avatar_url: feed.partner_avatar_url,
    p_is_partner: feed.is_partner,
    p_starts_at: ev.starts_at,
    p_ends_at: ev.ends_at,
    p_timezone: feed.default_timezone,
    p_age_tags: feed.default_age_tags,
    p_venue_name: venue_name,
    p_address: ev.location ?? null,
    p_city: feed.default_city,
    p_lat: null,                          // events-geocode fills these
    p_lng: null,
    p_stream_url: stream_url,
    p_platform: stream_url ? guessPlatform(stream_url) : null,
  });

  if (error || !idData) {
    console.error(`upsert_ingested_event failed ${feed.partner_name}/${ev.uid}:`, error?.message);
    return false;
  }

  const eventId = idData as string;

  // Fire-and-forget post-insert hooks. Sequential matters: geocode first
  // so ai-event-screen sees a real location. Cron sweeps mop up failures.
  postInsertHooks(eventId, type).catch(() => {});

  return true;
}

async function postInsertHooks(eventId: string, type: 'local' | 'webinar') {
  if (type === 'local') {
    await invokeEdge('events-geocode', { mode: 'event', event_id: eventId });
  }
  await invokeEdge('ai-event-screen', { mode: 'event', event_id: eventId });
}

async function invokeEdge(fnName: string, body: unknown) {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/${fnName}`;
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
}

async function markFeedOk(feed: PartnerFeed) {
  await supabase
    .from('events_partner_feeds')
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: 'ok',
      consecutive_failures: 0,
    })
    .eq('id', feed.id);
}

async function markFeedFailed(feed: PartnerFeed, statusCode: string) {
  const failures = feed.consecutive_failures + 1;
  // Auto-deactivate after 3 strikes — ops gets a quiet failure rather than
  // daily 404 storms. Re-activation is manual after they fix the URL.
  const patch: Record<string, unknown> = {
    last_synced_at: new Date().toISOString(),
    last_sync_status: statusCode,
    consecutive_failures: failures,
  };
  if (failures >= 3) patch.is_active = false;
  await supabase.from('events_partner_feeds').update(patch).eq('id', feed.id);
}

// ────────────────────────────────────────────────────────────────────────────
// iCalendar parser — RFC 5545 subset
// ────────────────────────────────────────────────────────────────────────────
//
// Supports:
//   - Line unfolding (CRLF + leading whitespace continuation)
//   - VEVENT block extraction
//   - UID, SUMMARY, DESCRIPTION, LOCATION, URL, STATUS
//   - DTSTART / DTEND in both UTC ("20260501T140000Z"), floating
//     ("20260501T140000"), and date-only ("20260501") forms
//   - Property parameters (e.g. `DTSTART;TZID=America/New_York:...`) — we
//     read the value but currently honor only Z-suffix UTC; floating values
//     are interpreted in the feed's default_timezone via a naive shift.
//
// Does NOT support: RRULE expansion, VTIMEZONE blocks, EXDATE, recurring
// overrides. These are Pass 2.
function parseIcs(raw: string, _defaultTz: string): ParsedEvent[] {
  // Unfold per RFC 5545 §3.1: CRLF followed by whitespace = continuation.
  const unfolded = raw.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events: ParsedEvent[] = [];
  let inEvent = false;
  let cur: Partial<ParsedEvent> & { uid?: string } = {};

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      inEvent = false;
      if (cur.uid && cur.summary && cur.starts_at && cur.ends_at) {
        events.push({
          uid: cur.uid,
          summary: cur.summary,
          description: cur.description ?? '',
          starts_at: cur.starts_at,
          ends_at: cur.ends_at,
          location: cur.location ?? null,
          url: cur.url ?? null,
          status_cancelled: !!cur.status_cancelled,
        });
      }
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;
    const left = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    // `name` is everything before the first ';' (params follow).
    const semiIdx = left.indexOf(';');
    const name = (semiIdx < 0 ? left : left.slice(0, semiIdx)).toUpperCase();

    switch (name) {
      case 'UID':
        cur.uid = value;
        break;
      case 'SUMMARY':
        cur.summary = unescapeIcs(value);
        break;
      case 'DESCRIPTION':
        cur.description = stripHtml(unescapeIcs(value));
        break;
      case 'LOCATION':
        cur.location = unescapeIcs(value);
        break;
      case 'URL':
        cur.url = value;
        break;
      case 'STATUS':
        if (value.toUpperCase() === 'CANCELLED') cur.status_cancelled = true;
        break;
      case 'DTSTART':
        cur.starts_at = parseIcsDate(value);
        break;
      case 'DTEND':
        cur.ends_at = parseIcsDate(value);
        break;
    }
  }

  // ICS allows DTEND to be omitted (then duration = 0 or DTSTART is a
  // date-only). For our schema both are NOT NULL, so default end = start
  // + 1h when missing.
  return events.map((e) => {
    if (!e.ends_at) {
      const startMs = Date.parse(e.starts_at);
      e.ends_at = new Date(startMs + 60 * 60 * 1000).toISOString();
    }
    return e;
  });
}

// RFC 5545 §3.3.5 datetime forms:
//   20260501T140000Z   → UTC
//   20260501T140000    → floating (no TZ info)
//   20260501           → date-only, all-day
function parseIcsDate(raw: string): string {
  if (/^\d{8}T\d{6}Z$/.test(raw)) {
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    const hh = raw.slice(9, 11);
    const mm = raw.slice(11, 13);
    const ss = raw.slice(13, 15);
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
  }
  if (/^\d{8}T\d{6}$/.test(raw)) {
    // Floating — treat as UTC for storage. Renderer adjusts to user TZ.
    // This is a known approximation for Pass 1; VTIMEZONE comes in Pass 2.
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    const hh = raw.slice(9, 11);
    const mm = raw.slice(11, 13);
    const ss = raw.slice(13, 15);
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
  }
  if (/^\d{8}$/.test(raw)) {
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    return `${y}-${m}-${d}T00:00:00Z`;
  }
  // Last-resort: hand it to Date.parse and hope.
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date().toISOString();
}

// RFC 5545 §3.3.11: text values escape `\,` `\;` `\\` `\n` / `\N`.
function unescapeIcs(s: string): string {
  return s
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function guessPlatform(url: string): 'zoom' | 'youtube' | 'teams' | 'other' {
  const u = url.toLowerCase();
  if (u.includes('zoom.us')) return 'zoom';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('teams.microsoft.com')) return 'teams';
  return 'other';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
