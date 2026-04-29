// V4 G2 — AI event screening (Pass 2 of self-sustaining events ingest).
// POST /functions/v1/ai-event-screen
//
// Body modes:
//   { mode: 'all', limit?: number }                  ← cron, default 50
//   { mode: 'event', event_id: '<uuid>' }            ← single (post-ingest)
//
// What it does for each pending event:
//   1. Loads the event row + parent feed (if any) for trust signal
//   2. Asks Haiku to score (0..1) postpartum-mom relevance + suggest age_tags
//      + flag any safety concerns (sponsored/MLM/non-postpartum-relevant)
//   3. Writes back ingestion_confidence + suggested_age_tags + ingestion_notes
//   4. Auto-approves when confidence ≥ feed.auto_publish_threshold; flips
//      to 'rejected' when confidence < 0.55; otherwise leaves as 'pending'
//      for human review
//
// Posture:
//   - Service-role only. RLS doesn't apply but the function is gated on
//     bearer = service_role_key in the Supabase Function gateway.
//   - Fail-soft: any AI/parse error leaves the row as 'pending' so a human
//     can still approve it manually. We never auto-reject on AI failure.
//   - Prompt is cached (cache_control: 'ephemeral') — same pattern as
//     other AI edge functions in this repo.

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Must mirror migration 010's age_tags conventions. Adding a value here
// without an EditProfile filter chip is fine — the chips are derived from
// stage rather than this enum.
const VALID_AGE_TAGS = ['pregnancy', '0-3mo', '3-6mo', '6-12mo', '12mo+'] as const;
type AgeTag = (typeof VALID_AGE_TAGS)[number];

const SYSTEM_PROMPT = `You screen events for relevance to postpartum moms (0–12 months postpartum) and pregnant women in late stages.

## Goal
Return a JSON verdict that decides whether to publish this event to a maternal-health app.

## Score (0..1) on RELEVANCE to expecting & postpartum moms
- 1.0 = clearly maternal/baby/parent (lactation, baby class, postpartum yoga, support group)
- 0.7 = adjacent (general parent meetup, family-friendly storytime, prenatal fitness)
- 0.4 = tangential (general wellness, women's health beyond maternal scope)
- 0.0 = irrelevant or off-mission (adult-only nightlife, kid-of-school-age events, sales-only webinars)

## Reject (confidence stays low) when ANY of:
- Event is primarily a sales pitch / MLM recruitment
- Event title or description contains medical advice the platform shouldn't endorse
- Event targets school-age kids (3yr+) with no infant component
- Event appears to be a duplicate of another series the user would already see

## Suggest age_tags from this fixed set ONLY: pregnancy, 0-3mo, 3-6mo, 6-12mo, 12mo+
Pick the tags actually relevant. Use [] when unsure rather than guessing wide.

## Output JSON only — no prose, no markdown:
{
  "confidence": <number 0..1>,
  "suggested_age_tags": ["<tag>", ...],
  "rationale": "<one sentence, ≤120 chars>",
  "concerns": ["<short flag>", ...]   // empty array when none
}`;

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  type: 'local' | 'webinar';
  host_name: string;
  city: string | null;
  venue_name: string | null;
  starts_at: string;
  is_partner: boolean;
  source_feed_id: string | null;
}

interface FeedRow {
  id: string;
  partner_name: string;
  is_partner: boolean;
  auto_publish_threshold: number;
}

interface Verdict {
  confidence: number;
  suggested_age_tags: AgeTag[];
  rationale: string;
  concerns: string[];
}

interface ScreenResult {
  event_id: string;
  outcome: 'approved' | 'rejected' | 'pending' | 'skipped';
  confidence: number | null;
  reason: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const mode: 'all' | 'event' = body.mode === 'event' ? 'event' : 'all';

    let events: EventRow[] = [];
    if (mode === 'event') {
      if (!body.event_id) return json({ error: 'event_id required' }, 400);
      const { data, error } = await supabase
        .from('events')
        .select('id, title, description, type, host_name, city, venue_name, starts_at, is_partner, source_feed_id, review_status')
        .eq('id', body.event_id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'event not found' }, 404);
      if (data.review_status !== 'pending') {
        return json({ skipped: true, reason: `status=${data.review_status}` });
      }
      events = [data as EventRow];
    } else {
      const limit = Math.min(Math.max(body.limit ?? 50, 1), 200);
      const { data, error } = await supabase
        .from('events')
        .select('id, title, description, type, host_name, city, venue_name, starts_at, is_partner, source_feed_id')
        .eq('review_status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit);
      if (error) throw error;
      events = (data ?? []) as EventRow[];
    }

    // Preload feeds so we can apply per-feed thresholds. Most ingests share
    // a small set of feeds — one round-trip is cheaper than N.
    const feedIds = Array.from(new Set(events.map((e) => e.source_feed_id).filter(Boolean) as string[]));
    let feedMap = new Map<string, FeedRow>();
    if (feedIds.length > 0) {
      const { data: feeds } = await supabase
        .from('events_partner_feeds')
        .select('id, partner_name, is_partner, auto_publish_threshold')
        .in('id', feedIds);
      feedMap = new Map((feeds ?? []).map((f) => [f.id, f as FeedRow]));
    }

    const results: ScreenResult[] = [];
    for (const ev of events) {
      results.push(await screenOne(ev, feedMap));
    }

    return json({ mode, processed: results.length, results });
  } catch (err) {
    console.error('ai-event-screen fatal:', err);
    return json({ error: (err as Error).message }, 500);
  }
});

