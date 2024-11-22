-- Drop existing tables if they exist
DROP TABLE IF EXISTS announcement_comments CASCADE;
DROP TABLE IF EXISTS announcement_reactions CASCADE;

-- Create announcement reactions table
CREATE TABLE announcement_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_reaction UNIQUE (announcement_id, user_id, reaction_type)
);

-- Enable RLS
ALTER TABLE announcement_reactions ENABLE ROW LEVEL SECURITY;

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

-- Add payment_status to event_registrations
ALTER TABLE event_registrations
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS payment_link TEXT,
ADD CONSTRAINT valid_payment_status CHECK (payment_status IN ('pending', 'paid', 'failed'));

-- Create function to handle payment status updates
CREATE OR REPLACE FUNCTION handle_payment_status_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If payment is successful, update event registration status
  IF NEW.payment_status = 'paid' AND OLD.payment_status != 'paid' THEN
    NEW.status := 'approved';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for payment status updates
CREATE TRIGGER on_payment_status_update
  BEFORE UPDATE ON event_registrations
  FOR EACH ROW
  WHEN (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
  EXECUTE FUNCTION handle_payment_status_update();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_event_registrations_payment_status ON event_registrations(payment_status);
CREATE INDEX IF NOT EXISTS idx_announcement_reactions_type ON announcement_reactions(reaction_type);