/*
  # RLS Policies: Provider Approval Decisions and Gallery Images

  ## Summary
  Applies Row Level Security policies to the two new tables introduced in migration 04.
  Also updates the providers table policies to allow providers to update profile_image_url.

  ## provider_approval_decisions Policies
  - Admins can read all decisions (full audit history)
  - Admins can insert new decisions (when they approve/reject/suspend)
  - Provider owners can read decisions for their own provider (to see rejection notes)
  - No one except admins can write approval decisions (enforced at DB level)

  ## provider_gallery_images Policies
  - Provider owners can SELECT/INSERT/UPDATE/DELETE their own provider's images
  - Public users can SELECT active gallery images for approved + public providers only
  - Admins can SELECT and UPDATE all gallery images

  ## Security Notes
  - Approval decisions cannot be created by providers or public — admin only writes
  - Gallery images are only publicly visible when the parent provider is approved+public
  - All policies use auth.uid() for ownership checks
*/

-- ============================================================
-- provider_approval_decisions
-- ============================================================

CREATE POLICY "admin can read all approval decisions"
  ON provider_approval_decisions FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "admin can insert approval decisions"
  ON provider_approval_decisions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "provider owner can read own decisions"
  ON provider_approval_decisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id = provider_approval_decisions.provider_id
        AND providers.user_id = auth.uid()
    )
  );

-- ============================================================
-- provider_gallery_images
-- ============================================================

CREATE POLICY "provider owner can select own gallery images"
  ON provider_gallery_images FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id = provider_gallery_images.provider_id
        AND providers.user_id = auth.uid()
    )
  );

CREATE POLICY "provider owner can insert gallery images"
  ON provider_gallery_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id = provider_gallery_images.provider_id
        AND providers.user_id = auth.uid()
    )
  );

CREATE POLICY "provider owner can update own gallery images"
  ON provider_gallery_images FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id = provider_gallery_images.provider_id
        AND providers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id = provider_gallery_images.provider_id
        AND providers.user_id = auth.uid()
    )
  );

CREATE POLICY "provider owner can delete own gallery images"
  ON provider_gallery_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id = provider_gallery_images.provider_id
        AND providers.user_id = auth.uid()
    )
  );

CREATE POLICY "public can read active gallery images for approved providers"
  ON provider_gallery_images FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id = provider_gallery_images.provider_id
        AND providers.status = 'approved'
        AND providers.is_public = true
    )
  );

CREATE POLICY "admin can read all gallery images"
  ON provider_gallery_images FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "admin can update any gallery image"
  ON provider_gallery_images FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- providers table: allow profile_image_url updates by owner
-- The existing owner update policy already covers all fields,
-- but we confirm the column is available via the existing UPDATE policy.
-- No additional policy needed — existing "provider owner can update own profile"
-- covers all provider columns including the new profile_image_url.
-- ============================================================
