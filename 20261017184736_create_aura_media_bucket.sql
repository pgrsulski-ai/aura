-- Create the aura-media storage bucket as a public bucket
-- The user reported it existed in their dashboard, but the storage.buckets
-- query returned empty, so we create it here to ensure it exists.
INSERT INTO storage.buckets (id, name, public)
VALUES ('aura-media', 'aura-media', true)
ON CONFLICT (id) DO NOTHING;
