// Edge Function: admin-compliance-events
// POST /functions/v1/admin-compliance-events
// Body: {
//   source?: 'gear' | 'milk' | 'all',   // default 'all'
//   event_name?: string,                 // exact match (e.g. 'gear_cpsc_block_shown')
//   user_id?: string,                    // filter to one actor
//   since?: string,                      // ISO timestamp lower bound (inclusive)
//   until?: string,                      // ISO timestamp upper bound (inclusive)
//   limit?: number,                      // default 200, max 1000
//   offset?: number,                     // default 0
//   format?: 'json' | 'csv'              // default 'json'
// }
// Auth: service-role bearer token only (admin-only — never called from mobile).
//
// Surface for audit / compliance reviews of `gear_analytics_events` +
// `milk_analytics_events`. The CPSIA §19 enforcement defense relies on
// being able to demonstrate the platform showed and recorded the recall
// hard-block; FDUTPA review for milk relies on legal-acceptance + dispute
// trails. Both tables are RLS-locked to service role + own-insert; this
// function is the only read path outside direct DB access.
//
// Every call writes itself into admin_audit_log so the access is itself
// auditable (defensible chain of custody — who pulled what, when).
//
// Pagination is offset/limit (not cursor) because callers will typically
// be exporting filtered slices for legal review, not infinite-scrolling.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 200;

interface EventRow {
  id: number;
  user_id: string | null;
  event_name: string;
  properties: Record<string, unknown> | null;
  occurred_at: string;
  source: 'gear' | 'milk';
}

// CSV export — used when legal pulls slices for outside counsel. Quotes any
// field containing comma/quote/newline; doubles internal quotes per RFC 4180.
function toCsv(rows: EventRow[]): string {
  const header = ['id', 'source', 'occurred_at', 'user_id', 'event_name', 'properties'];
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([r.id, r.source, r.occurred_at, r.user_id ?? '', r.event_name, escape(r.properties)].map(escape).join(','));
  }
  return lines.join('\n');
}

async function queryTable(
  table: 'gear_analytics_events' | 'milk_analytics_events',
  filters: { event_name?: string; user_id?: string; since?: string; until?: string; limit: number; offset: number },
): Promise<EventRow[]> {
  let q = supabase
    .from(table)
    .select('id, user_id, event_name, properties, occurred_at')
    .order('occurred_at', { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);

  if (filters.event_name) q = q.eq('event_name', filters.event_name);
  if (filters.user_id)   q = q.eq('user_id', filters.user_id);
  if (filters.since)     q = q.gte('occurred_at', filters.since);
  if (filters.until)     q = q.lte('occurred_at', filters.until);

  const { data, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  const source: 'gear' | 'milk' = table === 'gear_analytics_events' ? 'gear' : 'milk';
  return (data ?? []).map((r) => ({ ...(r as Omit<EventRow, 'source'>), source }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // Service-role gate — same posture as admin-approve-specialist.
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (token !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    let body: {
      source?: 'gear' | 'milk' | 'all';
      event_name?: string;
      user_id?: string;
      since?: string;
      until?: string;
      limit?: number;
      offset?: number;
      format?: 'json' | 'csv';
      performed_by?: string;
    } = {};
    try { body = await req.json(); } catch { /* body is optional */ }

    const source = body.source ?? 'all';
    if (!['gear', 'milk', 'all'].includes(source)) {
      return new Response(JSON.stringify({ error: `invalid source: ${source}` }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    const limit  = Math.min(Math.max(body.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(body.offset ?? 0, 0);
    const format = body.format ?? 'json';

    const filters = { event_name: body.event_name, user_id: body.user_id, since: body.since, until: body.until, limit, offset };

    let rows: EventRow[] = [];
    if (source === 'all') {
      // Union both tables, then re-sort + re-trim. We over-fetch each side at
      // limit+offset so the final slice is still globally correct after merge.
      const gearLim = { ...filters, limit: limit + offset, offset: 0 };
      const milkLim = { ...filters, limit: limit + offset, offset: 0 };
      const [gear, milk] = await Promise.all([
        queryTable('gear_analytics_events', gearLim),
        queryTable('milk_analytics_events', milkLim),
      ]);
      rows = [...gear, ...milk]
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
        .slice(offset, offset + limit);
    } else {
      const table = source === 'gear' ? 'gear_analytics_events' : 'milk_analytics_events';
      rows = await queryTable(table, filters);
    }

    // Audit the audit — record who pulled what so the chain of custody is
    // itself in admin_audit_log. `performed_by` should be set by the caller
    // (admin email / runbook ID); falls back to 'system' for cron / unspecified.
    await supabase.from('admin_audit_log').insert({
      action: 'export_compliance_events',
      target_table: source === 'all' ? 'gear+milk_analytics_events' : (source === 'gear' ? 'gear_analytics_events' : 'milk_analytics_events'),
      target_id: '00000000-0000-0000-0000-000000000000',  // not row-scoped; satisfies NOT NULL
      performed_by: body.performed_by ?? 'system',
      metadata: {
        filters: {
          event_name: body.event_name ?? null,
          user_id:    body.user_id ?? null,
          since:      body.since ?? null,
          until:      body.until ?? null,
          limit, offset, format, source,
        },
        returned: rows.length,
      },
    });

    if (format === 'csv') {
      return new Response(toCsv(rows), {
        headers: {
          ...CORS,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="compliance-events-${source}-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return new Response(
      JSON.stringify({ source, limit, offset, count: rows.length, events: rows }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
