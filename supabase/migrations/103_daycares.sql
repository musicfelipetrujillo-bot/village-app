-- 103_daycares.sql — Miami-first daycare directory (Care "daycare" tier).
-- Seeded from the Miami-Dade County Open Data daycare layer (DCF-sourced
-- registry). The source's LICEXP is unreliable (shows lapsed dates for active
-- centers), so the app surfaces the license NUMBER + a "registry-listed" claim,
-- NOT "currently licensed". A future CARES validation pass upgrades the badge.
-- Outside Miami the app falls back to Google Places (daycares-nearby edge fn).

create table if not exists public.daycares (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'mdc_dcf',
  external_id text,
  name text not null,
  address text,
  unit text,
  city text,
  zip text,
  phone text,
  license_number text,
  license_issued date,
  license_expires date,
  capacity integer,
  lat double precision not null,
  lng double precision not null,
  region text not null default 'miami_dade',
  created_at timestamptz not null default now(),
  unique (source, external_id)
);

alter table public.daycares enable row level security;

-- Public directory data → readable by any signed-in user; only service role writes.
drop policy if exists daycares_select_auth on public.daycares;
create policy daycares_select_auth on public.daycares
  for select to authenticated using (true);

create index if not exists daycares_latlng_idx on public.daycares (lat, lng);

-- Nearest daycares via haversine (miles), bounding-box prefiltered then
-- distance-filtered so the square prefilter never leaks corners past the radius.
create or replace function public.list_daycares_near(
  p_lat double precision, p_lng double precision, p_radius_miles double precision default 10
)
returns table (
  id uuid, name text, address text, city text, zip text, phone text,
  license_number text, capacity integer, lat double precision, lng double precision,
  distance_mi double precision
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select q.id, q.name, q.address, q.city, q.zip, q.phone,
         q.license_number, q.capacity, q.lat, q.lng, q.distance_mi
  from (
    select d.*,
      3958.8 * acos(least(1.0,
        cos(radians(p_lat)) * cos(radians(d.lat)) * cos(radians(d.lng) - radians(p_lng))
        + sin(radians(p_lat)) * sin(radians(d.lat))
      )) as distance_mi
    from public.daycares d
    where d.lat between p_lat - (p_radius_miles / 69.0) and p_lat + (p_radius_miles / 69.0)
      and d.lng between p_lng - (p_radius_miles / (69.0 * greatest(cos(radians(p_lat)), 0.01)))
                    and p_lng + (p_radius_miles / (69.0 * greatest(cos(radians(p_lat)), 0.01)))
  ) q
  where q.distance_mi <= p_radius_miles
  order by q.distance_mi
  limit 50;
$$;

revoke execute on function public.list_daycares_near(double precision, double precision, double precision) from public, anon;
grant execute on function public.list_daycares_near(double precision, double precision, double precision) to authenticated, service_role;
