-- Drop existing trigger and function
DROP TRIGGER IF EXISTS notify_on_announcement ON announcements;
DROP TRIGGER IF EXISTS notify_on_event ON events;
DROP FUNCTION IF EXISTS handle_notification();

-- Create updated notification function that properly handles different fields
CREATE OR REPLACE FUNCTION handle_notification() 
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_body TEXT;
  notification_url TEXT;
BEGIN
  -- Set notification details based on table
  IF TG_TABLE_NAME = 'events' THEN
    notification_title := 'New Event: ' || NEW.title;
    notification_body := SUBSTRING(COALESCE(NEW.description, '') FROM 1 FOR 200);
    notification_url := '/events';
  ELSIF TG_TABLE_NAME = 'announcements' THEN
    notification_title := 'New Announcement: ' || NEW.title;
    notification_body := SUBSTRING(COALESCE(NEW.content, '') FROM 1 FOR 200);
    notification_url := '/announcements';
  END IF;

  -- Notify through Postgres NOTIFY
  PERFORM pg_notify(
    'push_notification',
    json_build_object(
      'title', notification_title,
      'body', notification_body,
      'url', notification_url
    )::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers with proper conditions
CREATE TRIGGER notify_on_event
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION handle_notification();

CREATE TRIGGER notify_on_announcement
  AFTER INSERT ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION handle_notification();

-- Ensure announcements table has correct structure
ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS reaction_counts JSONB DEFAULT '{}'::jsonb;

-- Update announcement policies
DROP POLICY IF EXISTS "Anyone can view announcements" ON announcements;
DROP POLICY IF EXISTS "Admins and club admins can manage announcements" ON announcements;

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