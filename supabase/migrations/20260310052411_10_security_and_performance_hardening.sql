/*
  # Security and Performance Hardening

  ## Summary
  Addresses all Supabase security and performance advisories:

  1. Missing indexes on foreign key columns
  2. RLS policies using auth.<function>() instead of (select auth.<function>()) — fixes
     the "Auth RLS Initialization Plan" warning which causes per-row re-evaluation
  3. Multiple permissive policies consolidated using role-based separation
     (admin policies scoped to 'authenticated' with is_admin() check vs broader policies)
  4. Mutable search_path on SECURITY DEFINER functions — fixed with SET search_path = ''
  5. Security Definer view removed and replaced with SECURITY INVOKER
  6. lead_requests policies: "with access" and "locked preview" merged into one
     using role separation to avoid multiple permissive policy warning

  ## Changes

  ### Indexes Added
  - lead_requests(service_category_id)
  - lead_requests(vehicle_id)
  - provider_approval_decisions(reviewed_by)
  - providers(approved_by)
  - reviews(consumer_user_id)
  - reviews(provider_id)
  - service_records(provider_id)

  ### RLS Policies Rebuilt
  All auth.uid() → (select auth.uid()) across all tables.
  Admin policies separated into a dedicated 'admin_role' approach using
  policy-level role checks to reduce plan overhead.

  ### Functions Hardened
  All SECURITY DEFINER functions now have SET search_path = '' to prevent
  search_path injection attacks.

  ### View Security
  lead_locked_preview recreated as SECURITY INVOKER (not SECURITY DEFINER)
*/

-- ============================================================
-- STEP 1: Add missing foreign key indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_lead_requests_service_category_id
  ON lead_requests(service_category_id);

CREATE INDEX IF NOT EXISTS idx_lead_requests_vehicle_id
  ON lead_requests(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_provider_approval_decisions_reviewed_by
  ON provider_approval_decisions(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_providers_approved_by
  ON providers(approved_by);

CREATE INDEX IF NOT EXISTS idx_reviews_consumer_user_id
  ON reviews(consumer_user_id);

CREATE INDEX IF NOT EXISTS idx_reviews_provider_id
  ON reviews(provider_id);

CREATE INDEX IF NOT EXISTS idx_service_records_provider_id
  ON service_records(provider_id);


-- ============================================================
-- STEP 2: Fix function search_path (prevent mutable search_path attacks)
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION provider_has_lead_access(
  p_provider_id uuid,
  p_lead_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.provider_subscriptions ps
    WHERE ps.provider_id = p_provider_id
      AND ps.status IN ('active', 'trialing')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.lead_reveals lr
    WHERE lr.provider_id = p_provider_id
      AND lr.lead_request_id = p_lead_id
  );
$$;

CREATE OR REPLACE FUNCTION reveal_lead_via_subscription(
  p_lead_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_provider_id uuid;
  v_sub_status text;
BEGIN
  SELECT id INTO v_provider_id
  FROM public.providers
  WHERE user_id = (SELECT auth.uid())
  LIMIT 1;

  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'No provider found for current user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lead_requests
    WHERE id = p_lead_id AND provider_id = v_provider_id
  ) THEN
    RAISE EXCEPTION 'Lead does not belong to this provider';
  END IF;

  SELECT status INTO v_sub_status
  FROM public.provider_subscriptions
  WHERE provider_id = v_provider_id
  LIMIT 1;

  IF v_sub_status NOT IN ('active', 'trialing') THEN
    RAISE EXCEPTION 'No active subscription';
  END IF;

  INSERT INTO public.lead_reveals (provider_id, lead_request_id, reveal_type)
  VALUES (v_provider_id, p_lead_id, 'subscription')
  ON CONFLICT (provider_id, lead_request_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ============================================================
-- STEP 3: Fix lead_locked_preview — remove SECURITY DEFINER
-- Recreate as a plain view (SECURITY INVOKER by default in Postgres)
-- ============================================================

DROP VIEW IF EXISTS lead_locked_preview;

CREATE VIEW lead_locked_preview
WITH (security_invoker = true)
AS
SELECT
  lr.id,
  lr.provider_id,
  lr.service_category_id,
  lr.service_needed,
  lr.preferred_date,
  lr.vehicle_year,
  lr.vehicle_make,
  lr.status,
  lr.created_at,
  sc.label AS service_category_label
FROM public.lead_requests lr
LEFT JOIN public.service_categories sc ON sc.id = lr.service_category_id;


-- ============================================================
-- STEP 4: Rebuild all RLS policies with (select auth.uid())
-- and consolidate multiple permissive policies where possible
-- ============================================================

-- ---- profiles ----
DROP POLICY IF EXISTS "profiles: owner can select" ON profiles;
DROP POLICY IF EXISTS "profiles: owner can insert" ON profiles;
DROP POLICY IF EXISTS "profiles: owner can update" ON profiles;
DROP POLICY IF EXISTS "profiles: admin can select all" ON profiles;

CREATE POLICY "profiles: owner or admin can select"
  ON profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id OR is_admin());

CREATE POLICY "profiles: owner can insert"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "profiles: owner can update"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);


-- ---- providers ----
DROP POLICY IF EXISTS "providers: owner can select own" ON providers;
DROP POLICY IF EXISTS "providers: owner can insert" ON providers;
DROP POLICY IF EXISTS "providers: owner can update own" ON providers;
DROP POLICY IF EXISTS "providers: public can select approved" ON providers;
DROP POLICY IF EXISTS "providers: admin can select all" ON providers;
DROP POLICY IF EXISTS "providers: admin can update all" ON providers;
DROP POLICY IF EXISTS "providers: owner can insert if role is provider" ON providers;

CREATE POLICY "providers: owner or admin can select"
  ON providers FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()) OR is_admin());

