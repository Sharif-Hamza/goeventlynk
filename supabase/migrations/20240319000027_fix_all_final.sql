-- First, drop ALL existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop storage policies
    FOR r IN (SELECT policyname 
              FROM pg_policies 
              WHERE schemaname = 'storage' 
              AND tablename = 'objects') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    END LOOP;

    -- Drop other policies
    FOR r IN (SELECT schemaname, tablename, policyname 
              FROM pg_policies 
              WHERE tablename IN (
                'events', 
                'announcements', 
                'event_registrations', 
                'announcement_reactions', 
                'profiles'
              )) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('events', 'events', true),
  ('announcements', 'announcements', true)
ON CONFLICT (id) DO NOTHING;

-- Create single storage policy
CREATE POLICY "storage_policy"
ON storage.objects FOR ALL
USING (
  CASE 
    WHEN auth.uid() IS NULL THEN bucket_id IN ('events', 'announcements')  -- Allow public read
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role = 'club_admin')
    ) THEN true  -- Allow admins and club admins full access
    ELSE bucket_id IN ('events', 'announcements')  -- Allow others to read only
  END
);

-- Create single policy for events
CREATE POLICY "event_policy"
ON events FOR ALL
USING (
  CASE 
    WHEN auth.uid() IS NULL THEN true  -- Allow public read
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role = 'club_admin')
    ) THEN true  -- Allow admins and club admins full access
    ELSE false  -- Deny others
  END
);

-- Create single policy for announcements
CREATE POLICY "announcement_policy"
ON announcements FOR ALL
USING (
  CASE 
    WHEN auth.uid() IS NULL THEN true  -- Allow public read
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role = 'club_admin')
    ) THEN true  -- Allow admins and club admins full access
    ELSE false  -- Deny others
  END
);

-- Create single policy for event registrations
CREATE POLICY "registration_policy"
ON event_registrations FOR ALL
USING (
  CASE
    WHEN auth.uid() IS NULL THEN true  -- Allow public read
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role = 'club_admin')
    ) THEN true  -- Allow admins and club admins full access
    WHEN auth.uid() = user_id THEN true  -- Allow users to manage their own registrations
    ELSE false  -- Deny others
  END
);

-- Create single policy for reactions
CREATE POLICY "reaction_policy"
ON announcement_reactions FOR ALL
USING (
  CASE
    WHEN auth.uid() IS NULL THEN true  -- Allow public read
    WHEN auth.uid() = user_id THEN true  -- Allow users to manage their own reactions
    ELSE false  -- Deny others
  END
);

-- Create single policy for profiles
CREATE POLICY "profile_policy"
ON profiles FOR ALL
USING (
  CASE
    WHEN auth.uid() IS NULL THEN true  -- Allow public read
    WHEN auth.uid() = id THEN true  -- Allow users to manage their own profile
    ELSE false  -- Deny others
  END
);

-- Update handle_new_user function
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON profiles;
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Update existing admin users
UPDATE profiles 
SET 
  is_admin = true,
  role = 'admin'
WHERE email = 'hsharif701@gmail.com';

UPDATE profiles 
SET 
  role = 'club_admin',
  is_admin = false,
  club_id = (SELECT id FROM clubs WHERE admin_email = profiles.email),
  username = (SELECT name FROM clubs WHERE admin_email = profiles.email)
WHERE email = 'ttnt745@gmail.com';