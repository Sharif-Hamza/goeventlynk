-- Drop existing tables
DROP TABLE IF EXISTS push_subscriptions CASCADE;
DROP TABLE IF EXISTS notification_queue CASCADE;

-- Create push_subscriptions table
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, subscription->>'endpoint')
);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own subscriptions"
ON push_subscriptions FOR ALL
USING (auth.uid() = user_id);

-- Add notification preferences to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT jsonb_build_object(
  'push_enabled', false,
  'events', true,
  'announcements', true
);

-- Create function to handle notifications
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
    notification_body := SUBSTRING(NEW.description FROM 1 FOR 200);
    notification_url := '/events';
  ELSIF TG_TABLE_NAME = 'announcements' THEN
    notification_title := 'New Announcement: ' || NEW.title;
    notification_body := SUBSTRING(NEW.content FROM 1 FOR 200);
    notification_url := '/announcements';
  END IF;

  -- Notify all subscribers through Postgres NOTIFY
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

-- Create triggers for notifications
DROP TRIGGER IF EXISTS notify_on_event ON events;
CREATE TRIGGER notify_on_event
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION handle_notification();

DROP TRIGGER IF EXISTS notify_on_announcement ON announcements;
CREATE TRIGGER notify_on_announcement
  AFTER INSERT ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION handle_notification();