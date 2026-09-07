import { getCallerUserId } from '../_shared/user-auth.ts';
import { consumeQuota, tooManyRequests } from '../_shared/rate-limit.ts';

// Village agents bridge — /triage
// POST /functions/v1/agents-triage
//
// Body shape (AgentRequest) — see packages/agents-client/src/schemas.ts:
//   { raw_input, source, related_project?, current_context?,
//     active_projects?, approved_for_planning?, validation_notes?, open_issues? }
//
// Returns the runtime's full AgentResponse envelope verbatim, with two
// safety rules enforced at this layer:
//   1. raw_input + source are required (cheap guard before hitting runtime).
//   2. Any non-2xx or network error is normalised into { ok:false, error, detail }
//      so mobile never has to branch on transport vs. business failure.
//
// This function is INTENTIONALLY dumb: it does not mutate any DB row, does
// not create tickets, does not surface anything into public user flows.
// Per RISK_AND_BOUNDARIES.md — runtime output is advisory until a human
// reviews it in the internal console.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AgentRequest = {
  raw_input?: string;
  source?: string;
  related_project?: string | null;
  current_context?: string | null;
  active_projects?: string[];
  approved_for_planning?: boolean;
  validation_notes?: string;
  open_issues?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  // AUTH (2026-09-05): the header above claimed "Callers must be authenticated
  // (Supabase verifies JWT by default)". That premise is wrong, and it is the
  // reason this whole class of function was unguarded: `verify_jwt` proves only
  // that the bearer is signed by this project's JWT secret, and the anon
  // publishable key IS such a token — it ships inside the mobile bundle. So the
  // bridge to the internal agent runtime was reachable by anyone holding it.
  const callerId = await getCallerUserId(req);
  if (!callerId) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Per-user quota (migration 135 + _shared/rate-limit.ts). The gate above says
  // WHO is calling; this says HOW MUCH they may have. Without it one real account
  // could loop this endpoint and bill Villie without limit. Decided atomically in
  // SQL, so concurrent requests cannot all pass the same check. Fails OPEN on a
  // ledger error — this is a cost control, and a DB blip must not block a mother
  // mid-flow.
  const quota = await consumeQuota(callerId, 'agents-triage');
  if (!quota.allowed) return tooManyRequests(quota, CORS);

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: 'method_not_allowed' }),
      { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  let body: AgentRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'invalid_json', detail: 'Body was not valid JSON.' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  if (!body?.raw_input || !body?.source) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'invalid_request',
        detail: 'raw_input and source are required.',
      }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  const base = Deno.env.get('AGENT_BASE_URL');
  if (!base) {
    return new Response(
      JSON.stringify({ ok: false, error: 'runtime_not_configured', detail: 'AGENT_BASE_URL is not set' }),
      { status: 503, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  const secret = Deno.env.get('AGENTS_BRIDGE_SECRET');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['x-agents-secret'] = secret;

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/triage`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'runtime_http_error',
          detail: (data as any)?.detail ?? `HTTP ${res.status}`,
        }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify(data ?? { ok: false, error: 'empty_response' }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'runtime_unreachable',
        detail: err instanceof Error ? err.message : String(err),
      }),
      { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
