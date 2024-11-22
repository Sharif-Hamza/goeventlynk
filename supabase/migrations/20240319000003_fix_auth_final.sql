-- Drop existing tables and constraints
DROP TABLE IF EXISTS event_registrations CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS clubs CASCADE;

-- Create clubs table
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  admin_email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create profiles table with proper structure
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  is_admin BOOLEAN DEFAULT false,
  club_id UUID REFERENCES clubs(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  notification_preferences JSONB DEFAULT jsonb_build_object(
    'push_enabled', false,
    'events', true,
    'announcements', true
  ),
  CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'club_admin', 'user'))
);

-- Create events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT NOT NULL,
  price DECIMAL(10,2) DEFAULT 0,
  capacity INTEGER NOT NULL,
  image_url TEXT,
  admin_id UUID REFERENCES profiles(id),
  club_id UUID REFERENCES clubs(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create announcements table
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  admin_id UUID REFERENCES profiles(id),
  club_id UUID REFERENCES clubs(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  reaction_counts JSONB DEFAULT '{}'::jsonb
);

-- Create event registrations table
CREATE TABLE event_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  email TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT event_registrations_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Insert initial clubs
INSERT INTO clubs (name, admin_email, description)
VALUES 
  ('CCNY Soccer Club', 'ttnt745@gmail.com', 'Official CCNY Soccer Club'),
  ('EventLynk Admin', 'hsharif701@gmail.com', 'Main EventLynk Administration');

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  matching_club clubs%ROWTYPE;
  user_email TEXT;
BEGIN
  -- Get email from auth.users
  SELECT email INTO user_email 
  FROM auth.users 
  WHERE id = NEW.id;

  -- Set basic user data
  NEW.email := user_email;
  NEW.created_at := NOW();
  NEW.updated_at := NOW();
  
  -- Check if user should be main admin
  IF user_email = 'hsharif701@gmail.com' THEN
    NEW.role := 'admin';
    NEW.is_admin := true;
    NEW.username := 'Admin';
    RETURN NEW;
  END IF;
  
  -- Check if user should be club admin
  SELECT * INTO matching_club 
  FROM clubs 
  WHERE admin_email = user_email;
  
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
  NEW.username := split_part(user_email, '@', 1);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT 
USING (true);

CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
ON profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

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

CREATE POLICY "Anyone can view registrations"
ON event_registrations FOR SELECT
USING (
  auth.uid() = user_id 
  OR auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
  OR auth.uid() IN (
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
  OR auth.uid() IN (
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
  OR auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
  OR auth.uid() IN (
    SELECT p.id FROM profiles p
    JOIN events e ON e.club_id = p.club_id
    WHERE e.id = event_registrations.event_id
    AND p.role = 'club_admin'
  )
);