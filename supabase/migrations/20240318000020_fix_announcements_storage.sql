-- First, create the announcements bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcements', 'announcements', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies for announcements
DROP POLICY IF EXISTS "Anyone can view announcement images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload announcement images" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage their announcement images" ON storage.objects;

-- Create new storage policies for announcements
CREATE POLICY "Anyone can view announcement images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'announcements' );

CREATE POLICY "Admins and club admins can upload announcement images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'announcements' 
  AND auth.role() = 'authenticated'
  AND auth.uid() IN (
    SELECT id FROM profiles 
    WHERE is_admin = true 
    OR role = 'club_admin'
  )
);

CREATE POLICY "Admins and club admins can manage announcement images"
ON storage.objects FOR UPDATE OR DELETE
USING (
  bucket_id = 'announcements' 
  AND auth.uid() = owner
  AND auth.uid() IN (
    SELECT id FROM profiles 
    WHERE is_admin = true 
    OR role = 'club_admin'
  )
);

-- Update announcements table to ensure proper structure
ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS reaction_counts JSONB DEFAULT '{}'::jsonb;

-- Update announcement policies
DROP POLICY IF EXISTS "Admins and club admins can manage announcements" ON announcements;
CREATE POLICY "Admins and club admins can manage announcements"
ON announcements FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE is_admin = true 
    OR (role = 'club_admin' AND club_id = announcements.club_id)
  )
);