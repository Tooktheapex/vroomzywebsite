/*
  # Storage RLS Policies for Provider Media

  ## Summary
  Applies Row Level Security policies to the two provider media storage buckets.

  ## Path Convention
  Files are stored under: {provider_id}/{filename}
  The first segment of the storage path is always the provider's UUID.
  Policies extract this prefix and verify the authenticated user owns that provider.

  ## provider-profiles bucket policies
  - Public (anon + authenticated) can SELECT (read) all files — URLs work in public img tags
  - Authenticated provider owners can INSERT files under their own provider_id prefix
  - Authenticated provider owners can UPDATE (replace) files under their own provider_id prefix
  - Authenticated provider owners can DELETE files under their own provider_id prefix
  - Admins can manage all files

  ## provider-gallery bucket policies
  - Same structure as provider-profiles
  - Public SELECT allowed — visibility is controlled at the DB record level (is_active + provider status)

  ## Security Notes
  - The path prefix check ensures providers cannot upload to another provider's folder
  - (storage.foldername(name))[1] extracts the first path segment (the provider_id)
  - This is cross-referenced against the providers table to verify ownership via auth.uid()
*/

-- ============================================================
-- provider-profiles bucket
-- ============================================================

CREATE POLICY "provider profile images are publicly readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'provider-profiles');

CREATE POLICY "provider owners can upload their profile image"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'provider-profiles'
    AND EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id::text = (storage.foldername(name))[1]
        AND providers.user_id = auth.uid()
    )
  );

CREATE POLICY "provider owners can update their profile image"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'provider-profiles'
    AND EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id::text = (storage.foldername(name))[1]
        AND providers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'provider-profiles'
    AND EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id::text = (storage.foldername(name))[1]
        AND providers.user_id = auth.uid()
    )
  );

CREATE POLICY "provider owners can delete their profile image"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'provider-profiles'
    AND EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id::text = (storage.foldername(name))[1]
        AND providers.user_id = auth.uid()
    )
  );

CREATE POLICY "admins can manage all provider profile images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'provider-profiles' AND is_admin())
  WITH CHECK (bucket_id = 'provider-profiles' AND is_admin());

-- ============================================================
-- provider-gallery bucket
-- ============================================================

CREATE POLICY "provider gallery images are publicly readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'provider-gallery');

CREATE POLICY "provider owners can upload gallery images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'provider-gallery'
    AND EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id::text = (storage.foldername(name))[1]
        AND providers.user_id = auth.uid()
    )
  );

CREATE POLICY "provider owners can update gallery images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'provider-gallery'
    AND EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id::text = (storage.foldername(name))[1]
        AND providers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'provider-gallery'
    AND EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id::text = (storage.foldername(name))[1]
        AND providers.user_id = auth.uid()
    )
  );

CREATE POLICY "provider owners can delete gallery images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'provider-gallery'
    AND EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id::text = (storage.foldername(name))[1]
        AND providers.user_id = auth.uid()
    )
  );

CREATE POLICY "admins can manage all provider gallery images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'provider-gallery' AND is_admin())
  WITH CHECK (bucket_id = 'provider-gallery' AND is_admin());
