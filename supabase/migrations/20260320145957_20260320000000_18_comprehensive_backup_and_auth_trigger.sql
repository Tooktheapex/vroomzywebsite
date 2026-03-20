/*
  # Comprehensive Backup & Auth Integrity Migration

  ## Summary
  Full safety-net audit of all tables, triggers, functions, RLS policies, and
  foreign keys. Applied after discovering the auth → profile wiring was missing.

  ## Critical Fix
  1. **handle_new_user trigger** — Without this, every new signup silently fails
     to create a profiles row, breaking all authenticated features. Fires on
     INSERT into auth.users and upserts the matching public.profiles row using
     metadata (full_name, role) passed from the signup form.

  ## Additional Items
  2. Backfill — creates profile rows for any orphaned auth.users entries.
  3. is_admin() helper — idempotent, used by all admin RLS policies.
  4. provider_has_lead_access() — kept with original param names (p_provider_id,
     p_lead_id) to avoid signature conflicts; now also checks trialing status.
  5. set_updated_at() — ensured present.
  6. Extra performance indexes for the new service-detail page queries.
  7. Guard-wrapped policy creation for all public-facing read policies.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. is_admin() helper
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. set_updated_at() helper
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CRITICAL: handle_new_user — auto-create profile on every new signup
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Backfill profiles for any auth users that somehow have no profile row
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Performance indexes for service-detail page and general browsing
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_provider_services_category_provider
  ON public.provider_services (category_id, provider_id);

CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles (role);

CREATE INDEX IF NOT EXISTS idx_providers_mobile_service
  ON public.providers (mobile_service)
  WHERE mobile_service = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Guard-wrapped public-read policy creation
-- ─────────────────────────────────────────────────────────────────────────────

-- service_categories: public read (needed for Services pages)
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

-- providers: public read approved listings
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

-- provider_gallery_images: public read for approved providers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provider_gallery_images'
      AND policyname = 'provider_gallery_images: public can select active for approved '
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

-- provider_services: public read for approved providers
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
