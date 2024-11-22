-- Add current_occupancy to events table if it doesn't exist
ALTER TABLE events
ADD COLUMN IF NOT EXISTS current_occupancy INTEGER DEFAULT 0;

-- Create function to update event occupancy
CREATE OR REPLACE FUNCTION update_event_occupancy()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
    UPDATE events 
    SET current_occupancy = current_occupancy + 1
    WHERE id = NEW.event_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
      UPDATE events 
      SET current_occupancy = current_occupancy + 1
      WHERE id = NEW.event_id;
    ELSIF NEW.status != 'approved' AND OLD.status = 'approved' THEN
      UPDATE events 
      SET current_occupancy = GREATEST(current_occupancy - 1, 0)
      WHERE id = NEW.event_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
    UPDATE events 
    SET current_occupancy = GREATEST(current_occupancy - 1, 0)
    WHERE id = OLD.event_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_occupancy ON event_registrations;

-- Create trigger for occupancy updates
CREATE TRIGGER update_occupancy
  AFTER INSERT OR UPDATE OR DELETE ON event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_event_occupancy();