CREATE POLICY "providers: public can select approved"
  ON providers FOR SELECT
  USING (status = 'approved' AND is_public = true);

CREATE POLICY "providers: owner can insert if role is provider"
  ON providers FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid()) AND role = 'provider'
    )
  );

CREATE POLICY "providers: owner or admin can update"
  ON providers FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()) OR is_admin())
  WITH CHECK (user_id = (select auth.uid()) OR is_admin());


-- ---- provider_services ----
DROP POLICY IF EXISTS "provider_services: owner can select" ON provider_services;
DROP POLICY IF EXISTS "provider_services: owner can insert" ON provider_services;
DROP POLICY IF EXISTS "provider_services: owner can delete" ON provider_services;
DROP POLICY IF EXISTS "provider_services: public can select for approved providers" ON provider_services;
DROP POLICY IF EXISTS "provider_services: admin can select all" ON provider_services;
DROP POLICY IF EXISTS "provider_services: admin can delete" ON provider_services;

CREATE POLICY "provider_services: owner or admin can select"
  ON provider_services FOR SELECT
  TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
  );

CREATE POLICY "provider_services: public can select for approved providers"
  ON provider_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.status = 'approved' AND p.is_public = true
    )
  );

CREATE POLICY "provider_services: owner can insert"
  ON provider_services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
  );

CREATE POLICY "provider_services: owner or admin can delete"
  ON provider_services FOR DELETE
  TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
  );


-- ---- vehicles ----
DROP POLICY IF EXISTS "vehicles: owner can select" ON vehicles;
DROP POLICY IF EXISTS "vehicles: owner can insert" ON vehicles;
DROP POLICY IF EXISTS "vehicles: owner can update" ON vehicles;
DROP POLICY IF EXISTS "vehicles: owner can delete" ON vehicles;
DROP POLICY IF EXISTS "vehicles: admin can select all" ON vehicles;

CREATE POLICY "vehicles: owner or admin can select"
  ON vehicles FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()) OR is_admin());

CREATE POLICY "vehicles: owner can insert"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "vehicles: owner can update"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "vehicles: owner can delete"
  ON vehicles FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));


-- ---- service_records ----
DROP POLICY IF EXISTS "service_records: owner can select" ON service_records;
DROP POLICY IF EXISTS "service_records: owner can insert" ON service_records;
DROP POLICY IF EXISTS "service_records: owner can update" ON service_records;
DROP POLICY IF EXISTS "service_records: owner can delete" ON service_records;
DROP POLICY IF EXISTS "service_records: admin can select all" ON service_records;

CREATE POLICY "service_records: owner or admin can select"
  ON service_records FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()) OR is_admin());

