
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  phone text,
  role text NOT NULL DEFAULT 'consumer' CHECK (role IN ('consumer','provider','admin')),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  website text,
  instagram text,
  description text,
  mobile_service boolean NOT NULL DEFAULT false,
  street_address text,
  city text,
  state text,
  zip_code text,
  service_radius_miles integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','rejected','suspended')),
  is_public boolean NOT NULL DEFAULT false,
  rejection_reason text,
  approved_at timestamptz,
  approved_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  label text UNIQUE NOT NULL,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, category_id)
);

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year integer,
  make text,
  model text,
  trim text,
  vin text,
  color text,
  mileage integer,
  plate text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES providers(id),
  service_date date,
  title text,
  description text,
  mileage integer,
  amount numeric(10,2),
  document_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_service_records_updated_at
  BEFORE UPDATE ON service_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS lead_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  consumer_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id),
  service_category_id uuid REFERENCES service_categories(id),
  service_needed text,
  preferred_date date,
  notes text,
  contact_name text NOT NULL,
  contact_phone text,
  contact_email text,
  vehicle_year integer,
  vehicle_make text,
  vehicle_model text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','viewed','contacted','closed','spam')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_lead_requests_updated_at
  BEFORE UPDATE ON lead_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS provider_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  billing_mode text NOT NULL DEFAULT 'per_lead' CHECK (billing_mode IN ('per_lead','unlimited')),
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive','trialing','active','past_due','canceled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id)
);

CREATE OR REPLACE TRIGGER trg_provider_subscriptions_updated_at
  BEFORE UPDATE ON provider_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS provider_lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  lead_request_id uuid NOT NULL REFERENCES lead_requests(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('lead_created','lead_billed','lead_included_unlimited','duplicate_prevented','manual_adjustment')),
  amount numeric(10,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  consumer_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_status ON providers(status);
CREATE INDEX IF NOT EXISTS idx_providers_is_public ON providers(is_public);
CREATE INDEX IF NOT EXISTS idx_providers_city ON providers(city);
CREATE INDEX IF NOT EXISTS idx_providers_state ON providers(state);
CREATE INDEX IF NOT EXISTS idx_providers_approved_public ON providers(status, is_public) WHERE status = 'approved' AND is_public = true;
CREATE INDEX IF NOT EXISTS idx_provider_services_provider_id ON provider_services(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_services_category_id ON provider_services(category_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_service_records_vehicle_id ON service_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_service_records_user_id ON service_records(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_requests_provider_id ON lead_requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_lead_requests_consumer_user_id ON lead_requests(consumer_user_id);
CREATE INDEX IF NOT EXISTS idx_lead_requests_created_at ON lead_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_subscriptions_provider_id ON provider_subscriptions(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_lead_events_provider_id ON provider_lead_events(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_lead_events_lead_request_id ON provider_lead_events(lead_request_id);

INSERT INTO service_categories (slug, label, icon) VALUES
  ('detailing',           'Detailing',              'sparkles'),
  ('mechanic',            'Mechanic',               'wrench'),
  ('body-shop',           'Body Shop',              'car'),
  ('wrap',                'Wrap',                   'layers'),
  ('tint',                'Window Tint',            'sun'),
  ('ppf',                 'Paint Protection Film',  'shield'),
  ('wheels-tires',        'Wheels & Tires',         'circle'),
  ('transport',           'Transport',              'truck'),
  ('mobile-installer',    'Mobile Installer',       'map-pin'),
  ('performance-tuning',  'Performance Tuning',     'zap'),
  ('upholstery',          'Upholstery',             'armchair'),
  ('ceramic-coating',     'Ceramic Coating',        'droplet'),
  ('paint-correction',    'Paint Correction',       'brush'),
  ('audio-electronics',   'Audio & Electronics',    'music'),
  ('other',               'Other',                  'more-horizontal')
ON CONFLICT (slug) DO NOTHING;
