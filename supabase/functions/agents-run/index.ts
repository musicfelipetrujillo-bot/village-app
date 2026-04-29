// Village agents bridge — /run
// POST /functions/v1/agents-run
//
// Identical safety posture to agents-triage. Separate function because the
// upstream runtime exposes two distinct endpoints (triage vs. planning-run)
// and the mobile console needs to be able to address each one explicitly.
//
// NOTE: /run is the planning mode (approved_for_planning=true scenarios).
// Even so, this bridge does NOT auto-apply any runtime output to Village
// state. Results are displayed in the internal console for human review.

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
    const res = await fetch(`${base.replace(/\/$/, '')}/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      // Planning runs can take longer than triage.
      signal: AbortSignal.timeout(60000),
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
