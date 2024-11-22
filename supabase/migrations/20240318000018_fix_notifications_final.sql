-- Drop existing notification queue table
DROP TABLE IF EXISTS notification_queue CASCADE;

-- Create notification queue table with correct structure
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT NOT NULL,
  target_users UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  error TEXT
);

-- Enable RLS
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notification_queue
CREATE POLICY "Admins and club admins can manage notification queue"
ON notification_queue
FOR ALL USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true OR role = 'club_admin'
  )
);

-- Update storage policies for announcements
DROP POLICY IF EXISTS "Authenticated users can upload announcement images" ON storage.objects;
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

-- Ensure announcements table has correct structure
ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS reaction_counts JSONB DEFAULT '{}'::jsonb;