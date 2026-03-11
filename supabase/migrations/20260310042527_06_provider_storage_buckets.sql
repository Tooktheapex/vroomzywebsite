/*
  # Provider Media Storage Buckets

  ## Summary
  Creates two Supabase Storage buckets for provider media uploads:

  1. provider-profiles — stores one primary business profile image per provider
     - Public read (approved+public providers visible on public pages)
     - Authenticated provider owners can upload/replace their own image
     - Max recommended file size enforced at application level

  2. provider-gallery — stores portfolio/work photos per provider
     - Public read for active images on approved+public providers
     - Provider owners can upload multiple images
     - Images are soft-deleted via is_active flag in provider_gallery_images

  ## Storage Security Model
  - Files are stored under the path: {provider_id}/{filename}
  - Storage RLS policies check that the uploading user owns the provider with the matching provider_id path prefix
  - Public read is allowed on both buckets (URLs are embedded in records with additional DB-level visibility controls)

  ## Notes
  - Bucket names: provider-profiles and provider-gallery
  - Both buckets are public so URLs work directly in <img> tags
  - Access control is enforced by the file path convention (provider_id prefix) and storage policies
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'provider-profiles',
  'provider-profiles',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'provider-gallery',
  'provider-gallery',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
