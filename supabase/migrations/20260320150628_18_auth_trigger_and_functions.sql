
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin',
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_full_name text;
BEGIN
  v_role := coalesce(NEW.raw_user_meta_data->>'role', 'consumer');

  IF v_role NOT IN ('consumer', 'provider', 'admin') THEN
    v_role := 'consumer';
  END IF;

  v_full_name := coalesce(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, v_full_name, v_role, now(), now())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
SELECT
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ),
  coalesce(
    CASE
      WHEN u.raw_user_meta_data->>'role' IN ('consumer','provider','admin')
        THEN u.raw_user_meta_data->>'role'
      ELSE NULL
    END,
    'consumer'
  ),
  u.created_at,
  now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

CREATE INDEX IF NOT EXISTS idx_provider_services_category_provider
  ON public.provider_services (category_id, provider_id);

CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles (role);

CREATE INDEX IF NOT EXISTS idx_providers_mobile_service
  ON public.providers (mobile_service)
  WHERE mobile_service = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'service_categories'
      AND policyname = 'service_categories: anyone can select'
  ) THEN
    CREATE POLICY "service_categories: anyone can select"
      ON public.service_categories FOR SELECT TO public USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'providers'
      AND policyname = 'providers: public can select approved'
  ) THEN
    CREATE POLICY "providers: public can select approved"
      ON public.providers FOR SELECT TO public
      USING (status = 'approved' AND is_public = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provider_gallery_images'
      AND policyname = 'provider_gallery_images: public can select active for approved providers'
  ) THEN
    CREATE POLICY "provider_gallery_images: public can select active for approved providers"
      ON public.provider_gallery_images FOR SELECT TO public
      USING (
        is_active = true
        AND EXISTS (
          SELECT 1 FROM public.providers p
          WHERE p.id = provider_gallery_images.provider_id
            AND p.status = 'approved' AND p.is_public = true
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provider_services'
      AND policyname = 'provider_services: public can select for approved providers'
  ) THEN
    CREATE POLICY "provider_services: public can select for approved providers"
      ON public.provider_services FOR SELECT TO public
      USING (
        EXISTS (
          SELECT 1 FROM public.providers p
          WHERE p.id = provider_services.provider_id
            AND p.status = 'approved' AND p.is_public = true
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.provider_has_lead_access(
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