async function screenOne(ev: EventRow, feedMap: Map<string, FeedRow>): Promise<ScreenResult> {
  const feed = ev.source_feed_id ? feedMap.get(ev.source_feed_id) ?? null : null;
  const threshold = feed?.auto_publish_threshold ?? 0.85;

  const userPrompt = JSON.stringify({
    title: ev.title,
    description: (ev.description ?? '').slice(0, 1500),
    type: ev.type,
    host: ev.host_name,
    venue: ev.venue_name,
    city: ev.city,
    starts_at: ev.starts_at,
    is_partner: ev.is_partner,
    feed_partner_name: feed?.partner_name ?? null,
  });

  let verdict: Verdict;
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      temperature: 0.2,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    });
    const text = resp.content
      .map((c) => (c.type === 'text' ? c.text : ''))
      .join('')
      .trim();
    verdict = parseVerdict(text);
  } catch (err) {
    console.warn(`ai-event-screen failed ${ev.id}:`, (err as Error).message);
    // Fail-soft: leave the row pending so a human can review it. Do NOT
    // auto-reject — a flaky upstream shouldn't quietly drop real events.
    return {
      event_id: ev.id,
      outcome: 'pending',
      confidence: null,
      reason: 'ai_unavailable',
    };
  }

  const confidence = clamp01(verdict.confidence);
  const ageTags = (verdict.suggested_age_tags ?? []).filter(isValidAgeTag);
  const concerns = (verdict.concerns ?? []).slice(0, 5);
  const rationale = (verdict.rationale ?? '').slice(0, 200);

  const note = [
    `confidence=${confidence.toFixed(2)}`,
    rationale && `rationale=${rationale}`,
    concerns.length > 0 && `concerns=${concerns.join('|')}`,
    feed && `feed=${feed.partner_name}`,
  ].filter(Boolean).join(' · ');

  // Promotion logic
  let nextStatus: 'approved' | 'rejected' | 'pending';
  let outcome: ScreenResult['outcome'];
  if (confidence < 0.55) {
    nextStatus = 'rejected';
    outcome = 'rejected';
  } else if (confidence >= threshold) {
    nextStatus = 'approved';
    outcome = 'approved';
  } else {
    nextStatus = 'pending';
    outcome = 'pending';
  }

  const patch: Record<string, unknown> = {
    ingestion_confidence: confidence,
    suggested_age_tags: ageTags,
    ingestion_notes: note,
    review_status: nextStatus,
  };
  if (nextStatus === 'approved') {
    patch.auto_published_at = new Date().toISOString();
    // Apply suggested tags only if the row didn't have any. Manual curators
    // who set tags should not be overridden.
    if (ageTags.length > 0) {
      const { data: cur } = await supabase
        .from('events')
        .select('age_tags')
        .eq('id', ev.id)
        .maybeSingle();
      if (cur && (!cur.age_tags || cur.age_tags.length === 0)) {
        patch.age_tags = ageTags;
      }
    }
  }

  const { error: updateErr } = await supabase
    .from('events')
    .update(patch)
    .eq('id', ev.id)
    .eq('review_status', 'pending'); // prevent overwriting a concurrent human decision

  if (updateErr) {
    console.error(`patch failed ${ev.id}:`, updateErr.message);
    return { event_id: ev.id, outcome: 'skipped', confidence, reason: 'db_error' };
  }

  return { event_id: ev.id, outcome, confidence, reason: rationale || 'ok' };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
function parseVerdict(raw: string): Verdict {
  // Strip ```json fences if Haiku adds them (it usually doesn't with our
  // prompt, but the cost of being defensive is one regex).
  const stripped = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const obj = JSON.parse(stripped);
  return {
    confidence: typeof obj.confidence === 'number' ? obj.confidence : 0,
    suggested_age_tags: Array.isArray(obj.suggested_age_tags) ? obj.suggested_age_tags : [],
    rationale: typeof obj.rationale === 'string' ? obj.rationale : '',
    concerns: Array.isArray(obj.concerns) ? obj.concerns : [],
  };
}

function isValidAgeTag(t: unknown): t is AgeTag {
  return typeof t === 'string' && (VALID_AGE_TAGS as readonly string[]).includes(t);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
