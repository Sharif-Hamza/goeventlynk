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
    notification_body := SUBSTRING(COALESCE(NEW.content, '') FROM 1 FOR 200); -- Use content field for announcements
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

-- Recreate triggers
CREATE TRIGGER notify_on_event
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION handle_notification();

CREATE TRIGGER notify_on_announcement
  AFTER INSERT ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION handle_notification();