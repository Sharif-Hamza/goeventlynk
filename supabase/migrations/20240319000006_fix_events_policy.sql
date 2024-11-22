-- Drop existing event policies
DROP POLICY IF EXISTS "Anyone can view events" ON events;
DROP POLICY IF EXISTS "Admins and club admins can manage their events" ON events;

-- Create proper event policies
CREATE POLICY "Anyone can view events"
ON events FOR SELECT
USING (true);

CREATE POLICY "Admins and club admins can create events"
ON events FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE is_admin = true 
    OR (role = 'club_admin' AND club_id = events.club_id)
  )
);

CREATE POLICY "Admins and club admins can update events"
ON events FOR UPDATE
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE is_admin = true 
    OR (role = 'club_admin' AND club_id = events.club_id)
  )
);

CREATE POLICY "Admins and club admins can delete events"
ON events FOR DELETE
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE is_admin = true 
    OR (role = 'club_admin' AND club_id = events.club_id)
  )
);

-- Add occupancy tracking
ALTER TABLE events
ADD COLUMN IF NOT EXISTS current_occupancy INTEGER DEFAULT 0;

-- Create function to update occupancy
CREATE OR REPLACE FUNCTION update_event_occupancy()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
    UPDATE events 
    SET current_occupancy = current_occupancy + 1
    WHERE id = NEW.event_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE events 
    SET current_occupancy = current_occupancy + 1
    WHERE id = NEW.event_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status != 'approved' AND OLD.status = 'approved' THEN
    UPDATE events 
    SET current_occupancy = current_occupancy - 1
    WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
    UPDATE events 
    SET current_occupancy = current_occupancy - 1
    WHERE id = OLD.event_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for occupancy updates
DROP TRIGGER IF EXISTS update_occupancy ON event_registrations;
CREATE TRIGGER update_occupancy
  AFTER INSERT OR UPDATE OR DELETE ON event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_event_occupancy();