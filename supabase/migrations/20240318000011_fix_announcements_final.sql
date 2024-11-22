-- Drop existing policies first
DROP POLICY IF EXISTS "Admins and club admins can manage announcements" ON announcements;
DROP POLICY IF EXISTS "Anyone can view announcements" ON announcements;
DROP POLICY IF EXISTS "Admins and club admins can upload announcement images" ON storage.objects;

-- Create proper storage bucket for announcements if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcements', 'announcements', true)
ON CONFLICT (id) DO NOTHING;

-- Create proper storage policies
CREATE POLICY "Anyone can view announcement images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'announcements' );

CREATE POLICY "Authenticated users can upload announcement images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'announcements' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can manage their own announcement images"
ON storage.objects FOR UPDATE OR DELETE
USING (
  bucket_id = 'announcements' 
  AND auth.uid() = owner
);

-- Create proper announcement policies
CREATE POLICY "Anyone can view announcements"
ON announcements FOR SELECT
USING (true);

CREATE POLICY "Admins and club admins can manage announcements"
ON announcements FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE is_admin = true 
    OR (role = 'club_admin' AND club_id = announcements.club_id)
  )
);

-- Ensure announcements table has all required columns
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT;