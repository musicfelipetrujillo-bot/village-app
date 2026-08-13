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

// Minimum extracted-text length worth sending to the model. Below this the page
// is a shell (SPA root div, cookie wall) rather than content.
const MIN_PAGE_TEXT = 200;

// Fallback ends_at when a page states a start but no end. events.ends_at is
// NOT NULL and list_events_near filters on `ends_at > now()`, so passing null
// makes upsert_ingested_event fail and the event is dropped entirely.
const DEFAULT_DURATION_MS = 90 * 60 * 1000;

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
    // Long org pages (PSI's support-meeting index, county library calendars)
    // carry their schedule well past the old 30k cut, so the slice silently
    // truncated exactly the content we came for. Haiku's context absorbs 60k
    // characters (~15k tokens) comfortably.
    .slice(0, 60000);
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
  "event_url": string | null,            // the event's own detail/ticket link from [link: ...] markers, absolute URL
  "cost": "free" | "paid" | "unknown",
  "price_cents": number | null,          // only when cost is "paid" AND a figure is stated. 30 dollars -> 3000
  "format": "in_person" | "virtual" | "unknown"
}

HARD RULES:
- ONLY events with a determinable calendar date in the FUTURE (today's date is given). Skip past events.
- Skip anything undated, navigational, or promotional ("join our newsletter", venue hours, generic program blurbs).
- A recurring pattern stated on the page (e.g. "third Saturday of every month, 9am-12pm") COUNTS: emit the next 2 occurrences with computed dates.
- If a time is missing use 10:00 local. If the year is missing, infer the next future occurrence.
- Do NOT invent venues, addresses, or URLs — null when the page doesn't say.
- Attribute "cost" and "format" ONLY to text describing THIS event. Ignore
  unrelated amenities ("free parking", "free gift for attendees", "free wifi")
  and any other event's pricing on the same page. An address in a site header,
  footer, or "contact us" block is the ORGANIZATION's address, not this event's
  venue — it does not make an event "in_person". When you cannot tell which
  event a cost or location phrase belongs to, use "unknown".
- "cost": say "free" when the page says attendance costs nothing — free, no
  cost, complimentary, an unconditional "donation based" / "pay what you can"
  with NO amount named — OR when the event is peer-led / volunteer-run mutual
  support (leaders described as "volunteers", "mother-to-mother",
  "parent-to-parent", etc.) AND the page mentions NO price, fee, ticket,
  registration charge, or "buy/purchase" flow anywhere for it — that
  combination (mutual-aid framing + zero commerce machinery) IS the page
  saying so. Say "paid" when any figure is stated, INCLUDING a suggested or
  requested donation ("suggested donation $40" is paid, price_cents 4000 — a
  named amount is a price even when framed as optional), or when the page
  has a real ticket-purchase/checkout flow for the event even if no figure
  is shown (Eventbrite-style "Get Tickets", a cart, a paid-registration
  link). With a range, use the LOWEST stated figure ("$30 a class, 4 for
  $90" -> 3000). Sliding scale or "determined by insurance" is "paid" with
  price_cents null. Conditional free ("first class free", "free for
  members") is "paid" when any other figure is stated, otherwise "unknown"
  — never "free". Otherwise, when the page is simply silent about cost —
  no price language AND no mutual-aid/volunteer framing to lean on — say
  "unknown". Do NOT guess free on silence alone.
  If ONLY a multi-session package price is stated with no per-session figure,
  use "paid" with price_cents null — the event costs money but the per-visit
  amount is unknown.
- "format": "virtual" for Zoom/online/webinar/virtual signals, "in_person" when
  a physical venue or street address is given, "unknown" when neither is clear.
- Max 20 events. If the page has none, return [].`;

interface HarvestedEvent {
  title: string; description: string; starts_at: string; ends_at: string | null;
  venue_name: string | null; address: string | null; event_url: string | null;
  cost: 'free' | 'paid' | 'unknown';
  price_cents: number | null;
  format: 'in_person' | 'virtual' | 'unknown';
}

// ── Page fetch, with a JS-rendering fallback ────────────────────────────
// The plain fetch below never executes JavaScript. Most modern class calendars
// (hospital SPAs, county-library widgets, Mindbody/Momence/Wix booking embeds)
// render events client-side, so a direct fetch returns a shell and extracts
// ZERO events while still reporting HTTP 200. Verified 2026-08-12 against
// events.baptisthealth.com (hash-routed SPA) and mdpls.org/events.
//
// Direct fetch stays first: it is free, fast, and sufficient for the sources
// that do server-render (postpartum.net, theunderline.org). The proxy is only
// paid for when the cheap path comes back empty — see harvestFeed().
async function fetchDirect(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`fetch_${res.status}`);
  return htmlToText(await res.text());
}

// Renders the page (JS executed) and returns readable text. Uses r.jina.ai,
// which needs no key on its free tier; RENDER_PROXY_KEY raises the rate limit
// when set. Returns null on any failure so a proxy outage degrades to
// "direct-fetch only" rather than failing the whole feed.
async function fetchRendered(url: string): Promise<string | null> {
  try {
    const key = Deno.env.get('RENDER_PROXY_KEY');
    const headers: Record<string, string> = { 'User-Agent': UA };
    if (key) headers['Authorization'] = `Bearer ${key}`;
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      console.error(`[events-harvest] render proxy ${res.status} for ${url}`);
      return null;
    }
    // The proxy already returns markdown-ish text, so htmlToText would only
    // strip the few inline tags it leaves behind — cheap and harmless.
    const text = htmlToText(await res.text());
    return text.length >= MIN_PAGE_TEXT ? text : null;
  } catch (e) {
    console.error(`[events-harvest] render proxy failed for ${url}:`, e instanceof Error ? e.message : String(e));
    return null;
  }
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

  // The model occasionally emits trailing prose after the array, or a fence it
  // was told not to use. A bare JSON.parse throws on that and — now that a
  // zero-yield run counts against consecutive_failures — a formatting hiccup
  // could retire a perfectly good source. Salvage the outermost array first;
  // only give up if there is genuinely no array in the response.
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end <= start) {
      throw new Error('extract_unparseable');
    }
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      throw new Error('extract_unparseable');
    }
  }
  if (!Array.isArray(parsed)) return [];

  const COSTS = ['free', 'paid', 'unknown'] as const;
  const FORMATS = ['in_person', 'virtual', 'unknown'] as const;

  return parsed
    .filter((e: any) => e && typeof e.title === 'string' && typeof e.starts_at === 'string')
    .map((e: any): HarvestedEvent => {
      // The model's output is untrusted text. `cost` decides whether a card
      // says "Free" to a mother, so anything we don't recognise — a missing
      // field, "Free" capitalised, a novel string — degrades to 'unknown',
      // which forces human review rather than making a price claim.
      const cost = COSTS.includes(e.cost) ? e.cost : 'unknown';
      const format = FORMATS.includes(e.format) ? e.format : 'unknown';
      const rawPrice = typeof e.price_cents === 'number' && Number.isFinite(e.price_cents) && e.price_cents >= 0
        ? Math.round(e.price_cents)
        : null;
      return {
        ...e,
        cost,
        format,
        // A price only means anything on a paid event; drop a stray figure
        // the model may have attached to a free or unknown one.
        price_cents: cost === 'paid' ? rawPrice : null,
      };
    });
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

async function harvestFeed(feed: any): Promise<{ found: number; upserted: number; rendered: boolean; skipped: number; error?: string }> {
  const url = String(feed.ics_url).slice(HARVEST_PREFIX.length);

  // Direct fetch first. A thin page is treated the same as a zero-event page —
  // both mean "the cheap path found nothing", which is exactly the render
  // proxy's cue. Only a hard transport error (non-2xx) throws, because that is
  // a genuinely broken feed rather than a client-rendered one.
  let text = '';
  let events: HarvestedEvent[] = [];
  try {
    text = await fetchDirect(url);
  } catch (e) {
    // Non-2xx: still worth one render attempt — some hosts 403 a bare fetch
    // but serve the proxy fine. If the proxy also fails we rethrow below.
    console.error(`[events-harvest] direct fetch failed ${feed.partner_name}:`, e instanceof Error ? e.message : String(e));
  }
  if (text.length >= MIN_PAGE_TEXT) {
    events = await extractEvents(text, feed.default_timezone, feed.partner_name);
  }

  // Render fallback — the trigger is "zero events", not "fetch failed", so a
  // page that returns 200 with an empty SPA shell is still rescued.
  let rendered = false;
  if (events.length === 0) {
    const renderedText = await fetchRendered(url);
    if (renderedText) {
      rendered = true;
      events = await extractEvents(renderedText, feed.default_timezone, feed.partner_name);
    } else if (text.length < MIN_PAGE_TEXT) {
      // Neither path produced usable text — this feed is genuinely broken.
      throw new Error('page_too_thin');
    }
  }

  const horizon = Date.now() + 120 * 86400000;
  const isWebinar = (feed.default_event_type ?? 'local') === 'webinar';
  const skipped: { title: string; reason: string }[] = [];
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

    // Per-event format overrides the feed default. This is what makes a page
    // mixing virtual and in-person registerable: an in-person event elsewhere
    // becomes a 'local' row with a real address, gets geocoded by the existing
    // sweep, and then falls outside a Miami mother's radius on its own. Correct
    // typing IS the geographic filter — no extra filtering logic exists or is
    // needed. 'unknown' keeps today's behavior for single-format feeds.
    const eventIsWebinar = ev.format === 'virtual' ? true
      : ev.format === 'in_person' ? false
      : isWebinar;

    // For a webinar the link IS the event, so it belongs in stream_url where
    // EventDetailScreen's "Join stream" CTA reads it — not buried in prose.
    const description = [
      (ev.description ?? '').slice(0, 3800),
      ev.event_url && !eventIsWebinar ? `\n\nDetails & tickets: ${ev.event_url}` : '',
    ].join('');

    // ends_at is NOT NULL. Prefer the page's own end time; fall back to a
    // 90-minute block so an event that only states a start still ingests.
    const parsedEnd = ev.ends_at ? Date.parse(ev.ends_at) : NaN;
    const endsAt = Number.isFinite(parsedEnd) && parsedEnd > starts
      ? new Date(parsedEnd).toISOString()
      : new Date(starts + DEFAULT_DURATION_MS).toISOString();

    // Two table CHECKs will reject a row outright rather than degrade it, and
    // the RPC surfaces that only as a console line. Satisfy them here:
    //   webinar_has_url    — type='webinar' REQUIRES stream_url
    //   local_has_location — type='local' REQUIRES venue_name (location is
    //                        already covered by the RPC's Null-Island sentinel)
    //
    // Plenty of real virtual groups publish no per-event link: La Leche League
    // emails the Zoom link on request, so the listing page IS the join
    // instruction. Dropping those would discard some of the best free
    // postpartum sources we have, so fall back to the source page — it always
    // tells her how to actually get in.
    const streamUrl = eventIsWebinar ? (ev.event_url ?? url) : null;
    // The hosting org is a truthful venue when the page names no other.
    const venueName = ev.venue_name ?? (eventIsWebinar ? null : feed.partner_name);

    const { data: idData, error } = await supabase.rpc('upsert_ingested_event', {
      p_source_feed_id: feed.id,
      p_source_uid: uid,
      p_type: eventIsWebinar ? 'webinar' : 'local',
      p_title: ev.title.slice(0, 200),
      p_description: description,
      p_host_name: feed.partner_name,
      p_host_avatar_url: feed.partner_avatar_url,
      p_is_partner: feed.is_partner,
      p_starts_at: new Date(starts).toISOString(),
      p_ends_at: endsAt,
      p_timezone: feed.default_timezone,
      p_age_tags: feed.default_age_tags,
      p_venue_name: venueName,
      p_address: ev.address,
      p_city: feed.default_city,
      p_lat: null,
      p_lng: null,
      p_stream_url: streamUrl,
      p_platform: eventIsWebinar ? 'other' : null,
      // is_free true ONLY for an explicit free signal. Both 'paid' and
      // 'unknown' write false, which is what the screener gate keys on.
      p_is_free: ev.cost === 'free',
      p_price_cents: ev.cost === 'paid' ? (ev.price_cents ?? null) : null,
    });
    if (error || !idData) {
      console.error(`[events-harvest] upsert failed ${feed.partner_name}/${uid}:`, error?.message);
      skipped.push({ title: ev.title, reason: `upsert: ${error?.message ?? 'no_id'}` });
      continue;
    }
    upserted++;
    // Geocode first so the screen pass sees a real location.
    await invokeEdge('events-geocode', { mode: 'event', event_id: idData });
    await invokeEdge('ai-event-screen', { mode: 'event', event_id: idData });
  }
  if (skipped.length) {
    console.error(`[events-harvest] ${feed.partner_name} skipped ${skipped.length}:`, JSON.stringify(skipped));
  }
  return { found: events.length, upserted, rendered, skipped: skipped.length };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));

    // Dry-run vetting. body.probe = { url, timezone? }. Fetches, renders if
    // needed, extracts, and RETURNS the events without touching the registry
    // or the events table.
    //
    // Registering a URL blind is how a source silently yields nothing forever:
    // a JS-rendered page registers "successfully" and just never produces a
    // row. Probe first, register what actually parses.
    if (body.probe?.url) {
      const url = String(body.probe.url);
      const tz = body.probe.timezone ?? 'America/New_York';
      let direct = '';
      let directErr: string | null = null;
      try {
        direct = await fetchDirect(url);
      } catch (e) {
        directErr = e instanceof Error ? e.message : String(e);
      }

      let events: HarvestedEvent[] = [];
      if (direct.length >= MIN_PAGE_TEXT) {
        events = await extractEvents(direct, tz, 'probe');
      }
      let rendered = false;
      if (events.length === 0) {
        const renderedText = await fetchRendered(url);
        if (renderedText) {
          rendered = true;
          events = await extractEvents(renderedText, tz, 'probe');
        }
      }

      return json({
        ok: true,
        url,
        direct_text_chars: direct.length,
        direct_error: directErr,
        needs_render: rendered,
        harvestable: events.length > 0,
        found: events.length,
        events,
      });
    }

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

        // A run that extracts nothing is a FAILURE, not a success. Previously
        // this reset consecutive_failures unconditionally, so a source that
        // yields zero forever (JS-rendered page, site redesign, venue stopped
        // publishing) recorded `harvested 0/0` and read as permanently healthy.
        // That is the state that let Villie Plans empty out unnoticed.
        // By this point the render fallback has already been tried, so zero
        // here means genuinely nothing to harvest.
        if (r.found === 0) {
          const failures = (feed.consecutive_failures ?? 0) + 1;
          const patch: Record<string, unknown> = {
            last_synced_at: new Date().toISOString(),
            last_sync_status: 'yielded 0 events',
            consecutive_failures: failures,
          };
          if (failures >= 3) patch.is_active = false;
          await supabase.from('events_partner_feeds').update(patch).eq('id', feed.id);
        } else {
          await supabase.from('events_partner_feeds').update({
            last_synced_at: new Date().toISOString(),
            last_sync_status: `harvested ${r.upserted}/${r.found}${r.rendered ? ' (rendered)' : ''}${r.skipped ? ` · ${r.skipped} skipped` : ''}`,
            consecutive_failures: 0,
          }).eq('id', feed.id);
        }
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
