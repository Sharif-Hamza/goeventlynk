-- First, drop existing tables in correct order
DROP TABLE IF EXISTS announcement_reactions CASCADE;
DROP TABLE IF EXISTS announcement_likes CASCADE;
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

-- Create profiles table with is_admin
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
  likes INTEGER DEFAULT 0
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

-- Create announcement reactions table
CREATE TABLE announcement_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
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

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON profiles;
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
ALTER TABLE announcement_reactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Clubs policies
CREATE POLICY "Public clubs are viewable by everyone" ON clubs
  FOR SELECT USING (true);

CREATE POLICY "Only admins can modify clubs" ON clubs
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE is_admin = true
    )
  );

-- Events policies
CREATE POLICY "Events are viewable by everyone" ON events
  FOR SELECT USING (true);

CREATE POLICY "Admins and club admins can create events" ON events
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE is_admin = true 
      OR (role = 'club_admin' AND club_id = events.club_id)
    )
  );

CREATE POLICY "Admins and club admins can update their events" ON events
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE is_admin = true 
      OR (role = 'club_admin' AND club_id = events.club_id)
    )
  );

CREATE POLICY "Admins and club admins can delete their events" ON events
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE is_admin = true 
      OR (role = 'club_admin' AND club_id = events.club_id)
    )
  );

-- Announcements policies
CREATE POLICY "Announcements are viewable by everyone" ON announcements
  FOR SELECT USING (true);

CREATE POLICY "Admins and club admins can create announcements" ON announcements
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE is_admin = true 
      OR (role = 'club_admin' AND club_id = announcements.club_id)
    )
  );

CREATE POLICY "Admins and club admins can update their announcements" ON announcements
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE is_admin = true 
      OR (role = 'club_admin' AND club_id = announcements.club_id)
    )
  );

CREATE POLICY "Admins and club admins can delete their announcements" ON announcements
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE is_admin = true 
      OR (role = 'club_admin' AND club_id = announcements.club_id)
    )
  );

-- Event registrations policies
CREATE POLICY "Users can view their own registrations" ON event_registrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins and club admins can view all registrations" ON event_registrations
  FOR SELECT USING (
    auth.uid() IN (
      SELECT p.id FROM profiles p
      LEFT JOIN events e ON e.club_id = p.club_id
      WHERE p.is_admin = true 
      OR (p.role = 'club_admin' AND e.id = event_registrations.event_id)
    )
  );

CREATE POLICY "Users can create their own registrations" ON event_registrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Announcement reactions policies
CREATE POLICY "Everyone can view reactions" ON announcement_reactions
  FOR SELECT USING (true);

CREATE POLICY "Users can add their own reactions" ON announcement_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own reactions" ON announcement_reactions
  FOR DELETE USING (auth.uid() = user_id);