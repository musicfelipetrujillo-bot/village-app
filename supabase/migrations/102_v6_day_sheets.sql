-- 102_v6_day_sheets.sql — "Day Sheet" caregiver handoff.
--
-- A parent builds a shareable routine sheet (schedule + pro tips w/ photos +
-- essentials) for a nanny / grandparent, auto-drafted from their logged
-- feeds/naps and then edited. Handoff = PDF (client, expo-print) + a live
-- read-only web page reached by QR (edge fn `day-sheet-page`, service-role,
-- token-gated). The token is unguessable + revocable + date-bounded.
--
-- Privacy: a day sheet carries baby's routine + contacts + photos behind an
-- UNGUESSABLE, REVOCABLE share_token (no caregiver login — frictionless). New
-- public-by-token surface → must be named in the pre-launch Privacy Policy.

create extension if not exists pgcrypto;

create table if not exists public.day_sheets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  baby_profile_id  uuid references public.baby_profiles(id) on delete set null,
  baby_name        text,
  title            text,                          -- "Grandma's weekend"
  for_whom         text,                          -- "Grandma"
  starts_on        date,
  ends_on          date,
  -- schedule: [{ time:'HH:MM', kind:'wake|bottle|nap|meal|bath|bed|note', text:'…' }]
  schedule         jsonb not null default '[]'::jsonb,
  -- key_times: { naps:['9:00a','2:00p'], bed:'7:00p', bottles:[...], meals:[...] }
  key_times        jsonb not null default '{}'::jsonb,
  -- essentials: { emergency, allergies, pediatrician, comfort, meds }
  essentials       jsonb not null default '{}'::jsonb,
  -- tips: [{ text:'…', photo_url:'…'|null }]
  tips             jsonb not null default '[]'::jsonb,
  share_token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  is_shared        boolean not null default false,
  revoked_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_day_sheets_user on public.day_sheets(user_id, updated_at desc);
create index if not exists idx_day_sheets_token on public.day_sheets(share_token);

alter table public.day_sheets enable row level security;

-- Owner-only CRUD. The public web page never touches the table via anon — the
-- edge function reads it with the service role and enforces token + revoke +
-- expiry itself.
drop policy if exists day_sheets_select_own on public.day_sheets;
create policy day_sheets_select_own on public.day_sheets
  for select using (user_id = auth.uid());
drop policy if exists day_sheets_insert_own on public.day_sheets;
create policy day_sheets_insert_own on public.day_sheets
  for insert with check (user_id = auth.uid());
drop policy if exists day_sheets_update_own on public.day_sheets;
create policy day_sheets_update_own on public.day_sheets
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists day_sheets_delete_own on public.day_sheets;
create policy day_sheets_delete_own on public.day_sheets
  for delete using (user_id = auth.uid());

revoke all on public.day_sheets from anon;

-- ── Storage: day-sheet tip photos ────────────────────────────────────────
-- Public bucket (photos load into the PDF + the public web page via CDN URL,
-- which bypasses RLS). Writes are owner-folder scoped like avatars/gear.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('day-sheet-photos', 'day-sheet-photos', true, 8388608, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

drop policy if exists day_sheet_photos_owner_insert on storage.objects;
create policy day_sheet_photos_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'day-sheet-photos' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists day_sheet_photos_owner_update on storage.objects;
create policy day_sheet_photos_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'day-sheet-photos' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists day_sheet_photos_owner_delete on storage.objects;
create policy day_sheet_photos_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'day-sheet-photos' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists day_sheet_photos_auth_read on storage.objects;
create policy day_sheet_photos_auth_read on storage.objects
  for select to authenticated
  using (bucket_id = 'day-sheet-photos');
