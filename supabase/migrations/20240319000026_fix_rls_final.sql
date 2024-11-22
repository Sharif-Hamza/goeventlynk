-- First, drop ALL existing policies
DO $$ 
BEGIN
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON ' || quote_ident(tablename) || ';', E'\n')
        FROM pg_policies 
        WHERE tablename IN ('events', 'announcements', 'event_registrations', 'announcement_reactions', 'profiles')
    );
END $$;

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reactions ENABLE ROW LEVEL SECURITY;

-- Create simplified RLS policies
-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone"
ON profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Events policies
CREATE POLICY "Events are viewable by everyone"
ON events FOR SELECT
USING (true);

CREATE POLICY "Admins and club admins can insert events"
ON events FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role = 'club_admin')
  )
);

CREATE POLICY "Admins and club admins can update events"
ON events FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role = 'club_admin')
  )
);

CREATE POLICY "Admins and club admins can delete events"
ON events FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role = 'club_admin')
  )
);

-- Announcements policies
CREATE POLICY "Announcements are viewable by everyone"
ON announcements FOR SELECT
USING (true);

CREATE POLICY "Admins and club admins can insert announcements"
ON announcements FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role = 'club_admin')
  )
);

CREATE POLICY "Admins and club admins can update announcements"
ON announcements FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role = 'club_admin')
  )
);

CREATE POLICY "Admins and club admins can delete announcements"
ON announcements FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role = 'club_admin')
  )
);

-- Event registrations policies
CREATE POLICY "Registrations are viewable by everyone"
ON event_registrations FOR SELECT
USING (true);

CREATE POLICY "Users can create registrations"
ON event_registrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and club admins can update registrations"
ON event_registrations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role = 'club_admin')
  )
);

CREATE POLICY "Admins and club admins can delete registrations"
ON event_registrations FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role = 'club_admin')
  )
);

-- Reactions policies
CREATE POLICY "Reactions are viewable by everyone"
ON announcement_reactions FOR SELECT
USING (true);

CREATE POLICY "Users can add reactions"
ON announcement_reactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove reactions"
ON announcement_reactions FOR DELETE
USING (auth.uid() = user_id);

-- Storage policies
CREATE POLICY "Public storage access"
ON storage.objects FOR SELECT
USING (true);

CREATE POLICY "Admin storage management"
ON storage.objects FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    JOIN public.profiles ON profiles.id = auth.users.id
    WHERE auth.users.id = auth.uid()
    AND (profiles.is_admin = true OR profiles.role = 'club_admin')
  )
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