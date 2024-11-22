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

-- Update the notify_users function to remove type field
CREATE OR REPLACE FUNCTION notify_users()
RETURNS TRIGGER AS $$
BEGIN
  -- Queue notification for processing
  INSERT INTO notification_queue (
    title,
    body,
    url,
    target_users
  )
  SELECT
    CASE 
      WHEN TG_TABLE_NAME = 'events' THEN 'New Event: ' || NEW.title
      ELSE 'New Announcement: ' || NEW.title
    END,
    CASE 
      WHEN TG_TABLE_NAME = 'events' THEN SUBSTRING(NEW.description FROM 1 FOR 200)
      ELSE SUBSTRING(NEW.content FROM 1 FOR 200)
    END,
    CASE 
      WHEN TG_TABLE_NAME = 'events' THEN '/events'
      ELSE '/announcements'
    END,
    ARRAY_AGG(id)
  FROM profiles
  WHERE (notification_preferences->>'push_enabled')::boolean = true
    AND (notification_preferences->>CASE 
      WHEN TG_TABLE_NAME = 'events' THEN 'events'
      ELSE 'announcements'
    END)::boolean = true
  GROUP BY 1, 2, 3;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers for notifications
DROP TRIGGER IF EXISTS notify_on_event ON events;
CREATE TRIGGER notify_on_event
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION notify_users();

DROP TRIGGER IF EXISTS notify_on_announcement ON announcements;
CREATE TRIGGER notify_on_announcement
  AFTER INSERT ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION notify_users();