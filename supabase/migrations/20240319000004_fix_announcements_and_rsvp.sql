-- Add announcement reactions table
CREATE TABLE IF NOT EXISTS announcement_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_reaction UNIQUE (announcement_id, user_id, reaction_type)
);

-- Add announcement comments table
CREATE TABLE IF NOT EXISTS announcement_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE announcement_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_comments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for reactions
CREATE POLICY "Anyone can view reactions"
ON announcement_reactions FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can add reactions"
ON announcement_reactions FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can remove their own reactions"
ON announcement_reactions FOR DELETE
USING (auth.uid() = user_id);

-- Create RLS policies for comments
CREATE POLICY "Anyone can view comments"
ON announcement_comments FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can add comments"
ON announcement_comments FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can manage their own comments"
ON announcement_comments FOR UPDATE OR DELETE
USING (auth.uid() = user_id);

-- Update event_registrations to include notification field
ALTER TABLE event_registrations
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false;

-- Create function to handle RSVP notifications
CREATE OR REPLACE FUNCTION notify_on_rsvp_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status AND NEW.status IN ('approved', 'rejected') AND NOT NEW.notification_sent THEN
    -- Insert into notification queue (you can customize this based on your notification system)
    INSERT INTO notification_queue (
      title,
      body,
      url,
      target_users
    ) VALUES (
      CASE 
        WHEN NEW.status = 'approved' THEN 'RSVP Approved'
        ELSE 'RSVP Rejected'
      END,
      CASE 
        WHEN NEW.status = 'approved' THEN 'Your RSVP request has been approved'
        ELSE 'Your RSVP request has been rejected'
      END,
      '/events',
      ARRAY[NEW.user_id]
    );
    
    -- Mark notification as sent
    NEW.notification_sent := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for RSVP notifications
CREATE TRIGGER on_rsvp_status_change
  BEFORE UPDATE ON event_registrations
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_on_rsvp_status_change();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_event_registrations_status ON event_registrations(status);
CREATE INDEX IF NOT EXISTS idx_announcement_reactions_user ON announcement_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_comments_announcement ON announcement_comments(announcement_id);