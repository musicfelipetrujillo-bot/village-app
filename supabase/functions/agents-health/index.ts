// Village agents bridge — /health
// GET /functions/v1/agents-health
//
// Thin proxy over the starter agent runtime's GET /health endpoint.
// Exists so mobile never learns AGENT_BASE_URL and so we can gate access
// behind a server-side shared secret.
//
// Env:
//   AGENT_BASE_URL        — e.g. http://host.docker.internal:8000 (local) or prod URL
//   AGENTS_BRIDGE_SECRET  — optional shared secret forwarded to the runtime as x-agents-secret
//
// Security posture (INTERNAL-ONLY):
//   - Callers must be authenticated (Supabase verifies JWT by default).
//   - No RLS bypass, no DB mutation. This function ONLY proxies.
//   - Responds 503 if AGENT_BASE_URL is unset so a dev without the runtime
//     can't accidentally think the pipe is wired.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
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
    const res = await fetch(`${base.replace(/\/$/, '')}/health`, {
      method: 'GET',
      headers,
      // Runtime should answer health checks fast; guard against hangs.
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json().catch(() => null);
    return new Response(JSON.stringify(data ?? { ok: res.ok }), {
      status: res.ok ? 200 : 502,
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
