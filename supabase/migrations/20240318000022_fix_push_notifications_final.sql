-- Drop existing tables
DROP TABLE IF EXISTS push_subscriptions CASCADE;
DROP TABLE IF EXISTS notification_queue CASCADE;

-- Create push_subscriptions table
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(profile_id, subscription->>'endpoint')
);

-- Create notification queue table
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
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own subscriptions"
ON push_subscriptions FOR ALL
USING (auth.uid() = profile_id);

CREATE POLICY "Anyone can view notification queue"
ON notification_queue FOR SELECT
USING (true);

CREATE POLICY "Admins and club admins can manage notification queue"
ON notification_queue FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true OR role = 'club_admin'
  )
);

-- Create or replace the notify_users function
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
    ARRAY(
      SELECT id FROM profiles
      WHERE (notification_preferences->>'push_enabled')::boolean = true
      AND id IN (
        SELECT profile_id FROM push_subscriptions
      )
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for notifications
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