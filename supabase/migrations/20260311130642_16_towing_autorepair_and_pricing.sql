/*
  # Add Towing & Auto Repair Categories and Service Pricing

  ## Summary
  This migration adds two new service categories (Towing and Auto Repair) and introduces
  price range columns to the provider_services table so providers can advertise their
  typical pricing per service offering.

  ## New Service Categories
  - `towing` / Towing — for roadside and vehicle towing providers
  - `auto-repair` / Auto Repair — distinct from Body Shop; covers mechanical repair, diagnostics, etc.
    (Note: existing "body-shop" category remains for collision/bodywork specialists)

  ## Modified Tables
  ### provider_services
  - `price_min` (integer, nullable) — minimum typical price in USD cents (e.g. 5000 = $50.00)
  - `price_max` (integer, nullable) — maximum typical price in USD cents

  ## Notes
  - Prices stored as integer cents to avoid floating-point issues
  - Both price columns are optional — providers may leave them blank
  - Body Shop already exists; the new "Auto Repair" category covers general mechanical work
  - Towing covers roadside assistance and vehicle transport via tow truck
*/

-- Add new service categories
INSERT INTO service_categories (slug, label, icon) VALUES
  ('towing',      'Towing',       'truck-tow'),
  ('auto-repair', 'Auto Repair',  'settings')
ON CONFLICT (slug) DO NOTHING;

-- Add price range columns to provider_services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provider_services' AND column_name = 'price_min'
  ) THEN
    ALTER TABLE provider_services ADD COLUMN price_min integer DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provider_services' AND column_name = 'price_max'
  ) THEN
    ALTER TABLE provider_services ADD COLUMN price_max integer DEFAULT NULL;
  END IF;
END $$;

-- Add a check constraint to ensure price_min <= price_max when both are set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'provider_services' AND constraint_name = 'chk_price_range_order'
  ) THEN
    ALTER TABLE provider_services
      ADD CONSTRAINT chk_price_range_order
      CHECK (price_min IS NULL OR price_max IS NULL OR price_min <= price_max);
  END IF;
END $$;
