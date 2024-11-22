-- Add payment fields to event_registrations if they don't exist
ALTER TABLE event_registrations
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Create function to handle payment status updates
CREATE OR REPLACE FUNCTION handle_payment_status_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If payment is successful, update event registration status
  IF NEW.payment_status = 'paid' AND OLD.payment_status != 'paid' THEN
    -- Status remains pending until admin approves
    NEW.status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment status updates
DROP TRIGGER IF EXISTS on_payment_status_update ON event_registrations;
CREATE TRIGGER on_payment_status_update
  BEFORE UPDATE ON event_registrations
  FOR EACH ROW
  WHEN (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
  EXECUTE FUNCTION handle_payment_status_update();