/*
# Storage policies for the aura-media bucket

## Summary
The `aura-media` storage bucket already exists (created by the user as a public bucket).
These policies control who can upload, read, update, and delete objects inside it.

## Policies
- SELECT (read): public — anyone can view/download media (feed works for logged-out users).
- INSERT (upload): authenticated only. Any logged-in user can upload media to the bucket.
- UPDATE: authenticated only — the object owner can update their own files.
- DELETE: authenticated only — the object owner can delete their own files.

## Important notes
1. Scoped to `bucket_id = 'aura-media'` in each policy condition.
2. Owner check compares the `owner` column (uuid) directly to auth.uid() (uuid).
*/

-- Read: public
DROP POLICY IF EXISTS "aura_media_public_read" ON storage.objects;
CREATE POLICY "aura_media_public_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'aura-media');

-- Insert: authenticated users only
DROP POLICY IF EXISTS "aura_media_authenticated_insert" ON storage.objects;
CREATE POLICY "aura_media_authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'aura-media');

-- Update: owner only
DROP POLICY IF EXISTS "aura_media_owner_update" ON storage.objects;
CREATE POLICY "aura_media_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'aura-media' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'aura-media' AND owner = auth.uid());

-- Delete: owner only
DROP POLICY IF EXISTS "aura_media_owner_delete" ON storage.objects;
CREATE POLICY "aura_media_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'aura-media' AND owner = auth.uid());
