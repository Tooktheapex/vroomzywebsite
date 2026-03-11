/*
  # Add Photography & Videography Service Category

  ## Summary
  Adds a new service category for automotive photographers and videographers —
  providers who offer photo shoots, cinematic videos, content creation,
  and media production for car owners and enthusiasts.

  ## New Service Categories
  - `photo-video` / Photography & Videography — covers automotive photo shoots,
    cinematic video production, social media content, car show coverage, etc.

  ## Notes
  - Slug is `photo-video` for brevity
  - Icon value is `camera` (maps to lucide-react Camera icon)
  - Uses ON CONFLICT DO NOTHING to be safe on re-runs
*/

INSERT INTO service_categories (slug, label, icon) VALUES
  ('photo-video', 'Photography & Video', 'camera')
ON CONFLICT (slug) DO NOTHING;
