/*
  # Provider Logo + VIN-Linked Service Records

  ## Summary
  This migration adds two major features:

  ### 1. Provider Logo Support
  - Adds `logo_image_url` and `logo_storage_path` columns to the `providers` table
  - Allows providers to upload a dedicated business logo separate from their profile/gallery photos

  ### 2. VIN-Linked Service Records System
  - Adds `vin` column to `vehicles` table (normalized: uppercase, trimmed)
  - Creates `vehicle_service_records` table for full service history tied to VIN
  - Creates `vehicle_service_record_access` table for granular per-user access control
  - Supports multiple source types: owner upload, provider upload, admin upload
  - Supports visibility levels: private_owner, shared_with_current_owner, shared_vehicle_history

  ### New Tables
  - `vehicle_service_records`: Full service history records with VIN linking
  - `vehicle_service_record_access`: Per-user access roles for records

  ### Modified Tables
  - `providers`: Added logo_image_url, logo_storage_path columns
  - `vehicles`: Added vin column (normalized uppercase), indexed

  ### Security
  - RLS enabled on all new tables
  - Strict ownership checks on vehicle_service_records
  - Access controlled via vehicle_service_record_access junction table
  - No anonymous access to any service records

  ### Indexes
  - vehicles(vin)
  - vehicle_service_records(vin)
  - vehicle_service_records(vehicle_id)
  - vehicle_service_records(uploaded_by_user_id)
  - vehicle_service_records(provider_id)
  - vehicle_service_records(service_date)
*/

-- ─────────────────────────────────────────────────────────────────────
-- PART 1: Provider logo fields
-- ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'providers' AND column_name = 'logo_image_url'
  ) THEN
    ALTER TABLE providers ADD COLUMN logo_image_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'providers' AND column_name = 'logo_storage_path'
  ) THEN
    ALTER TABLE providers ADD COLUMN logo_storage_path text;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- PART 2: VIN column on vehicles (normalize to uppercase)
-- ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'vin'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN vin text;
  END IF;
END $$;

-- Normalize any existing VIN data to uppercase trimmed
UPDATE vehicles SET vin = upper(trim(vin)) WHERE vin IS NOT NULL AND vin != upper(trim(vin));

-- Index for fast VIN lookups
CREATE INDEX IF NOT EXISTS vehicles_vin_idx ON vehicles (vin) WHERE vin IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- PART 3: vehicle_service_records table
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicle_service_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id          uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  vin                 text NOT NULL,
  uploaded_by_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id         uuid REFERENCES providers(id) ON DELETE SET NULL,
  record_title        text NOT NULL,
  record_type         text,
  service_date        date,
  mileage             integer,
  notes               text,
  file_url            text NOT NULL,
  file_storage_path   text NOT NULL,
  file_type           text,
  file_size_bytes     bigint,
  source_type         text NOT NULL CHECK (source_type IN ('owner_upload', 'provider_upload', 'admin_upload')),
  visibility          text NOT NULL DEFAULT 'private_owner' CHECK (visibility IN ('private_owner', 'shared_with_current_owner', 'shared_vehicle_history')),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Normalize VIN on insert/update via trigger
CREATE OR REPLACE FUNCTION normalize_service_record_vin()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.vin := upper(trim(NEW.vin));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_vsr_vin ON vehicle_service_records;
CREATE TRIGGER normalize_vsr_vin
  BEFORE INSERT OR UPDATE ON vehicle_service_records
  FOR EACH ROW EXECUTE FUNCTION normalize_service_record_vin();

-- updated_at trigger
DROP TRIGGER IF EXISTS set_vsr_updated_at ON vehicle_service_records;
CREATE TRIGGER set_vsr_updated_at
  BEFORE UPDATE ON vehicle_service_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS vsr_vin_idx              ON vehicle_service_records (vin);
