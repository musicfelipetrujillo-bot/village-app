-- 100_waitlist.sql — marketing-site waitlist capture (villieapp.com landing page)
-- The static site posts { first_name, email, zip, source } with the PUBLISHABLE (anon) key.
-- Anon may INSERT only; it CANNOT read the list, so signups' emails stay private.

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  first_name  text,
  email       text not null unique,
  zip         text,
  source      text not null default 'website',
  created_at  timestamptz not null default now()
);

alter table public.waitlist enable row level security;

drop policy if exists waitlist_anon_insert on public.waitlist;
create policy waitlist_anon_insert on public.waitlist
  for insert to anon with check (true);

grant insert on public.waitlist to anon;
-- No SELECT/UPDATE/DELETE grant to anon on purpose — read the list from the
-- Supabase dashboard (Table editor) or via the service role only.

-- Read your signups + a running count:
--   select count(*) from public.waitlist;
--   select first_name, email, zip, created_at from public.waitlist order by created_at desc;
