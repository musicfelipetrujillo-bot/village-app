// Per-user quota for model-backed and paid-third-party edge functions.
//
// WHY (security audit 2026-09-04, batch 5 scope boundary → batch 7):
// Gating these endpoints behind a signed-in user closed ANONYMOUS abuse — they are
// no longer reachable with the publishable anon key that ships in the mobile
// bundle. It did not close per-account abuse: one real account looping
// `gear-vision-identify` in a shell script still bills Villie for unbounded Haiku
// multimodal calls. A gate answers "who is this"; a quota answers "how much may
// they have". Both are needed.
//
// The counting and the limit decision live in SQL (`consume_ai_quota`, migration
// 135), not here, because they must be ATOMIC. A read-then-write in this file
// would be a TOCTOU race: N concurrent requests all read the same count and all
// pass. The SQL does decide-and-increment in one statement under a row lock —
// verified at 40 concurrent callers against a limit of 10, which admitted exactly
// 10.
//
// Counterpart modules: `service-role.ts` (is this the cron?), `user-auth.ts`
// (which user is this?), and this (how much may that user have?).

import { createClient } from 'jsr:@supabase/supabase-js@2.115.0';

import { secretKey } from './keys.ts';
/** Per-hour call budgets, keyed by edge-function name.
 *
 *  Sizing principle: comfortably above the busiest REAL session, low enough that
 *  a script is stopped early. These are cost controls, so erring generous is
 *  correct — a limit that interrupts an exhausted mother mid-flow is a worse
 *  failure than a few hundred wasted Haiku calls.
 *
 *  Multimodal (vision) endpoints are the expensive ones and are set tighter.
 *  `milk-questionnaire-coach` is deliberately high: the donor questionnaire is
 *  ~12 questions and coaches EACH answer, so one honest sitting is already a
 *  dozen calls, and she may revise.
 */
export const HOURLY_LIMITS: Record<string, number> = {
  // Vision / multimodal — most expensive per call.
  'gear-vision-identify': 20,
  'milk-vault-scan': 20,

  // Text generation.
  'ai-profile-qa': 40,
  'ai-followup-questions': 40,
  'ai-triage': 30,
  'ai-translate': 60,
  'ai-match': 30,
  'ai-daily-checkin': 20,
  'milk-donor-qa': 30,
  'milk-trust-narrative': 20,
  'milk-questionnaire-coach': 80,
  'milk-match-donors': 30,
  'room-alias-generate': 15,
  'room-auto-match': 20,
  'room-icebreaker': 20,

  // Expensive server-side fan-out (a full feed re-curation per call).
  'home-feed-curator': 10,

  // Paid third-party APIs rather than an LLM, but the same "someone else's
  // metered account" problem.
  'geocode-zip': 30,
  'daycares-nearby': 60,
  'gear-upc-lookup': 60,
  'gear-cpsc-check': 60,

  // Internal bridge — no public flow reaches it; a low ceiling is plenty.
  'agents-run': 30,
  'agents-triage': 30,
  'agents-health': 60,
};

const WINDOW_SECONDS = 3600;

let cachedAdmin: ReturnType<typeof createClient> | null = null;
function admin() {
  if (!cachedAdmin) {
    cachedAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      secretKey(),
      { auth: { persistSession: false } },
    );
  }
  return cachedAdmin;
}

/** Shape returned by the `consume_ai_quota` RPC (migration 135). */
interface QuotaRow {
  allowed?: boolean;
  remaining?: number;
  retry_after_seconds?: number;
}

export interface QuotaResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Records one call against `userId`'s budget for `fn` and reports whether it was
 * allowed. Call it AFTER establishing the caller from a verified JWT
 * (`getCallerUserId`) and BEFORE doing the expensive work.
 *
 * FAIL-OPEN, deliberately. If the ledger itself errors — DB unreachable, RPC
 * missing because the migration has not been applied yet — this returns
 * `allowed: true` and logs loudly. The reasoning: this is a COST control, not a
 * safety control, and the alternative is that a transient database problem
 * silently blocks a postpartum mother from her check-in reply or her Manual. An
 * attacker cannot usefully induce this state (they would need to break the
 * database, at which point the quota is not what is protecting you), whereas a
 * routine DB blip would otherwise become a user-visible outage.
 *
 * Note the asymmetry with `service-role.ts`, which fails CLOSED: that one decides
 * whether someone may act at all. Different question, different default.
 */
export async function consumeQuota(
  userId: string,
  fn: string,
  limit = HOURLY_LIMITS[fn],
  windowSeconds = WINDOW_SECONDS,
): Promise<QuotaResult> {
  if (!limit) {
    // No budget configured for this function — treat as unlimited rather than
    // guessing a number. Surfacing it in logs so a new endpoint added without a
    // limit is noticed rather than silently uncapped.
    console.warn(`[rate-limit] no HOURLY_LIMITS entry for "${fn}" — not limited`);
    return { allowed: true, remaining: -1, retryAfterSeconds: 0 };
  }
  try {
    // The client is created without generated Database types, so supabase-js
    // resolves an unknown RPC name to `never` and its args to `undefined`.
    // Describing the one call we make keeps the row shape checked below rather
    // than falling back to `any` for the whole result.
    const rpc = admin().rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: QuotaRow | QuotaRow[] | null; error: unknown }>;
    const { data, error } = await rpc('consume_ai_quota', {
      p_user_id: userId,
      p_fn: fn,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('consume_ai_quota returned no row');
    return {
      allowed: row.allowed === true,
      remaining: row.remaining ?? 0,
      retryAfterSeconds: row.retry_after_seconds ?? WINDOW_SECONDS,
    };
  } catch (e) {
    console.error(
      `[rate-limit] quota check FAILED OPEN for ${fn}/${userId}:`,
      e instanceof Error ? e.message : String(e),
    );
    return { allowed: true, remaining: -1, retryAfterSeconds: 0 };
  }
}

/**
 * Standard 429 for a refused call. `Retry-After` is a real HTTP header clients
 * and proxies already understand, so the mobile app can back off correctly
 * instead of parsing an error string.
 */
export function tooManyRequests(
  quota: QuotaResult,
  cors: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: 'rate_limited',
      retry_after_seconds: quota.retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        'Retry-After': String(quota.retryAfterSeconds),
      },
    },
  );
}
