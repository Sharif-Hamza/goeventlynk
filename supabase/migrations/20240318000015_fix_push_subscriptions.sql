-- Drop existing push_subscriptions table if it exists
DROP TABLE IF EXISTS push_subscriptions;

-- Create push_subscriptions table with proper structure
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can insert subscriptions"
ON push_subscriptions FOR INSERT
WITH CHECK (true);

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