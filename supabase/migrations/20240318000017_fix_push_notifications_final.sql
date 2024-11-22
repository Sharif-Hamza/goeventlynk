-- Drop existing tables if they exist
DROP TABLE IF EXISTS push_subscriptions CASCADE;
DROP TABLE IF EXISTS notification_queue CASCADE;

-- Create push_subscriptions table with correct structure
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  auth TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(profile_id, endpoint)
);

-- Create notification queue table
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  error TEXT
);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for push_subscriptions
CREATE POLICY "Users can manage their own subscriptions"
ON push_subscriptions
FOR ALL USING (auth.uid() = profile_id);

CREATE POLICY "Admins can view all subscriptions"
ON push_subscriptions
FOR SELECT USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
);

-- Create RLS policies for notification_queue
CREATE POLICY "Admins and club admins can manage notification queue"
ON notification_queue
FOR ALL USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true OR role = 'club_admin'
  )
);

-- Add notification preferences to profiles if not exists
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT jsonb_build_object(
  'push_enabled', false,
  'events', true,
  'announcements', true
);