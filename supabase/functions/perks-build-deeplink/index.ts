// V4 Phase G3 — perks-build-deeplink
// Converts an affiliate_url_template + subid into a network-specific click URL.
//
// ⚠️  STUB — current MVP resolves deeplinks inside the `claim_perk` SQL function.
// This Edge Function exists so we can shift resolution off-DB when we sign real
// affiliate contracts (each network has different SubID param names + macros).
//
// Networks:
//   - impact:     ?subId1={subid}
//   - shareasale: ?u=<affiliateId>&afftrack={subid}
//   - cj:         ?sid={subid}
//   - direct / none: returns direct_url unmodified
//
// POST /functions/v1/perks-build-deeplink
// Body: { deal_id: string }
// Returns: { click_url: string, subid: string }

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Network = 'impact' | 'shareasale' | 'cj' | 'direct' | 'none';

function buildUrl(network: Network, template: string | null, direct: string | null, subid: string): string | null {
  if (!template && !direct) return null;
  if (network === 'none' || network === 'direct') return direct ?? template ?? null;

  const base = template ?? direct;
  if (!base) return null;

  // Replace {subid} placeholder if present; otherwise append network-specific param.
  if (base.includes('{subid}')) return base.replace('{subid}', encodeURIComponent(subid));

  const sep = base.includes('?') ? '&' : '?';
  const param =
    network === 'impact'      ? `subId1=${encodeURIComponent(subid)}` :
    network === 'shareasale'  ? `afftrack=${encodeURIComponent(subid)}` :
    network === 'cj'          ? `sid=${encodeURIComponent(subid)}` :
    `subid=${encodeURIComponent(subid)}`;

  return `${base}${sep}${param}`;
}

function generateSubid(userId: string, dealId: string): string {
  // Short, opaque, stable-per-click. Upstream may dedupe on this.
  const rand = crypto.getRandomValues(new Uint8Array(6));
  const tail = Array.from(rand).map((b) => b.toString(16).padStart(2, '0')).join('');
  const prefix = `${userId.slice(0, 8)}_${dealId.slice(0, 8)}`;
  return `v_${prefix}_${tail}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    const { deal_id } = await req.json();
    if (!deal_id) {
      return new Response(JSON.stringify({ error: 'deal_id required' }), {
        status: 400, headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    const { data: deal, error: dealErr } = await supabase
      .from('brand_deals')
      .select('affiliate_network, affiliate_url_template, direct_url, status')
      .eq('id', deal_id)
      .maybeSingle();

    if (dealErr || !deal || deal.status !== 'active') {
      return new Response(JSON.stringify({ error: 'deal not found or inactive' }), {
        status: 404, headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    const subid = generateSubid(user.id, deal_id);
    const click_url = buildUrl(
      deal.affiliate_network as Network,
      deal.affiliate_url_template,
      deal.direct_url,
      subid,
    );

    return new Response(JSON.stringify({ click_url, subid }), {
      headers: { ...CORS, 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'content-type': 'application/json' },
    });
  }
});
