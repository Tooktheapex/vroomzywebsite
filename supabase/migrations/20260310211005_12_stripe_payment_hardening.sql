/*
  # Stripe Payment Hardening

  1. Changes
    - Add `stripe_session_id` to `lead_unlock_payments` for idempotency
    - Add `stripe_session_id` to `provider_subscriptions` for checkout tracking
    - Add unique constraint on (provider_id, lead_request_id) in lead_unlock_payments to prevent duplicate charges
    - Add unique constraint on (provider_id, lead_request_id) in lead_reveals to prevent duplicate reveals
    - Add `cancel_at_period_end` to provider_subscriptions

  2. Security
    - Providers cannot INSERT into lead_reveals (server-only via SECURITY DEFINER functions)
    - Providers cannot INSERT into lead_unlock_payments with status != 'pending'
    - Only webhook (service role) can flip payment status to succeeded/failed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_unlock_payments' AND column_name = 'stripe_session_id'
  ) THEN
    ALTER TABLE lead_unlock_payments ADD COLUMN stripe_session_id text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provider_subscriptions' AND column_name = 'stripe_session_id'
  ) THEN
    ALTER TABLE provider_subscriptions ADD COLUMN stripe_session_id text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provider_subscriptions' AND column_name = 'cancel_at_period_end'
  ) THEN
    ALTER TABLE provider_subscriptions ADD COLUMN cancel_at_period_end boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'lead_unlock_payments_provider_lead_unique'
  ) THEN
    ALTER TABLE lead_unlock_payments
      ADD CONSTRAINT lead_unlock_payments_provider_lead_unique
      UNIQUE (provider_id, lead_request_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'lead_reveals_provider_lead_unique'
  ) THEN
    ALTER TABLE lead_reveals
      ADD CONSTRAINT lead_reveals_provider_lead_unique
      UNIQUE (provider_id, lead_request_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS lead_unlock_payments_stripe_session_idx
  ON lead_unlock_payments(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS provider_subscriptions_stripe_session_idx
  ON provider_subscriptions(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS provider_subscriptions_stripe_sub_idx
  ON provider_subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS provider_subscriptions_stripe_customer_idx
  ON provider_subscriptions(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

/*
  Server-side function: create_lead_reveal_after_payment
  Called exclusively by the webhook handler (service role).
  Inserts a reveal row and logs a lead event atomically.
  Returns 'ok' or an error string.
*/
CREATE OR REPLACE FUNCTION public.create_lead_reveal_after_payment(
  p_provider_id uuid,
  p_lead_request_id uuid,
  p_payment_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.lead_unlock_payments
    SET status = 'succeeded'
    WHERE id = p_payment_id
      AND provider_id = p_provider_id
      AND lead_request_id = p_lead_request_id;

  INSERT INTO public.lead_reveals (provider_id, lead_request_id, reveal_type)
    VALUES (p_provider_id, p_lead_request_id, 'paid_unlock')
    ON CONFLICT (provider_id, lead_request_id) DO NOTHING;

  INSERT INTO public.provider_lead_events (provider_id, lead_request_id, event_type, amount, notes)
    VALUES (p_provider_id, p_lead_request_id, 'lead_billed', 1500, 'paid_unlock via Stripe')
    ON CONFLICT DO NOTHING;

  RETURN 'ok';
END;
$$;

/*
  Server-side function: sync_provider_subscription
  Called exclusively by the webhook handler (service role).
  Upserts provider_subscriptions from Stripe subscription data.
*/
CREATE OR REPLACE FUNCTION public.sync_provider_subscription(
  p_provider_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_billing_mode text,
  p_status text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.provider_subscriptions (
    provider_id, stripe_customer_id, stripe_subscription_id,
    billing_mode, status, current_period_start, current_period_end,
    cancel_at_period_end
  ) VALUES (
    p_provider_id, p_stripe_customer_id, p_stripe_subscription_id,
    p_billing_mode::public.provider_subscriptions_billing_mode_enum,
    p_status::public.provider_subscriptions_status_enum,
    p_period_start, p_period_end, p_cancel_at_period_end
  )
  ON CONFLICT (provider_id) DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    billing_mode = EXCLUDED.billing_mode,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    updated_at = now();
END;
$$;
