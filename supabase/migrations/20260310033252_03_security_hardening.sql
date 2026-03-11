/*
  # Security Hardening - Vroomly Phase 2

  ## Summary
  Fixes critical RLS policy gaps found in security audit.

  ## Changes

  ### providers table
  - Old INSERT policy allowed ANY authenticated user to create a provider record
  - New policy restricts INSERT to users whose profile has role = 'provider'
  - This prevents consumers or admins from creating fake provider listings

  ### lead_requests table
  - Old INSERT policy only checked consumer_user_id = auth.uid()
  - New policy also validates that the target provider is approved and public
  - This prevents leads being submitted to rejected, draft, or suspended providers

  ### provider_subscriptions table
  - Add explicit service-role-friendly INSERT policy note
  - These tables are meant to be written by backend Edge Functions via service role
  - The service role bypasses RLS by design — no additional policy needed
  - Documenting this explicitly to avoid confusion

  ## Notes
  - Service role always bypasses RLS in Supabase — this is correct and by design
  - Policies here only govern authenticated client-side requests
  - All backend automation (billing webhooks, lead events) should use service role key
    which is NEVER exposed to the frontend
*/

-- ============================================================
-- FIX: providers INSERT policy
-- Drop old permissive policy, replace with role-restricted one
-- ============================================================
DROP POLICY IF EXISTS "providers: owner can insert" ON providers;

CREATE POLICY "providers: owner can insert if role is provider"
  ON providers FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'provider'
    )
  );

-- ============================================================
-- FIX: lead_requests INSERT policy
-- Drop old policy that only checked consumer_user_id
-- New policy also validates provider is approved and public
-- ============================================================
DROP POLICY IF EXISTS "lead_requests: consumer can insert" ON lead_requests;

CREATE POLICY "lead_requests: consumer can insert to approved provider"
  ON lead_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    consumer_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id
      AND p.status = 'approved'
      AND p.is_public = true
    )
  );

-- ============================================================
-- FIX: provider_lead_events INSERT
-- The authenticated admin policy is restrictive.
-- In production, the service role (used by edge functions) bypasses
-- RLS entirely and can insert freely. For client-side usage in the
-- ProviderDetailPage, we need to allow authenticated consumers to insert
-- 'lead_created' events for providers they just submitted a lead to.
-- ============================================================
DROP POLICY IF EXISTS "provider_lead_events: admin can insert" ON provider_lead_events;

-- Allow the consumer who just created a lead to also log the lead_created event
CREATE POLICY "provider_lead_events: consumer can insert lead_created"
  ON provider_lead_events FOR INSERT
  TO authenticated
  WITH CHECK (
    event_type = 'lead_created'
    AND EXISTS (
      SELECT 1 FROM lead_requests lr
      WHERE lr.id = lead_request_id
      AND lr.consumer_user_id = auth.uid()
      AND lr.provider_id = provider_id
    )
  );

-- Admins can insert any event type (for manual adjustments, billing corrections)
CREATE POLICY "provider_lead_events: admin can insert any"
  ON provider_lead_events FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());
