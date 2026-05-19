-- Migration 053: Scope storage.objects SELECT policy to authenticated only.
--
-- Why: Supabase advisor flags `public_bucket_allows_listing` on both
-- `avatars` and `gear-listings` buckets. The current `*_public_read`
-- policies grant SELECT to the `public` role, which means any anonymous
-- caller can enumerate every object via the storage API
-- (`supabase.storage.from('<bucket>').list(...)`). That is not the same
-- as public-URL access — public URLs go through the CDN endpoint
-- (`/storage/v1/object/public/<bucket>/<path>`) which bypasses RLS as
-- long as the bucket itself has `public=true`. So we can safely scope
-- SELECT to authenticated without breaking image rendering.
--
-- Verified before writing: no client code calls `.list()` on either
-- bucket (`grep -r "storage\\.from\\([^)]*\\)\\.list" apps/`).
--
-- Risk: low. Anonymous traffic loses the ability to enumerate object
-- names (which it should never have had). Authenticated users keep
-- `.download()` / `.list()` for their own paths via the existing owner
-- INSERT/UPDATE/DELETE policies + this scoped SELECT. Public URL access
-- via `<Image source={{ uri }} />` is unaffected — bucket.public=true
-- handles that path entirely outside RLS.

DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
CREATE POLICY avatars_authenticated_read ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS gear_listings_public_read ON storage.objects;
CREATE POLICY gear_listings_authenticated_read ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'gear-listings');
