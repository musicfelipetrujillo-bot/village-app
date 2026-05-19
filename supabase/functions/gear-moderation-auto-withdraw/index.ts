// V4 Gear · Moderation auto-withdraw (cron wrapper)
//
// Thin wrapper around the auto_withdraw_p0_overdue_listings() RPC defined in
// migration 063. The RPC does all the work — withdraws P0-overdue listings,
// writes admin_audit_log rows, posts system messages to existing threads.
// This edge function exists only so the GH Action cron workflow has an HTTP
// endpoint to hit on the every-15-min schedule (the workflow invokes edge
// functions, not raw RPCs).
//
// Migration 063 also registers this on pg_cron with the same schedule, so
// once we upgrade past Supabase Free Tier (where pg_cron HTTP callouts are
// GUC-locked), the cron continues to fire regardless of GH Action presence.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// JWT-decode based auth. See gear-moderation-pager for the rationale —
// strict-equality against SERVICE_ROLE_KEY was brittle to key rotation +
// whitespace in the GH Action repo secret. verify_jwt: true at the gateway
// validates signature; this function just confirms role=service_role.
function isServiceRoleRequest(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const token = match[1].trim();
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return false;
    const normalized = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const payload = JSON.parse(atob(padded));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (!isServiceRoleRequest(req)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc('auto_withdraw_p0_overdue_listings');

  if (error) {
    console.error('[gear-moderation-auto-withdraw] rpc failed', error);
    return new Response(JSON.stringify({ error: 'rpc_failed', detail: error.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // RPC returns INTEGER (count of listings withdrawn).
  const withdrawn = typeof data === 'number' ? data : 0;
  return new Response(JSON.stringify({ ok: true, withdrawn }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
