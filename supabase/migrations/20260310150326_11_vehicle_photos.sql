/*
  # Vehicle Photos

  1. New Tables
    - `vehicle_photos`
      - `id` (uuid, primary key)
      - `vehicle_id` (uuid, FK to vehicles)
      - `user_id` (uuid, FK to auth.users)
      - `image_url` (text, public URL)
      - `storage_path` (text, bucket path for deletion)
      - `caption` (text, optional)
      - `sort_order` (int, default 0)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `vehicle_photos`
    - Consumers can SELECT / INSERT / DELETE their own vehicle photos

  3. Storage
    - Create `vehicle-photos` bucket (public)
    - RLS policies for upload/delete scoped to authenticated owner
*/

CREATE TABLE IF NOT EXISTS vehicle_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  storage_path text NOT NULL,
  caption text DEFAULT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_photos_vehicle_id_idx ON vehicle_photos(vehicle_id);
CREATE INDEX IF NOT EXISTS vehicle_photos_user_id_idx ON vehicle_photos(user_id);

ALTER TABLE vehicle_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view their vehicle photos"
  ON vehicle_photos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert vehicle photos"
  ON vehicle_photos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can delete vehicle photos"
  ON vehicle_photos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-photos',
  'vehicle-photos',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload vehicle photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'vehicle-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can delete own vehicle photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'vehicle-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view vehicle photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'vehicle-photos');