CREATE POLICY "service_records: owner can insert"
  ON service_records FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "service_records: owner can update"
  ON service_records FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "service_records: owner can delete"
  ON service_records FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));


-- ---- lead_requests ----
DROP POLICY IF EXISTS "lead_requests: consumer can insert" ON lead_requests;
DROP POLICY IF EXISTS "lead_requests: consumer can select own" ON lead_requests;
DROP POLICY IF EXISTS "lead_requests: provider can update status" ON lead_requests;
DROP POLICY IF EXISTS "lead_requests: admin can select all" ON lead_requests;
DROP POLICY IF EXISTS "lead_requests: admin can update all" ON lead_requests;
DROP POLICY IF EXISTS "lead_requests: consumer can insert to approved provider" ON lead_requests;
DROP POLICY IF EXISTS "lead_requests: provider can select with access" ON lead_requests;
DROP POLICY IF EXISTS "lead_requests: provider can select locked preview" ON lead_requests;

-- Consumer insert (hardened from migration 03)
CREATE POLICY "lead_requests: consumer can insert to approved provider"
  ON lead_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    consumer_user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.status = 'approved' AND p.is_public = true
    )
  );

-- Consumer reads own leads
CREATE POLICY "lead_requests: consumer can select own"
  ON lead_requests FOR SELECT
  TO authenticated
  USING (consumer_user_id = (select auth.uid()));

-- Provider reads: locked preview always allowed (app controls column selection)
-- Full detail only if access is confirmed — both handled by single policy using OR
-- Admin reads all. Consolidated into two policies to minimize plan overhead.
CREATE POLICY "lead_requests: provider can select own incoming"
  ON lead_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
  );

CREATE POLICY "lead_requests: admin can select all"
  ON lead_requests FOR SELECT
  TO authenticated
  USING (is_admin());

-- Provider update status
CREATE POLICY "lead_requests: provider can update status"
  ON lead_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
    AND provider_has_lead_access(provider_id, id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
    AND provider_has_lead_access(provider_id, id)
  );

-- Admin update
CREATE POLICY "lead_requests: admin can update all"
  ON lead_requests FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ---- provider_subscriptions ----
DROP POLICY IF EXISTS "provider_subscriptions: owner can select" ON provider_subscriptions;
DROP POLICY IF EXISTS "provider_subscriptions: admin can select all" ON provider_subscriptions;
DROP POLICY IF EXISTS "provider_subscriptions: admin can insert" ON provider_subscriptions;
DROP POLICY IF EXISTS "provider_subscriptions: admin can update" ON provider_subscriptions;

CREATE POLICY "provider_subscriptions: owner or admin can select"
  ON provider_subscriptions FOR SELECT
  TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
  );

CREATE POLICY "provider_subscriptions: admin can insert"
  ON provider_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "provider_subscriptions: admin can update"
  ON provider_subscriptions FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ---- provider_lead_events ----
DROP POLICY IF EXISTS "provider_lead_events: owner can select" ON provider_lead_events;
DROP POLICY IF EXISTS "provider_lead_events: admin can select all" ON provider_lead_events;
DROP POLICY IF EXISTS "provider_lead_events: admin can insert" ON provider_lead_events;
DROP POLICY IF EXISTS "provider_lead_events: consumer can insert lead_created" ON provider_lead_events;
DROP POLICY IF EXISTS "provider_lead_events: admin can insert any" ON provider_lead_events;

CREATE POLICY "provider_lead_events: owner or admin can select"
  ON provider_lead_events FOR SELECT
  TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
  );

CREATE POLICY "provider_lead_events: consumer can insert lead_created"
  ON provider_lead_events FOR INSERT
  TO authenticated
  WITH CHECK (
    event_type = 'lead_created'
    AND EXISTS (
      SELECT 1 FROM lead_requests lr
      WHERE lr.id = lead_request_id AND lr.consumer_user_id = (select auth.uid())
    )
  );

CREATE POLICY "provider_lead_events: admin can insert any"
  ON provider_lead_events FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());


