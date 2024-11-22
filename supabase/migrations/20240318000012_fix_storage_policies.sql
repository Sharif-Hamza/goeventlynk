-- Drop existing policies first
DROP POLICY IF EXISTS "Anyone can view announcement images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload announcement images" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage their own announcement images" ON storage.objects;

-- Create proper storage bucket for announcements if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcements', 'announcements', true)
ON CONFLICT (id) DO NOTHING;

-- Create separate policies for each operation
CREATE POLICY "Anyone can view announcement images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'announcements' );

CREATE POLICY "Authenticated users can upload announcement images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'announcements' 
  AND auth.role() = 'authenticated'
  AND (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE is_admin = true 
      OR role = 'club_admin'
    )
  )
);

CREATE POLICY "Users can update their announcement images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'announcements' 
  AND auth.uid() = owner
  AND (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE is_admin = true 
      OR role = 'club_admin'
    )
  )
);

CREATE POLICY "Users can delete their announcement images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'announcements' 
  AND auth.uid() = owner
  AND (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE is_admin = true 
      OR role = 'club_admin'
    )
  )
);

-- Create events bucket and policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('events', 'events', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view event images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'events' );

CREATE POLICY "Authenticated users can upload event images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'events' 
  AND auth.role() = 'authenticated'
  AND (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE is_admin = true 
      OR role = 'club_admin'
    )
  )
);

CREATE POLICY "Users can update their event images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'events' 
  AND auth.uid() = owner
  AND (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE is_admin = true 
      OR role = 'club_admin'
    )
  )
);

CREATE POLICY "Users can delete their event images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'events' 
  AND auth.uid() = owner
  AND (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE is_admin = true 
      OR role = 'club_admin'
    )
  )
);