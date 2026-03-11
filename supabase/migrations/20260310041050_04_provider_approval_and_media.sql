/*
  # Provider Approval History and Media Support

  ## Summary
  This migration adds two new tables and updates the providers table to support:
  1. A full audit trail of every approval/rejection/suspension decision
  2. Provider business profile images
  3. Provider portfolio/gallery images

  ## New Tables

  ### provider_approval_decisions
  Tracks every admin action taken on a provider profile over time. Supports:
  - Audit history for compliance and review
  - Providers seeing their latest rejection note
  - Admins reviewing full decision history

  Columns:
  - id: unique decision record
  - provider_id: the provider this decision belongs to
  - decision: one of approved / rejected / suspended / resubmitted / status_note
  - previous_status: what status the provider was in before this action
  - new_status: what status the provider moved to after this action
  - notes: optional admin note (rejection reason, suspension reason, etc.)
  - reviewed_by: the admin user who made this decision
  - created_at: when the decision was made

  ### provider_gallery_images
  Stores portfolio/gallery images for provider profiles. Used on:
  - Provider detail page (public, approved+public only)
  - Provider dashboard gallery manager
  - Admin review panel

  Columns:
  - id: unique image record
  - provider_id: which provider owns this image
  - image_url: direct URL to the uploaded image
  - caption: optional caption for the image
  - sort_order: controls display order
  - is_active: soft-delete / hide without removing
  - created_at / updated_at: timestamps

  ## Providers Table Updates
  - Adds profile_image_url column for the primary business image

  ## Indexes
  - provider_approval_decisions(provider_id) for quick lookup
  - provider_approval_decisions(created_at) for chronological queries
  - provider_gallery_images(provider_id) for per-provider gallery
  - provider_gallery_images(is_active) for filtering active images

  ## Security
  - RLS enabled on both new tables (policies applied in next migration)
  - updated_at trigger applied to provider_gallery_images
*/

-- Add profile_image_url to providers if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'providers' AND column_name = 'profile_image_url'
  ) THEN
    ALTER TABLE providers ADD COLUMN profile_image_url text;
  END IF;
END $$;

-- Create provider_approval_decisions table
CREATE TABLE IF NOT EXISTS provider_approval_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected', 'suspended', 'resubmitted', 'status_note')),
  previous_status text,
  new_status text,
  notes text,
  reviewed_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create provider_gallery_images table
CREATE TABLE IF NOT EXISTS provider_gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Apply updated_at trigger to provider_gallery_images
CREATE TRIGGER set_provider_gallery_images_updated_at
  BEFORE UPDATE ON provider_gallery_images
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes for provider_approval_decisions
CREATE INDEX IF NOT EXISTS idx_approval_decisions_provider_id
  ON provider_approval_decisions(provider_id);

CREATE INDEX IF NOT EXISTS idx_approval_decisions_created_at
  ON provider_approval_decisions(created_at);

-- Indexes for provider_gallery_images
CREATE INDEX IF NOT EXISTS idx_gallery_images_provider_id
  ON provider_gallery_images(provider_id);

CREATE INDEX IF NOT EXISTS idx_gallery_images_is_active
  ON provider_gallery_images(is_active);

-- Enable RLS
ALTER TABLE provider_approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_gallery_images ENABLE ROW LEVEL SECURITY;
