-- First, drop existing policies
DO $$ 
BEGIN
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON ' || quote_ident(tablename) || ';', E'\n')
        FROM pg_policies 
        WHERE tablename IN ('events', 'announcements', 'event_registrations')
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Ensure profiles table has correct columns
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

-- Create proper policies for events
CREATE POLICY "Anyone can view events"
ON events FOR SELECT
USING (true);

CREATE POLICY "Admins and club admins can manage their events"
ON events FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE is_admin = true 
    OR (role = 'club_admin' AND club_id = events.club_id)
  )
);

-- Create proper policies for announcements
CREATE POLICY "Anyone can view announcements"
ON announcements FOR SELECT
USING (true);

CREATE POLICY "Admins and club admins can manage their announcements"
ON announcements FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE is_admin = true 
    OR (role = 'club_admin' AND club_id = announcements.club_id)
  )
);

-- Create proper policies for event registrations
CREATE POLICY "Anyone can view registrations"
ON event_registrations FOR SELECT
USING (
  -- Users can view their own registrations
  auth.uid() = user_id 
  OR 
  -- Admins can view all registrations
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
  OR
  -- Club admins can view registrations for their club's events
  auth.uid() IN (
    SELECT p.id FROM profiles p
    JOIN events e ON e.club_id = p.club_id
    WHERE e.id = event_registrations.event_id
    AND p.role = 'club_admin'
  )
);

CREATE POLICY "Authenticated users can create registrations"
ON event_registrations FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = user_id
);

CREATE POLICY "Admins and club admins can update registrations"
ON event_registrations FOR UPDATE
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
  OR
  auth.uid() IN (
    SELECT p.id FROM profiles p
    JOIN events e ON e.club_id = p.club_id
    WHERE e.id = event_registrations.event_id
    AND p.role = 'club_admin'
  )
);

CREATE POLICY "Users can delete registrations"
ON event_registrations FOR DELETE
USING (
  auth.uid() = user_id
  OR
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
  OR
  auth.uid() IN (
    SELECT p.id FROM profiles p
    JOIN events e ON e.club_id = p.club_id
    WHERE e.id = event_registrations.event_id
    AND p.role = 'club_admin'
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