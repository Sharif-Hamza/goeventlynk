-- Drop all existing policies
DO $$ 
BEGIN
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON ' || quote_ident(tablename) || ';', E'\n')
        FROM pg_policies 
        WHERE tablename IN ('events', 'announcements', 'event_registrations', 'announcement_reactions')
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Create simplified policies for events
CREATE POLICY "Anyone can view events"
ON events FOR SELECT
USING (true);

CREATE POLICY "Admins and club admins can manage events"
ON events
FOR ALL
USING (
    (
        SELECT is_admin 
        FROM profiles 
        WHERE id = auth.uid()
    )
    OR 
    (
        SELECT true 
        FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'club_admin' 
        AND club_id = events.club_id
    )
);

-- Create simplified policies for announcements
CREATE POLICY "Anyone can view announcements"
ON announcements FOR SELECT
USING (true);

CREATE POLICY "Admins and club admins can manage announcements"
ON announcements
FOR ALL
USING (
    (
        SELECT is_admin 
        FROM profiles 
        WHERE id = auth.uid()
    )
    OR 
    (
        SELECT true 
        FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'club_admin' 
        AND club_id = announcements.club_id
    )
);

-- Update handle_new_user function to properly set admin roles
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  matching_club clubs%ROWTYPE;
BEGIN
  -- Set email from auth.users
  NEW.email := (SELECT email FROM auth.users WHERE id = NEW.id);
  
  -- Check if user should be main admin
  IF NEW.email = 'hsharif701@gmail.com' THEN
    NEW.role := 'admin';
    NEW.is_admin := true;
    RETURN NEW;
  END IF;
  
  -- Check if user should be club admin
  SELECT * INTO matching_club FROM clubs 
  WHERE admin_email = NEW.email;
  
  IF matching_club.id IS NOT NULL THEN
    NEW.role := 'club_admin';
    NEW.club_id := matching_club.id;
    NEW.is_admin := false;
    RETURN NEW;
  END IF;
  
  -- Default to regular user
  NEW.role := 'user';
  NEW.is_admin := false;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure existing admin users have correct permissions
UPDATE profiles 
SET 
  is_admin = true,
  role = 'admin'
WHERE email = 'hsharif701@gmail.com';

UPDATE profiles 
SET 
  role = 'club_admin',
  is_admin = false
WHERE email = 'ttnt745@gmail.com';

-- Add event occupancy tracking
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