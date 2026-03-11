/*
  # Fix Stripe sync functions — use plain text columns (no enum casting)

  Replaces the sync_provider_subscription function created in migration 12
  with a corrected version that doesn't attempt enum casts since all
  billing_mode/status/reveal_type columns are plain text.

  Also adds the unique constraint on provider_subscriptions.provider_id
  that is required for the ON CONFLICT upsert.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'provider_subscriptions_provider_id_unique'
  ) THEN
    ALTER TABLE provider_subscriptions
      ADD CONSTRAINT provider_subscriptions_provider_id_unique
      UNIQUE (provider_id);
  END IF;
END $$;

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
    p_billing_mode, p_status, p_period_start, p_period_end, p_cancel_at_period_end
  )
  ON CONFLICT (provider_id) DO UPDATE SET
    stripe_customer_id        = EXCLUDED.stripe_customer_id,
    stripe_subscription_id    = EXCLUDED.stripe_subscription_id,
    billing_mode              = EXCLUDED.billing_mode,
    status                    = EXCLUDED.status,
    current_period_start      = EXCLUDED.current_period_start,
    current_period_end        = EXCLUDED.current_period_end,
    cancel_at_period_end      = EXCLUDED.cancel_at_period_end,
    updated_at                = now();
END;
$$;

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