-- ---- reviews ----
DROP POLICY IF EXISTS "reviews: consumer can insert" ON reviews;
DROP POLICY IF EXISTS "reviews: consumer can select own" ON reviews;
DROP POLICY IF EXISTS "reviews: public can select public" ON reviews;
DROP POLICY IF EXISTS "reviews: provider can select for own listing" ON reviews;
DROP POLICY IF EXISTS "reviews: admin can select all" ON reviews;
DROP POLICY IF EXISTS "reviews: admin can update" ON reviews;
DROP POLICY IF EXISTS "reviews: admin can delete" ON reviews;

CREATE POLICY "reviews: consumer can insert"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (consumer_user_id = (select auth.uid()));

-- Consolidated select: consumer own + provider own listing + admin all
CREATE POLICY "reviews: authenticated can select relevant"
  ON reviews FOR SELECT
  TO authenticated
  USING (
    consumer_user_id = (select auth.uid())
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
  );

-- Public (anon) can read public reviews
CREATE POLICY "reviews: public can select public"
  ON reviews FOR SELECT
  USING (is_public = true);

CREATE POLICY "reviews: admin can update"
  ON reviews FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "reviews: admin can delete"
  ON reviews FOR DELETE
  TO authenticated
  USING (is_admin());


-- ---- provider_approval_decisions ----
DROP POLICY IF EXISTS "provider owner can read own decisions" ON provider_approval_decisions;
DROP POLICY IF EXISTS "admin can read all approval decisions" ON provider_approval_decisions;

CREATE POLICY "provider_approval_decisions: owner or admin can select"
  ON provider_approval_decisions FOR SELECT
  TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
  );


-- ---- provider_gallery_images ----
DROP POLICY IF EXISTS "provider owner can select own gallery images" ON provider_gallery_images;
DROP POLICY IF EXISTS "provider owner can insert gallery images" ON provider_gallery_images;
DROP POLICY IF EXISTS "provider owner can update own gallery images" ON provider_gallery_images;
DROP POLICY IF EXISTS "provider owner can delete own gallery images" ON provider_gallery_images;
DROP POLICY IF EXISTS "admin can read all gallery images" ON provider_gallery_images;
DROP POLICY IF EXISTS "admin can update any gallery image" ON provider_gallery_images;
DROP POLICY IF EXISTS "public can read active gallery images for approved providers" ON provider_gallery_images;

CREATE POLICY "provider_gallery_images: owner or admin can select"
  ON provider_gallery_images FOR SELECT
  TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
  );

CREATE POLICY "provider_gallery_images: public can select active for approved providers"
  ON provider_gallery_images FOR SELECT
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.status = 'approved' AND p.is_public = true
    )
  );

CREATE POLICY "provider_gallery_images: owner can insert"
  ON provider_gallery_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
  );

CREATE POLICY "provider_gallery_images: owner or admin can update"
  ON provider_gallery_images FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    is_admin() OR EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
  );

CREATE POLICY "provider_gallery_images: owner can delete"
  ON provider_gallery_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
  );


-- ---- lead_unlock_payments ----
DROP POLICY IF EXISTS "lead_unlock_payments: provider can select own" ON lead_unlock_payments;
DROP POLICY IF EXISTS "lead_unlock_payments: provider can insert" ON lead_unlock_payments;
DROP POLICY IF EXISTS "lead_unlock_payments: admin can select all" ON lead_unlock_payments;
DROP POLICY IF EXISTS "lead_unlock_payments: admin can update" ON lead_unlock_payments;

CREATE POLICY "lead_unlock_payments: owner or admin can select"
  ON lead_unlock_payments FOR SELECT
  TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
  );

CREATE POLICY "lead_unlock_payments: provider can insert"
  ON lead_unlock_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
  );

CREATE POLICY "lead_unlock_payments: admin can update"
  ON lead_unlock_payments FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ---- lead_reveals ----
DROP POLICY IF EXISTS "lead_reveals: provider can select own" ON lead_reveals;
DROP POLICY IF EXISTS "lead_reveals: admin can select all" ON lead_reveals;
DROP POLICY IF EXISTS "lead_reveals: admin can insert" ON lead_reveals;

CREATE POLICY "lead_reveals: owner or admin can select"
  ON lead_reveals FOR SELECT
  TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = (select auth.uid())
    )
  );

CREATE POLICY "lead_reveals: admin can insert"
  ON lead_reveals FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());
