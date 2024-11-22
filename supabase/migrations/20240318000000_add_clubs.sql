-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- First, drop existing constraints if they exist
DO $$ BEGIN
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Drop existing tables if they exist (in reverse order of dependencies)
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

-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
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

-- Recreate announcement reactions table
CREATE TABLE announcement_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
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
BEGIN
  -- Check if the user's email matches any club admin_email
  SELECT * INTO matching_club FROM clubs 
  WHERE admin_email = NEW.email;
  
  IF matching_club.id IS NOT NULL THEN
    -- Set as club admin
    NEW.role := 'club_admin';
    NEW.club_id := matching_club.id;
  ELSIF NEW.email = 'hsharif701@gmail.com' THEN
    -- Set as main admin
    NEW.role := 'admin';
  ELSE
    -- Regular user
    NEW.role := 'user';
  END IF;
  
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
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Public clubs are viewable by everyone" ON clubs
  FOR SELECT USING (true);

CREATE POLICY "Only admins can modify clubs" ON clubs
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "Club admins can create events for their club" ON events
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE (role = 'club_admin' AND club_id = events.club_id)
      OR role = 'admin'
    )
  );

CREATE POLICY "Club admins can create announcements for their club" ON announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE (role = 'club_admin' AND club_id = announcements.club_id)
      OR role = 'admin'
    )
  );

-- Add update and delete policies for events
CREATE POLICY "Club admins can update their club events" ON events
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE (role = 'club_admin' AND club_id = events.club_id)
      OR role = 'admin'
    )
  );

CREATE POLICY "Club admins can delete their club events" ON events
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE (role = 'club_admin' AND club_id = events.club_id)
      OR role = 'admin'
    )
  );

-- Add update and delete policies for announcements
CREATE POLICY "Club admins can update their club announcements" ON announcements
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE (role = 'club_admin' AND club_id = announcements.club_id)
      OR role = 'admin'
    )
  );

CREATE POLICY "Club admins can delete their club announcements" ON announcements
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE (role = 'club_admin' AND club_id = announcements.club_id)
      OR role = 'admin'
    )
  );

-- Add policies for announcement reactions
CREATE POLICY "Users can add reactions" ON announcement_reactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their reactions" ON announcement_reactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Everyone can view reactions" ON announcement_reactions
  FOR SELECT USING (true);