-- Drop existing tables if they exist
DROP TABLE IF EXISTS push_subscriptions CASCADE;

-- Create push_subscriptions table
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create unique index for endpoint
CREATE UNIQUE INDEX push_subscriptions_endpoint_idx ON push_subscriptions ((subscription->>'endpoint'), user_id);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own subscriptions"
ON push_subscriptions FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view subscriptions"
ON push_subscriptions FOR SELECT
USING (true);

-- Add notification preferences to profiles if not exists
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT jsonb_build_object(
  'push_enabled', false,
  'events', true,
  'announcements', true
);

-- Create function to handle notification triggers
CREATE OR REPLACE FUNCTION handle_notification() 
RETURNS TRIGGER AS $$
BEGIN
  -- Notify through Postgres NOTIFY
  PERFORM pg_notify(
    'push_notification',
    json_build_object(
      'title', 
      CASE 
        WHEN TG_TABLE_NAME = 'events' THEN 'New Event: ' || NEW.title
        ELSE 'New Announcement: ' || NEW.title
      END,
      'body',
      CASE 
        WHEN TG_TABLE_NAME = 'events' THEN SUBSTRING(NEW.description FROM 1 FOR 200)
        ELSE SUBSTRING(NEW.content FROM 1 FOR 200)
      END,
      'url',
      CASE 
        WHEN TG_TABLE_NAME = 'events' THEN '/events'
        ELSE '/announcements'
      END
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