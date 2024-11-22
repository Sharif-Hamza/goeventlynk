-- Add Stripe-related columns to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT;

-- Add Stripe-related columns to event_registrations table
ALTER TABLE event_registrations
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2);

-- Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT NOT NULL,
  card_last4 TEXT NOT NULL,
  card_brand TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, stripe_payment_method_id)
);

-- Enable RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for payment_methods
CREATE POLICY "Users can manage their own payment methods"
ON payment_methods FOR ALL
USING (auth.uid() = user_id);

-- Create function to handle payment status updates
CREATE OR REPLACE FUNCTION handle_payment_status_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If payment is successful, update event registration status
  IF NEW.stripe_payment_status = 'succeeded' THEN
    NEW.status := 'approved';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for payment status updates
CREATE TRIGGER on_payment_status_update
  BEFORE UPDATE ON event_registrations
  FOR EACH ROW
  WHEN (OLD.stripe_payment_status IS DISTINCT FROM NEW.stripe_payment_status)
  EXECUTE FUNCTION handle_payment_status_update();