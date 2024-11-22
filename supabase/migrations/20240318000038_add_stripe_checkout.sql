-- Add Stripe Checkout table
CREATE TABLE stripe_checkout (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id TEXT UNIQUE,
  price_amount DECIMAL(10,2) NOT NULL,
  success_url TEXT NOT NULL,
  cancel_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending'
);

-- Enable RLS
ALTER TABLE stripe_checkout ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can create checkout sessions"
ON stripe_checkout FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own checkout sessions"
ON stripe_checkout FOR SELECT
USING (auth.uid() = user_id);

-- Add trigger function to handle successful checkouts
CREATE OR REPLACE FUNCTION handle_successful_checkout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'pending' THEN
    -- Create event registration
    INSERT INTO event_registrations (
      event_id,
      user_id,
      email,
      status,
      payment_amount
    )
    SELECT
      NEW.event_id,
      NEW.user_id,
      (SELECT email FROM profiles WHERE id = NEW.user_id),
      'approved',
      NEW.price_amount;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_checkout_completed
  AFTER UPDATE ON stripe_checkout
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status = 'pending')
  EXECUTE FUNCTION handle_successful_checkout();