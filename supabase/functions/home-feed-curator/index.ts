// V4 Phase G7 — Home feed curator (orchestrator).
// POST /functions/v1/home-feed-curator
// Modes:
//   { mode: "batch" }                  — cron: refresh all active users
//   { mode: "single", user_id: "..." } — on-demand refresh for one user (mobile fallback)
// Returns: { refreshed: number, results: [...] }
//
// Assembles up to 6 cards into home_feed_cache.cards (JSONB) per user:
//   1. milestone        (from milestone_library for the user's current week)
//   2. checkin          (daily_checkins status — pending / answered / crisis)
//   3. events           (PostGIS near + AI relevance rank, top 2)
//   4. perks            (ai-perk-recommender top 3)
//   5. gear_tip         (ai-gear-tip single tip)
//   6. quickaccess      (static 4-button grid: Milk, Experts, Gear, Community)
//
// Called via pg_cron daily + via mobile `refreshHomeFeed` when cache is stale.
// Fails-soft per card: a broken sub-call returns a null card, the feed still ships.

// AUTH (2026-09-04): this function had no authorization of any kind, while running
// entirely on the service-role client below. `verify_jwt = true` does not help —
// the anon publishable key ships in the mobile bundle and satisfies the gateway.
// Two distinct holes followed:
//   * `{"mode":"batch"}` — fleet-wide re-curation on demand: a fan-out of Haiku
//     calls per active user, billable by anyone who asks.
//   * `{"mode":"single","user_id":"<anyone>"}` — an IDOR. `user_id` came straight
//     off the body and was never checked against the caller, so any request could
//     regenerate and OVERWRITE another user's home_feed_cache row.
//
// The gate has to be two-sided because this function has two legitimate callers:
// pg_cron / GH Actions (service role, batch) and the mobile app's refreshHomeFeed
// (a signed-in user refreshing her own feed, api/home.ts:257). So:
//   batch  → service role only.
//   single → service role for any user_id; otherwise a valid user JWT, and the
//            target is forced to that caller's own id. A body user_id naming
//            someone else is refused rather than silently retargeted, so a buggy
//            client fails loudly instead of appearing to work.
import { createClient } from 'jsr:@supabase/supabase-js@2.115.0';
import { isServiceRoleRequest } from '../_shared/service-role.ts';
import { getCallerUserId } from '../_shared/user-auth.ts';

import { consumeQuota, tooManyRequests } from '../_shared/rate-limit.ts';

import { secretKey } from '../_shared/keys.ts';
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  secretKey(),
);
const FN_BASE = Deno.env.get('SUPABASE_URL')! + '/functions/v1';
const SERVICE_KEY = secretKey();
const CURATOR_VERSION = 'v1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callFn(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${FN_BASE}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return await res.json();
}

interface HomeUser {
  user_id: string;
  current_week_number: number | null;
  feeding_method: string | null;
  pregnancy_stage: string | null;
}

async function buildMilestoneCard(weekNum: number | null) {
  if (weekNum == null) return null;
  const { data } = await supabase
    .from('milestone_library')
    .select('week_number, category, title, description, hero_emoji, ai_summary_cache')
    .eq('week_number', weekNum)
    .order('category', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    block: 'milestone',
    priority: 100,
    payload: {
      week_number: data.week_number,
      title: data.title,
      description: data.description,
      hero_emoji: data.hero_emoji,
      // If the Sunday cron has filled ai_summary_cache, surface that for the
      // milestone detail link preview; else fall back to the seed description.
      long_copy: data.ai_summary_cache ?? null,
    },
  };
}

async function buildCheckinCard(userId: string) {
  const { data } = await supabase
    .from('daily_checkins')
    .select('id, mood_score, ai_reply, crisis_flagged, created_at')
    .eq('user_id', userId)
    .eq('checkin_date', new Date().toISOString().slice(0, 10))
    .maybeSingle();
  return {
    block: 'checkin',
    priority: 90,
    payload: data
      ? {
          state: data.crisis_flagged ? 'crisis' : 'answered',
          mood_score: data.mood_score,
          preview: (data.ai_reply ?? '').slice(0, 160),
        }
      : { state: 'pending' },
  };
}

async function buildEventsCard(userId: string) {
  // Rely on list_events_near w/ 50mi + next 30d; falls back to plain upcoming if geo unknown.
  const { data: nearby } = await supabase.rpc('list_events_near', {
    p_lat: null, p_lng: null, p_radius_km: 80, p_limit: 12,
  });
  const candidateIds = (nearby ?? []).map((e: { id: string }) => e.id);
  if (candidateIds.length === 0) return null;

  const ranked = await callFn('ai-event-relevance', {
    user_id: userId, candidate_event_ids: candidateIds, limit: 2,
  });
  const pickedIds: string[] = (ranked?.ranked ?? []).map((r: { event_id: string }) => r.event_id);
  if (pickedIds.length === 0) return null;

  return {
    block: 'events',
    priority: 70,
    payload: {
      event_ids: pickedIds,
      reasons: Object.fromEntries(
        (ranked?.ranked ?? []).map((r: { event_id: string; reason: string }) => [r.event_id, r.reason]),
      ),
    },
  };
}

