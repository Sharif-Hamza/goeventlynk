-- First, ensure clubs table is properly set up
CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  admin_email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert initial clubs if they don't exist
INSERT INTO clubs (name, admin_email, description)
VALUES 
  ('CCNY Soccer Club', 'ttnt745@gmail.com', 'Official CCNY Soccer Club'),
  ('EventLynk Admin', 'hsharif701@gmail.com', 'Main EventLynk Administration')
ON CONFLICT (admin_email) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

-- Update handle_new_user function to properly set club associations
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
    NEW.username := 'Admin';
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
  NEW.username := split_part(NEW.email, '@', 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing club admin users
UPDATE profiles 
SET 
  role = 'club_admin',
  is_admin = false,
  club_id = (SELECT id FROM clubs WHERE admin_email = profiles.email),
  username = (SELECT name FROM clubs WHERE admin_email = profiles.email)
WHERE email = 'ttnt745@gmail.com';

-- Create policies for events with club_id checks
DROP POLICY IF EXISTS "event_policy" ON events;
CREATE POLICY "event_policy"
ON events FOR ALL
USING (
  CASE 
    WHEN auth.uid() IS NULL THEN true  -- Allow public read
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    ) THEN true  -- Allow admins full access
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'club_admin'
      AND club_id = events.club_id
    ) THEN true  -- Allow club admins access to their events
    ELSE false  -- Deny others
  END
);

-- Create policies for announcements with club_id checks
DROP POLICY IF EXISTS "announcement_policy" ON announcements;
CREATE POLICY "announcement_policy"
ON announcements FOR ALL
USING (
  CASE 
    WHEN auth.uid() IS NULL THEN true  -- Allow public read
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    ) THEN true  -- Allow admins full access
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'club_admin'
      AND club_id = announcements.club_id
    ) THEN true  -- Allow club admins access to their announcements
    ELSE false  -- Deny others
  END
);