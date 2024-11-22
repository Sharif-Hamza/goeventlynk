-- Create push_subscriptions table
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, subscription)
);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own subscriptions"
ON push_subscriptions
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
ON push_subscriptions
FOR SELECT USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
);

-- Add notification settings to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT jsonb_build_object(
  'events', true,
  'announcements', true,
  'web_push_enabled', false
);

-- Create function to send notifications
CREATE OR REPLACE FUNCTION notify_users()
RETURNS TRIGGER AS $$
DECLARE
  notification_type TEXT;
  notification_title TEXT;
  notification_body TEXT;
  notification_url TEXT;
BEGIN
  IF TG_TABLE_NAME = 'events' THEN
    notification_type := 'events';
    notification_title := 'New Event: ' || NEW.title;
    notification_body := SUBSTRING(NEW.description FROM 1 FOR 200);
    notification_url := '/events';
  ELSIF TG_TABLE_NAME = 'announcements' THEN
    notification_type := 'announcements';
    notification_title := 'New Announcement: ' || NEW.title;
    notification_body := SUBSTRING(NEW.content FROM 1 FOR 200);
    notification_url := '/announcements';
  END IF;

  -- Queue notification for processing
  INSERT INTO notification_queue (
    type,
    title,
    body,
    url,
    target_users
  )
  SELECT
    notification_type,
    notification_title,
    notification_body,
    notification_url,
    ARRAY_AGG(id)
  FROM profiles
  WHERE (notification_settings->>'web_push_enabled')::boolean = true
    AND (notification_settings->>notification_type)::boolean = true
  GROUP BY 1, 2, 3, 4;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create notification queue table
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT NOT NULL,
  target_users UUID[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  error TEXT
);

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