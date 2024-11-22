-- First, drop existing policies
DROP POLICY IF EXISTS "Admins and club admins can manage events" ON events;
DROP POLICY IF EXISTS "Admins and club admins can manage announcements" ON announcements;
DROP POLICY IF EXISTS "Admins and club admins can manage registrations" ON event_registrations;

-- Ensure the profiles table has the correct columns
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
CHECK (role IN ('admin', 'club_admin', 'user'));

-- Update existing admin users
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

-- Create or replace the function to handle new user registration
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

-- Create new RLS policies using both is_admin and role fields
CREATE POLICY "Admins and club admins can manage events"
ON events FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE is_admin = true 
    OR (role = 'club_admin' AND club_id = events.club_id)
  )
);

CREATE POLICY "Admins and club admins can manage announcements"
ON announcements FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE is_admin = true 
    OR (role = 'club_admin' AND club_id = announcements.club_id)
  )
);

CREATE POLICY "Admins and club admins can manage registrations"
ON event_registrations FOR ALL
USING (
  auth.uid() IN (
    SELECT p.id FROM profiles p
    LEFT JOIN events e ON e.club_id = p.club_id
    WHERE e.id = event_registrations.event_id
    AND (p.is_admin = true OR p.role = 'club_admin')
  )
);