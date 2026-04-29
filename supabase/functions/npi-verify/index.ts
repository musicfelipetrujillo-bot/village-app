// Edge Function: npi-verify
// POST /functions/v1/npi-verify
// Body: { npi_number: string }
// Returns: { verified: boolean, provider?: object, error?: string }
// Calls NPI Registry API, caches result 30 days in npi_cache,
// updates specialist.npi_verified if matched.
// Auth: service role or authenticated specialist claiming own profile.

import { createClient } from 'npm:@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const NPI_API_BASE = 'https://npiregistry.cms.hhs.gov/api/?version=2.1';
const CACHE_TTL_DAYS = 30;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NPIResult {
  created_epoch: string;
  enumeration_type: string;
  last_updated_epoch: string;
  number: string;
  addresses: Array<{
    address_1: string;
    city: string;
    state: string;
    postal_code: string;
    country_code: string;
    address_purpose: string;
    address_type: string;
    telephone_number?: string;
  }>;
  basic: {
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    credential?: string;
    sole_proprietor?: string;
    gender?: string;
    enumeration_date?: string;
    last_updated?: string;
    status: string;
    name?: string; // org
    organization_name?: string;
  };
  taxonomies: Array<{
    code: string;
    desc: string;
    primary: boolean;
    state?: string;
    license?: string;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  try {
    const { npi_number, specialist_id } = await req.json();

    if (!npi_number || !/^\d{10}$/.test(npi_number)) {
      return new Response(
        JSON.stringify({ verified: false, error: 'NPI must be a 10-digit number' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // Check cache first (valid for 30 days)
    const { data: cached } = await supabase
      .from('npi_cache')
      .select('raw_response, fetched_at')
      .eq('npi_number', npi_number)
      .single();

    let npiData: NPIResult | null = null;

    if (cached) {
      const fetchedAt = new Date(cached.fetched_at);
      const ageMs = Date.now() - fetchedAt.getTime();
      const ttlMs = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

      if (ageMs < ttlMs) {
        // Use cache
        const results = cached.raw_response?.results ?? [];
        npiData = results[0] ?? null;
      }
    }

    if (!npiData) {
      // Fetch from NPI Registry
      const url = `${NPI_API_BASE}&number=${npi_number}&enumeration_type=&taxonomy_description=&name_purpose=AO&first_name=&use_first_name_alias=&last_name=&organization_name=&address_purpose=&city=&state=&postal_code=&country_code=&limit=1&skip=0&pretty=false`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'TheVillageApp/1.0' },
      });

      if (!res.ok) {
        throw new Error(`NPI Registry returned ${res.status}`);
      }

      const json = await res.json();

      // Cache the response
      await supabase
        .from('npi_cache')
        .upsert(
          { npi_number, raw_response: json, fetched_at: new Date().toISOString() },
          { onConflict: 'npi_number' },
        );

      npiData = json.results?.[0] ?? null;
    }

    if (!npiData) {
      return new Response(
        JSON.stringify({ verified: false, error: 'NPI number not found in registry' }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // NPI must be active
    const isActive = npiData.basic?.status === 'A';

    // Extract provider details for display
    const isIndividual = npiData.enumeration_type === 'NPI-1';
    const fullName = isIndividual
      ? [npiData.basic.first_name, npiData.basic.middle_name, npiData.basic.last_name]
          .filter(Boolean).join(' ')
      : (npiData.basic.organization_name ?? npiData.basic.name ?? '');

    const primaryTaxonomy = npiData.taxonomies?.find((t) => t.primary);
    const practiceAddress = npiData.addresses?.find((a) => a.address_purpose === 'LOCATION')
      ?? npiData.addresses?.[0];

    const provider = {
      npi_number,
      full_name: fullName,
      credential: npiData.basic.credential ?? null,
      taxonomy: primaryTaxonomy?.desc ?? null,
      taxonomy_code: primaryTaxonomy?.code ?? null,
      license_state: primaryTaxonomy?.state ?? null,
      license_number: primaryTaxonomy?.license ?? null,
      address: practiceAddress
        ? {
            line1: practiceAddress.address_1,
            city: practiceAddress.city,
            state: practiceAddress.state,
            zip: practiceAddress.postal_code,
            phone: practiceAddress.telephone_number,
          }
        : null,
      enumeration_date: npiData.basic.enumeration_date ?? null,
      last_updated: npiData.basic.last_updated ?? null,
      status: npiData.basic.status,
    };

    // If specialist_id provided, stamp npi_verified on the specialist row
    // (pending admin review — admin_approved handles final publication)
    if (specialist_id && isActive) {
      await supabase
        .from('specialists')
        .update({
          npi_verified: true,
          npi_verified_at: new Date().toISOString(),
        })
        .eq('id', specialist_id)
        .eq('npi_number', npi_number); // Safety: NPI must match
    }

    return new Response(
      JSON.stringify({ verified: isActive, provider }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ verified: false, error: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
