-- V4 Phase G4 — Storage bucket for gear listing images.
-- Creates the `gear-listings` bucket and RLS policies so CreateListingScreen
-- can upload photos and GearBrowse/Detail can render them publicly.

-- 1) Bucket: public read, ~5MB file size cap, images only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gear-listings',
  'gear-listings',
  TRUE,
  5 * 1024 * 1024,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) Policies on storage.objects (scoped to this bucket).

-- Public can read all objects in the bucket (bucket is already marked public,
-- but an explicit SELECT policy is needed for the RLS check on storage.objects).
DROP POLICY IF EXISTS "gear_listings_public_read" ON storage.objects;
CREATE POLICY "gear_listings_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'gear-listings');

-- Authenticated users can INSERT only into their own user-id-prefixed folder.
-- CreateListingScreen writes keys shaped as `${userId}/...`.
DROP POLICY IF EXISTS "gear_listings_owner_insert" ON storage.objects;
CREATE POLICY "gear_listings_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'gear-listings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Authenticated users can UPDATE/DELETE only their own objects.
DROP POLICY IF EXISTS "gear_listings_owner_update" ON storage.objects;
CREATE POLICY "gear_listings_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'gear-listings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'gear-listings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "gear_listings_owner_delete" ON storage.objects;
CREATE POLICY "gear_listings_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'gear-listings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
