-- Migration Group 4: Storage buckets
-- Creates the avatars bucket and RLS policies for file operations.
-- The bucket is PUBLIC — downloads bypass RLS (anyone with URL can view).
-- RLS is only needed for writes (upload, update, delete) scoped to the user's own folder.
-- 20 MB limit is generous — client-side compression (browser-image-compression)
-- converts to WebP ~500KB before upload. The limit is a safety net.

-- 4a: avatars bucket (public, 20 MB limit, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp']
);

-- 4b: RLS policies on storage.objects
-- SELECT: public bucket bypasses this for downloads, but belt-and-suspenders
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- INSERT: authenticated users can upload to their own folder only
-- Path convention: avatars/{user_id}/avatar.webp
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- UPDATE: users can overwrite their own avatar (upsert: true)
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND owner_id = (SELECT auth.uid())
  );

-- DELETE: users can remove their own avatar
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND owner_id = (SELECT auth.uid())
  );
