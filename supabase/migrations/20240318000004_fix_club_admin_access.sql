-- First, ensure ttnt745@gmail.com has the correct role and club_id
UPDATE profiles 
SET 
  role = 'club_admin',
  is_admin = false
WHERE email = 'ttnt745@gmail.com';

-- Update the handle_new_user function to properly set club admin
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
    NEW.username := matching_club.name;
    NEW.is_admin := false;
    RETURN NEW;
  END IF;
  
  -- Default to regular user
  NEW.role := 'user';
  NEW.is_admin := false;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies to properly handle club admins
DROP POLICY IF EXISTS "Admins and club admins can access dashboard" ON profiles;
CREATE POLICY "Admins and club admins can access dashboard" ON profiles
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE is_admin = true OR role = 'club_admin'
    )
  );

-- Update events policies
DROP POLICY IF EXISTS "Club admins can manage their events" ON events;
CREATE POLICY "Club admins can manage their events" ON events
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE (role = 'club_admin' AND club_id = events.club_id)
      OR is_admin = true
    )
  );

-- Update announcements policies
DROP POLICY IF EXISTS "Club admins can manage their announcements" ON announcements;
CREATE POLICY "Club admins can manage their announcements" ON announcements
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE (role = 'club_admin' AND club_id = announcements.club_id)
      OR is_admin = true
    )
  );

-- Update event registrations policies for club admins
DROP POLICY IF EXISTS "Club admins can manage their registrations" ON event_registrations;
CREATE POLICY "Club admins can manage their registrations" ON event_registrations
  FOR ALL USING (
    auth.uid() IN (
      SELECT p.id FROM profiles p
      JOIN events e ON e.club_id = p.club_id
      WHERE p.role = 'club_admin' AND e.id = event_registrations.event_id
    )
  );