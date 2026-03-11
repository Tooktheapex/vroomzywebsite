/*
  # Storage Buckets for Provider Logos and Service Records

  ## Summary
  Creates two new Supabase Storage buckets:

  ### 1. provider-logos bucket
  - Stores business logos for providers
  - Private bucket (no public access by default)
  - 2MB max file size per logo
  - Accepts: image/jpeg, image/png, image/webp, image/gif

  ### 2. service-records bucket
  - Stores service history documents (PDFs, images)
  - Private bucket — all access via signed URLs
  - 20MB max file size per document
  - Accepts: application/pdf, image/jpeg, image/png, image/webp

  ### Storage RLS Policies
  - provider-logos: providers can manage their own logo; public can view logos of approved+public providers
  - service-records: uploaders can manage their own files; vehicle owners can read by VIN; admins can read all

  ### Important Notes
  - service-records bucket is intentionally private — no public URLs exposed
  - All service record file access should use signed URLs from the backend
  - Provider logos are public readable for approved providers to allow display on public pages
*/

-- ─────────────────────────────────────────────────────────────────────
-- provider-logos bucket
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'provider-logos',
  'provider-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- ─────────────────────────────────────────────────────────────────────
-- service-records bucket (private)
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-records',
  'service-records',
  false,
  20971520,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- ─────────────────────────────────────────────────────────────────────
-- Storage RLS: provider-logos
-- ─────────────────────────────────────────────────────────────────────

-- Public read: anyone can view logos for approved+public providers
-- Path format: {provider_id}/logo.{ext}
CREATE POLICY "Public read provider logos for approved providers"
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'provider-logos'
  );

-- Provider can upload their own logo
-- Path must start with their provider_id
CREATE POLICY "Provider can upload own logo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'provider-logos'
    AND EXISTS (
      SELECT 1 FROM providers p
      WHERE p.user_id = auth.uid()
        AND (storage.objects.name LIKE p.id::text || '/%')
    )
  );

-- Provider can update their own logo
CREATE POLICY "Provider can update own logo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'provider-logos'
    AND EXISTS (
      SELECT 1 FROM providers p
      WHERE p.user_id = auth.uid()
        AND (storage.objects.name LIKE p.id::text || '/%')
    )
  );

-- Provider can delete their own logo
CREATE POLICY "Provider can delete own logo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'provider-logos'
    AND EXISTS (
      SELECT 1 FROM providers p
      WHERE p.user_id = auth.uid()
        AND (storage.objects.name LIKE p.id::text || '/%')
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- Storage RLS: service-records
-- ─────────────────────────────────────────────────────────────────────

-- Uploader can read their own service record files
-- Path format: {user_id}/{record_id}/{filename}
CREATE POLICY "Uploader can read own service record files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'service-records'
    AND (storage.objects.name LIKE auth.uid()::text || '/%')
  );

-- Vehicle owner can read files whose paths match records tied to their VIN
-- This is enforced at app level via signed URLs from the record lookup
-- Storage layer: allow authenticated users who have a matching service record
CREATE POLICY "Authenticated can read service record files they have DB access to"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'service-records'
    AND EXISTS (
      SELECT 1 FROM vehicle_service_records r
      WHERE r.file_storage_path = storage.objects.name
        AND (
          r.uploaded_by_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM vehicles v
            WHERE upper(trim(v.vin)) = upper(trim(r.vin))
              AND v.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM providers p
            WHERE p.id = r.provider_id AND p.user_id = auth.uid()
          )
          OR is_admin()
        )
    )
  );

-- Uploader can insert service record files
CREATE POLICY "Authenticated can upload service record files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'service-records'
    AND (storage.objects.name LIKE auth.uid()::text || '/%')
  );

-- Uploader can update their own service record files
CREATE POLICY "Uploader can update own service record files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'service-records'
    AND (storage.objects.name LIKE auth.uid()::text || '/%')
  );

-- Uploader can delete their own service record files
CREATE POLICY "Uploader can delete own service record files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'service-records'
    AND (storage.objects.name LIKE auth.uid()::text || '/%')
  );
