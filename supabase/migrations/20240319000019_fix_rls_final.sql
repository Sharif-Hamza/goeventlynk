-- First, drop ALL existing policies
DO $$ 
BEGIN
    -- Drop policies for events
    DROP POLICY IF EXISTS "Events are viewable by everyone" ON events;
    DROP POLICY IF EXISTS "Admins and club admins can manage events" ON events;
    DROP POLICY IF EXISTS "Admins can manage all events" ON events;
    DROP POLICY IF EXISTS "Club admins can manage their events" ON events;
    
    -- Drop policies for announcements
    DROP POLICY IF EXISTS "Announcements are viewable by everyone" ON announcements;
    DROP POLICY IF EXISTS "Admins and club admins can manage announcements" ON announcements;
    DROP POLICY IF EXISTS "Admins can manage all announcements" ON announcements;
    DROP POLICY IF EXISTS "Club admins can manage their announcements" ON announcements;
    
    -- Drop policies for event_registrations
    DROP POLICY IF EXISTS "Anyone can view registrations" ON event_registrations;
    DROP POLICY IF EXISTS "Users can create registrations" ON event_registrations;
    DROP POLICY IF EXISTS "Admins and club admins can manage registrations" ON event_registrations;
    
    -- Drop policies for storage
    DROP POLICY IF EXISTS "Anyone can view uploaded files" ON storage.objects;
    DROP POLICY IF EXISTS "Admins and club admins can upload files" ON storage.objects;
    DROP POLICY IF EXISTS "Public storage access" ON storage.objects;
    DROP POLICY IF EXISTS "Admin storage management" ON storage.objects;
END $$;

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('events', 'events', true),
  ('announcements', 'announcements', true)
ON CONFLICT (id) DO NOTHING;

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

-- Create policies for event registrations
CREATE POLICY "registration_policy"
ON event_registrations FOR ALL
USING (
  CASE
    WHEN auth.uid() IS NULL THEN false  -- Deny public access
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role = 'club_admin')
    ) THEN true  -- Allow admins and club admins full access
    WHEN auth.uid() = user_id THEN true  -- Allow users to manage their own registrations
    ELSE false  -- Deny others
  END
);

-- Create single storage policy
CREATE POLICY "storage_policy"
ON storage.objects FOR ALL
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