async function buildPerksCard(userId: string) {
  const ranked = await callFn('ai-perk-recommender', { user_id: userId, limit: 3 });
  const items: Array<{ deal_id: string; reason: string }> = ranked?.ranked ?? [];
  if (items.length === 0) return null;
  return {
    block: 'perks',
    priority: 60,
    payload: { items },
  };
}

async function buildGearTipCard(userId: string) {
  const res = await callFn('ai-gear-tip', { user_id: userId });
  if (!res?.tip) return null;
  return {
    block: 'gear_tip',
    priority: 50,
    payload: { tip: res.tip, category_hint: res.category_hint ?? null },
  };
}

function buildQuickAccessCard() {
  return {
    block: 'quickaccess',
    priority: 40,
    payload: {
      items: [
        { key: 'milk',    label: 'Milk Connect', icon: '🤱', deeplink: 'village://milk' },
        { key: 'experts', label: 'Experts',      icon: '🩺', deeplink: 'village://experts' },
        { key: 'gear',    label: 'Gear',         icon: '🛒', deeplink: 'village://gear' },
        { key: 'help',    label: 'Ask Villie',   icon: '💬', deeplink: 'village://help' },
      ],
    },
  };
}

async function curateFor(user: HomeUser) {
  const cards = (
    await Promise.all([
      buildMilestoneCard(user.current_week_number).catch(() => null),
      buildCheckinCard(user.user_id).catch(() => null),
      buildEventsCard(user.user_id).catch(() => null),
      buildPerksCard(user.user_id).catch(() => null),
      buildGearTipCard(user.user_id).catch(() => null),
      Promise.resolve(buildQuickAccessCard()),
    ])
  ).filter((c) => c != null);

  cards.sort((a: any, b: any) => (b.priority ?? 0) - (a.priority ?? 0));

  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  await supabase
    .from('home_feed_cache')
    .upsert({
      user_id: user.user_id,
      cards,
      generated_at: new Date().toISOString(),
      expires_at: expiresAt,
      generator_version: CURATOR_VERSION,
      model_used: 'haiku+sonnet-mixed',
    });
  return cards.length;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const mode: string = body?.mode ?? 'batch';

    // gatewayVerifiesJwt: true matches `[functions.home-feed-curator] verify_jwt = true`
    // in supabase/config.toml. Keep the two in sync.
    const isService = isServiceRoleRequest(req, { gatewayVerifiesJwt: true });

    // Batch is the fleet-wide LLM fan-out — cron only, no user has any business
    // triggering it. Note `mode` defaults to 'batch', so this also covers a bare
    // `{}` body, which is exactly what the cron sends.
    if (mode !== 'single' && !isService) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (mode === 'single') {
      let userId: string | null = body?.user_id ?? null;

      if (!isService) {
        // Not the cron ⇒ must be a signed-in user, and she may only refresh
        // herself. This is the fix for the IDOR: previously `user_id` was taken
        // on trust, letting any caller overwrite any user's cached feed.
        const caller = await getCallerUserId(req);
        if (!caller) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
          });
        }
        if (userId && userId !== caller) {
          return new Response(JSON.stringify({ error: 'forbidden' }), {
            status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
          });
        }
        userId = caller;

        // Per-user quota (migration 135) — USER path only; the nightly batch runs
        // as service role and must not be throttled. A single 'single' call fans
        // out to several model endpoints to rebuild one feed, so this is one of
        // the more expensive things a client can ask for: 10/hr, well above the
        // stale-cache refresh the app actually performs.
        const quota = await consumeQuota(caller, 'home-feed-curator');
        if (!quota.allowed) return tooManyRequests(quota, CORS);
      }

      if (!userId) {
        return new Response(JSON.stringify({ error: 'user_id required for single mode' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      // Pull the one-user shape we need.
      const { data: bpw } = await supabase
        .from('baby_profiles_with_week')
        .select('current_week_number, feeding_method')
        .eq('user_id', userId).maybeSingle();
      const { data: u } = await supabase
        .from('users').select('pregnancy_stage').eq('id', userId).maybeSingle();

      const count = await curateFor({
        user_id: userId,
        current_week_number: bpw?.current_week_number ?? null,
        feeding_method: bpw?.feeding_method ?? null,
        pregnancy_stage: u?.pregnancy_stage ?? null,
      });
      return new Response(JSON.stringify({ refreshed: 1, cards: count }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Batch mode — cron driver.
    const { data: activeUsers, error } = await supabase
      .rpc('list_active_home_users', { p_limit: 500 });
    if (error) throw error;

    let refreshed = 0;
    for (const u of (activeUsers ?? []) as HomeUser[]) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await curateFor(u);
        refreshed += 1;
      } catch (_e) { /* skip this user */ }
    }
    return new Response(JSON.stringify({ refreshed }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
