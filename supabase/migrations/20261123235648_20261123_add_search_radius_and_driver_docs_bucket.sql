/*
# Add search_radius_km to pricing_settings + create driver-docs storage bucket

1. Changes to pricing_settings table
- Add `search_radius_km` column (numeric, default 3.0) — controls the radius within which
  customers see nearby drivers on the map. Admin can set it from 1 to 10 km in the settings page.
2. Storage
- Create `driver-docs` storage bucket (public) for driver registration photo uploads
  (driver license, vehicle license, driver-with-car photo, selfie).
- Add storage policies allowing anon + authenticated to upload, read, update, and delete
  objects in the `driver-docs` bucket. These are intentionally public because the driver
  registration form runs without authentication (the driver hasn't signed in yet).
3. Important notes
- The `driver-docs` bucket was referenced in the camera upload code but never created, causing
  all driver registration photo uploads to fail silently. This migration fixes that.
- search_radius_km defaults to 3 (the previous hard-coded value) so existing behavior is preserved
  until the admin changes it.
*/

ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS search_radius_km numeric NOT NULL DEFAULT 3.0;

INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-docs', 'driver-docs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_upload_driver_docs" ON storage.objects;
CREATE POLICY "anon_upload_driver_docs"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'driver-docs');

DROP POLICY IF EXISTS "anon_select_driver_docs" ON storage.objects;
CREATE POLICY "anon_select_driver_docs"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'driver-docs');

DROP POLICY IF EXISTS "anon_update_driver_docs" ON storage.objects;
CREATE POLICY "anon_update_driver_docs"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'driver-docs')
WITH CHECK (bucket_id = 'driver-docs');

DROP POLICY IF EXISTS "anon_delete_driver_docs" ON storage.objects;
CREATE POLICY "anon_delete_driver_docs"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'driver-docs');
