/*
  # Vroomly RLS Policies - Phase 1 Security Layer

  ## Summary
  Enables Row Level Security on all user-facing tables and creates explicit,
  production-grade policies for each table. No table is left without policies.

  ## Security Model
  - All policies use auth.uid() as the identity anchor
  - Public data (approved providers) is readable by anyone
  - Private data is restricted to owners only
  - Admin access is checked via role in profiles table
  - Service role (used in edge functions) bypasses RLS by design

  ## Policy Naming Convention
  Policies are named descriptively to document intent
*/

-- ============================================================
-- Helper function: is_admin()
-- Checks if the current user has the admin role
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- RLS: profiles
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles: owner can select"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can insert their own profile (called right after signup)
CREATE POLICY "profiles: owner can insert"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles: owner can update"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can read all profiles for moderation
CREATE POLICY "profiles: admin can select all"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_admin());

-- ============================================================
-- RLS: providers
-- ============================================================
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

-- Provider owners can read their own listing (any status)
CREATE POLICY "providers: owner can select own"
  ON providers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Provider owners can insert their own listing
CREATE POLICY "providers: owner can insert"
  ON providers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Provider owners can update their own listing (limited by app logic, not just DB)
CREATE POLICY "providers: owner can update own"
  ON providers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Public (including anon) can only see approved + public providers
CREATE POLICY "providers: public can select approved"
  ON providers FOR SELECT
  USING (status = 'approved' AND is_public = true);

-- Admins can read all providers regardless of status
CREATE POLICY "providers: admin can select all"
  ON providers FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admins can update any provider (for approval/rejection/suspension)
CREATE POLICY "providers: admin can update all"
  ON providers FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- RLS: service_categories
-- ============================================================
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read categories — they are public reference data
CREATE POLICY "service_categories: anyone can select"
  ON service_categories FOR SELECT
  USING (true);

-- Only admins can insert/update/delete categories
CREATE POLICY "service_categories: admin can insert"
  ON service_categories FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "service_categories: admin can update"
  ON service_categories FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "service_categories: admin can delete"
  ON service_categories FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================================
-- RLS: provider_services
-- ============================================================
ALTER TABLE provider_services ENABLE ROW LEVEL SECURITY;

-- Provider owners can manage services for their own listing
CREATE POLICY "provider_services: owner can select"
  ON provider_services FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "provider_services: owner can insert"
  ON provider_services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "provider_services: owner can delete"
  ON provider_services FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = auth.uid()
    )
  );

-- Public users can read services for approved public providers
CREATE POLICY "provider_services: public can select for approved providers"
  ON provider_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.status = 'approved' AND p.is_public = true
    )
  );

-- Admins can manage all provider services
CREATE POLICY "provider_services: admin can select all"
  ON provider_services FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "provider_services: admin can delete"
  ON provider_services FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================================
-- RLS: vehicles
-- ============================================================
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Users can only read their own vehicles
CREATE POLICY "vehicles: owner can select"
  ON vehicles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own vehicles
CREATE POLICY "vehicles: owner can insert"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own vehicles
CREATE POLICY "vehicles: owner can update"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own vehicles
CREATE POLICY "vehicles: owner can delete"
  ON vehicles FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all vehicles if needed
CREATE POLICY "vehicles: admin can select all"
  ON vehicles FOR SELECT
  TO authenticated
  USING (is_admin());

-- ============================================================
-- RLS: service_records
-- ============================================================
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;

-- Users can only read their own service records
CREATE POLICY "service_records: owner can select"
  ON service_records FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own service records
CREATE POLICY "service_records: owner can insert"
  ON service_records FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own service records
CREATE POLICY "service_records: owner can update"
  ON service_records FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own service records
CREATE POLICY "service_records: owner can delete"
  ON service_records FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all service records
CREATE POLICY "service_records: admin can select all"
  ON service_records FOR SELECT
  TO authenticated
  USING (is_admin());

-- ============================================================
-- RLS: lead_requests
-- ============================================================
ALTER TABLE lead_requests ENABLE ROW LEVEL SECURITY;

-- Consumers can create their own lead requests
CREATE POLICY "lead_requests: consumer can insert"
  ON lead_requests FOR INSERT
  TO authenticated
  WITH CHECK (consumer_user_id = auth.uid());

-- Consumers can read their own submitted lead requests
CREATE POLICY "lead_requests: consumer can select own"
  ON lead_requests FOR SELECT
  TO authenticated
  USING (consumer_user_id = auth.uid());

-- Providers can read leads sent to their listing
CREATE POLICY "lead_requests: provider can select incoming"
  ON lead_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = auth.uid()
    )
  );

-- Providers can update status of leads sent to their listing
CREATE POLICY "lead_requests: provider can update status"
  ON lead_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = auth.uid()
    )
  );

-- Admins can read all lead requests
CREATE POLICY "lead_requests: admin can select all"
  ON lead_requests FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admins can update all lead requests (moderation)
CREATE POLICY "lead_requests: admin can update all"
  ON lead_requests FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- RLS: provider_subscriptions
-- ============================================================
ALTER TABLE provider_subscriptions ENABLE ROW LEVEL SECURITY;

-- Provider owners can read their own subscription
CREATE POLICY "provider_subscriptions: owner can select"
  ON provider_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = auth.uid()
    )
  );

-- Only admins can insert/update subscription records (backend/edge functions use service role)
CREATE POLICY "provider_subscriptions: admin can select all"
  ON provider_subscriptions FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "provider_subscriptions: admin can insert"
  ON provider_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "provider_subscriptions: admin can update"
  ON provider_subscriptions FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- RLS: provider_lead_events
-- ============================================================
ALTER TABLE provider_lead_events ENABLE ROW LEVEL SECURITY;

-- Provider owners can read their own lead events (billing history)
CREATE POLICY "provider_lead_events: owner can select"
  ON provider_lead_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = auth.uid()
    )
  );

-- Admins can read all lead events
CREATE POLICY "provider_lead_events: admin can select all"
  ON provider_lead_events FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admins can insert lead events (backend edge functions use service role for billing)
CREATE POLICY "provider_lead_events: admin can insert"
  ON provider_lead_events FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- ============================================================
-- RLS: reviews
-- ============================================================
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Consumers can create reviews
CREATE POLICY "reviews: consumer can insert"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (consumer_user_id = auth.uid());

-- Consumers can read their own reviews
CREATE POLICY "reviews: consumer can select own"
  ON reviews FOR SELECT
  TO authenticated
  USING (consumer_user_id = auth.uid());

-- Public users can read public reviews
CREATE POLICY "reviews: public can select public"
  ON reviews FOR SELECT
  USING (is_public = true);

-- Provider owners can read reviews for their listing
CREATE POLICY "reviews: provider can select for own listing"
  ON reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = auth.uid()
    )
  );

-- Admins can manage all reviews
CREATE POLICY "reviews: admin can select all"
  ON reviews FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "reviews: admin can update"
  ON reviews FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "reviews: admin can delete"
  ON reviews FOR DELETE
  TO authenticated
  USING (is_admin());