CREATE INDEX IF NOT EXISTS vsr_vehicle_id_idx        ON vehicle_service_records (vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vsr_uploaded_by_idx       ON vehicle_service_records (uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS vsr_provider_id_idx       ON vehicle_service_records (provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vsr_service_date_idx      ON vehicle_service_records (service_date) WHERE service_date IS NOT NULL;

ALTER TABLE vehicle_service_records ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- PART 4: vehicle_service_record_access table
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicle_service_record_access (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_record_id uuid NOT NULL REFERENCES vehicle_service_records(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_role       text NOT NULL CHECK (access_role IN ('owner', 'provider', 'viewer')),
  created_at        timestamptz DEFAULT now(),
  UNIQUE (service_record_id, user_id)
);

CREATE INDEX IF NOT EXISTS vsra_service_record_idx ON vehicle_service_record_access (service_record_id);
CREATE INDEX IF NOT EXISTS vsra_user_id_idx        ON vehicle_service_record_access (user_id);

ALTER TABLE vehicle_service_record_access ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- PART 5: RLS policies for vehicle_service_records
-- ─────────────────────────────────────────────────────────────────────

-- SELECT: uploader can always read their own records
CREATE POLICY "Uploader can read own service records"
  ON vehicle_service_records FOR SELECT
  TO authenticated
  USING (uploaded_by_user_id = auth.uid());

-- SELECT: current vehicle owner can read records tied to their vehicle VIN
CREATE POLICY "Vehicle owner can read records by VIN"
  ON vehicle_service_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vehicles v
      WHERE upper(trim(v.vin)) = upper(trim(vehicle_service_records.vin))
        AND v.user_id = auth.uid()
    )
  );

-- SELECT: provider can read records they uploaded
CREATE POLICY "Provider can read records they uploaded"
  ON vehicle_service_records FOR SELECT
  TO authenticated
  USING (
    provider_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = vehicle_service_records.provider_id
        AND p.user_id = auth.uid()
    )
  );

-- SELECT: access table grants additional read
CREATE POLICY "Access table grants read"
  ON vehicle_service_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vehicle_service_record_access a
      WHERE a.service_record_id = vehicle_service_records.id
        AND a.user_id = auth.uid()
    )
  );

-- SELECT: admin can read all
CREATE POLICY "Admin can read all service records"
  ON vehicle_service_records FOR SELECT
  TO authenticated
  USING (is_admin());

-- INSERT: owner uploading for their own vehicle
CREATE POLICY "Owner can insert service records for own vehicle"
  ON vehicle_service_records FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by_user_id = auth.uid()
    AND source_type = 'owner_upload'
    AND (
      vehicle_id IS NULL
      OR EXISTS (
        SELECT 1 FROM vehicles v
        WHERE v.id = vehicle_service_records.vehicle_id
          AND v.user_id = auth.uid()
      )
    )
  );

-- INSERT: provider uploading for work they performed
CREATE POLICY "Provider can insert service records for their provider account"
  ON vehicle_service_records FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by_user_id = auth.uid()
    AND source_type = 'provider_upload'
    AND provider_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = vehicle_service_records.provider_id
        AND p.user_id = auth.uid()
        AND p.status = 'approved'
    )
  );

-- INSERT: admin can insert any record
CREATE POLICY "Admin can insert service records"
  ON vehicle_service_records FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- UPDATE: uploader can update their own records
CREATE POLICY "Uploader can update own service records"
  ON vehicle_service_records FOR UPDATE
  TO authenticated
  USING (uploaded_by_user_id = auth.uid())
  WITH CHECK (uploaded_by_user_id = auth.uid());

-- UPDATE: admin can update any record
CREATE POLICY "Admin can update any service record"
  ON vehicle_service_records FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- DELETE: uploader can delete their own records
CREATE POLICY "Uploader can delete own service records"
  ON vehicle_service_records FOR DELETE
  TO authenticated
  USING (uploaded_by_user_id = auth.uid());

-- DELETE: admin can delete any record
CREATE POLICY "Admin can delete any service record"
  ON vehicle_service_records FOR DELETE
  TO authenticated
  USING (is_admin());

-- ─────────────────────────────────────────────────────────────────────
-- PART 6: RLS policies for vehicle_service_record_access
-- ─────────────────────────────────────────────────────────────────────

-- SELECT: user can see access rows that include them
CREATE POLICY "Users can read their own access entries"
  ON vehicle_service_record_access FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- SELECT: record uploader can see who has access to their records
CREATE POLICY "Record uploader can see access table"
  ON vehicle_service_record_access FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vehicle_service_records r
      WHERE r.id = vehicle_service_record_access.service_record_id
        AND r.uploaded_by_user_id = auth.uid()
    )
  );

-- SELECT: admin can see all
CREATE POLICY "Admin can read all access entries"
  ON vehicle_service_record_access FOR SELECT
  TO authenticated
  USING (is_admin());

-- INSERT: record uploader can grant access
CREATE POLICY "Record uploader can grant access"
  ON vehicle_service_record_access FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vehicle_service_records r
      WHERE r.id = vehicle_service_record_access.service_record_id
        AND r.uploaded_by_user_id = auth.uid()
    )
  );

-- INSERT: admin can grant access
CREATE POLICY "Admin can insert access entries"
  ON vehicle_service_record_access FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- DELETE: record uploader can revoke access
CREATE POLICY "Record uploader can revoke access"
  ON vehicle_service_record_access FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vehicle_service_records r
      WHERE r.id = vehicle_service_record_access.service_record_id
        AND r.uploaded_by_user_id = auth.uid()
    )
  );

-- DELETE: admin can revoke any access
CREATE POLICY "Admin can delete access entries"
  ON vehicle_service_record_access FOR DELETE
  TO authenticated
  USING (is_admin());
