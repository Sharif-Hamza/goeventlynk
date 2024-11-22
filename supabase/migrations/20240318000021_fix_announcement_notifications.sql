-- Drop existing trigger and function
DROP TRIGGER IF EXISTS notify_on_announcement ON announcements;
DROP TRIGGER IF EXISTS notify_on_event ON events;
DROP FUNCTION IF EXISTS notify_users();

-- Create updated notify_users function
CREATE OR REPLACE FUNCTION notify_users()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_body TEXT;
  notification_url TEXT;
BEGIN
  -- Set notification details based on table
  IF TG_TABLE_NAME = 'events' THEN
    notification_title := 'New Event: ' || NEW.title;
    notification_body := COALESCE(NEW.description, '');
    notification_url := '/events';
  ELSIF TG_TABLE_NAME = 'announcements' THEN
    notification_title := 'New Announcement: ' || NEW.title;
    notification_body := COALESCE(NEW.content, '');
    notification_url := '/announcements';
  END IF;

  -- Queue notification for processing
  INSERT INTO notification_queue (
    title,
    body,
    url,
    target_users
  )
  SELECT
    notification_title,
    SUBSTRING(notification_body FROM 1 FOR 200),
    notification_url,
    ARRAY_AGG(id)
  FROM profiles
  WHERE (notification_preferences->>'push_enabled')::boolean = true
    AND (notification_preferences->>TG_TABLE_NAME)::boolean = true
  GROUP BY 1, 2, 3;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers
CREATE TRIGGER notify_on_event
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION notify_users();

CREATE TRIGGER notify_on_announcement
  AFTER INSERT ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION notify_users();