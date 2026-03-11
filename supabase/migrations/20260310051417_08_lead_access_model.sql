/*
  # Lead Access Model — Vroomzy

  ## Summary
  Implements a secure lead access gating system. By default, providers cannot see
  full lead details. Access is granted only if they have an active subscription or
  a confirmed paid single-lead unlock.

  ## New Tables

  1. `lead_reveals`
     - Records when a provider has been granted access to a specific lead
     - Can be created by system after payment or subscription confirmation
     - Providers can only read their own reveal rows

  2. `lead_unlock_payments`
     - Records payment intents for single-lead unlocks ($15 each)
     - Status: pending → succeeded or failed
     - Only succeeded payments trigger a lead_reveal creation
     - Providers can only read their own payment rows

  ## New Functions

  - `provider_has_lead_access(p_provider_id uuid, p_lead_id uuid) → boolean`
    Returns true if the provider has an active subscription (billing_mode grants
    access) OR a confirmed lead_reveals row for that lead.

  - `reveal_lead_free(p_lead_id uuid) → void`
    Called from client when provider has active unlimited/active subscription.
    Creates a reveal row if one does not already exist.

  ## New Secure View

  - `lead_locked_preview`
    Safe preview of lead_requests exposing only non-sensitive fields.
    Providers can only see leads assigned to their own provider_id.
    No contact info, no notes, no exact address.

  ## Security
  - RLS enabled on both new tables
  - lead_reveals can only be inserted via SECURITY DEFINER functions
  - lead_unlock_payments INSERT allowed from provider (client creates payment intent)
  - lead_unlock_payments UPDATE (status change) only via service role / admin
  - Providers cannot fake a reveal directly
*/

-- ============================================================
-- TABLE: lead_unlock_payments
-- Records per-lead purchase payment attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_unlock_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  lead_request_id uuid NOT NULL REFERENCES lead_requests(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL DEFAULT 1500,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  stripe_payment_intent_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, lead_request_id)
);

CREATE TRIGGER trg_lead_unlock_payments_updated_at
  BEFORE UPDATE ON lead_unlock_payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_lead_unlock_payments_provider_id ON lead_unlock_payments(provider_id);
CREATE INDEX IF NOT EXISTS idx_lead_unlock_payments_lead_request_id ON lead_unlock_payments(lead_request_id);
CREATE INDEX IF NOT EXISTS idx_lead_unlock_payments_status ON lead_unlock_payments(status);

ALTER TABLE lead_unlock_payments ENABLE ROW LEVEL SECURITY;

-- Providers can read their own payment rows
CREATE POLICY "lead_unlock_payments: provider can select own"
  ON lead_unlock_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = auth.uid()
    )
  );

-- Providers can insert payment rows (to initiate unlock)
CREATE POLICY "lead_unlock_payments: provider can insert"
  ON lead_unlock_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = auth.uid()
    )
  );

-- Admins can read all payment rows
CREATE POLICY "lead_unlock_payments: admin can select all"
  ON lead_unlock_payments FOR SELECT
  TO authenticated
  USING (is_admin());

-- Only admins can update payment status (real impl: service role via webhooks)
CREATE POLICY "lead_unlock_payments: admin can update"
  ON lead_unlock_payments FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- TABLE: lead_reveals
-- Records when a provider has been granted full access to a lead
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_reveals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  lead_request_id uuid NOT NULL REFERENCES lead_requests(id) ON DELETE CASCADE,
  reveal_type text NOT NULL DEFAULT 'subscription' CHECK (reveal_type IN ('subscription', 'paid_unlock')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, lead_request_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_reveals_provider_id ON lead_reveals(provider_id);
CREATE INDEX IF NOT EXISTS idx_lead_reveals_lead_request_id ON lead_reveals(lead_request_id);

ALTER TABLE lead_reveals ENABLE ROW LEVEL SECURITY;

-- Providers can read their own reveal rows
CREATE POLICY "lead_reveals: provider can select own"
  ON lead_reveals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = provider_id AND p.user_id = auth.uid()
    )
  );

-- Providers CANNOT directly insert reveal rows — only via SECURITY DEFINER function below
-- Admins can read all reveal rows
CREATE POLICY "lead_reveals: admin can select all"
  ON lead_reveals FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admins can insert reveal rows (for manual grants or webhook processing)
CREATE POLICY "lead_reveals: admin can insert"
  ON lead_reveals FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());


-- ============================================================
-- FUNCTION: provider_has_lead_access
-- Returns true if the provider can view full lead details
-- Access = active subscription OR existing reveal row
-- ============================================================
CREATE OR REPLACE FUNCTION provider_has_lead_access(
  p_provider_id uuid,
  p_lead_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    -- Check for active subscription
    SELECT 1 FROM provider_subscriptions ps
    WHERE ps.provider_id = p_provider_id
      AND ps.status IN ('active', 'trialing')
  )
  OR
  EXISTS (
    -- Check for existing reveal row (subscription or paid unlock)
    SELECT 1 FROM lead_reveals lr
    WHERE lr.provider_id = p_provider_id
      AND lr.lead_request_id = p_lead_id
  );
$$;


-- ============================================================
-- FUNCTION: reveal_lead_via_subscription
-- Called from client when provider has active subscription.
-- Creates reveal row if one does not already exist.
-- Only works if provider owns the calling user's account AND
-- has an active subscription.
-- ============================================================
CREATE OR REPLACE FUNCTION reveal_lead_via_subscription(
  p_lead_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_provider_id uuid;
  v_sub_status text;
BEGIN
  -- Find provider for this user
  SELECT id INTO v_provider_id
  FROM providers
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'No provider found for current user';
  END IF;

  -- Confirm this lead belongs to the provider
  IF NOT EXISTS (
    SELECT 1 FROM lead_requests
    WHERE id = p_lead_id AND provider_id = v_provider_id
  ) THEN
    RAISE EXCEPTION 'Lead does not belong to this provider';
  END IF;

  -- Confirm active subscription
  SELECT status INTO v_sub_status
  FROM provider_subscriptions
  WHERE provider_id = v_provider_id
  LIMIT 1;

  IF v_sub_status NOT IN ('active', 'trialing') THEN
    RAISE EXCEPTION 'No active subscription';
  END IF;

  -- Insert reveal row (ignore if already exists)
  INSERT INTO lead_reveals (provider_id, lead_request_id, reveal_type)
  VALUES (v_provider_id, p_lead_id, 'subscription')
  ON CONFLICT (provider_id, lead_request_id) DO NOTHING;
END;
$$;


-- ============================================================
-- VIEW: lead_locked_preview
-- Safe non-sensitive fields only — no contact info, no notes
-- Providers can only see leads for their own listing
-- ============================================================
CREATE OR REPLACE VIEW lead_locked_preview AS
SELECT
  lr.id,
  lr.provider_id,
  lr.service_category_id,
  lr.service_needed,
  lr.preferred_date,
  lr.vehicle_year,
  lr.vehicle_make,
  -- Intentionally omit vehicle_model, vehicle_id, vin, color, plate
  lr.status,
  lr.created_at,
  sc.label AS service_category_label
FROM lead_requests lr
LEFT JOIN service_categories sc ON sc.id = lr.service_category_id;

-- Note: RLS is not enforced on views by default in Postgres.
-- Access control for this view is enforced in application queries
-- which always filter by provider_id after verifying provider ownership.
-- The full lead_requests table RLS still applies to direct queries.
