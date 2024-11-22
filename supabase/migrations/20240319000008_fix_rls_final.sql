-- Drop all existing policies
DO $$ 
BEGIN
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON ' || quote_ident(tablename) || ';', E'\n')
        FROM pg_policies 
        WHERE tablename IN ('events', 'announcements', 'event_registrations', 'announcement_reactions')
    );
END $$;

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('events', 'events', true),
  ('announcements', 'announcements', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Anyone can view event images"
ON storage.objects FOR SELECT
USING (bucket_id = 'events');

CREATE POLICY "Anyone can view announcement images"
ON storage.objects FOR SELECT
USING (bucket_id = 'announcements');

CREATE POLICY "Admins and club admins can upload event images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'events' 
  AND auth.role() = 'authenticated'
  AND (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role = 'club_admin')
    )
  )
);

CREATE POLICY "Admins and club admins can upload announcement images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'announcements' 
  AND auth.role() = 'authenticated'
  AND (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role = 'club_admin')
    )
  )
);

-- Create simplified policies for events
CREATE POLICY "Anyone can view events"
ON events FOR SELECT
USING (true);

CREATE POLICY "Admins can manage all events"
ON events FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);

CREATE POLICY "Club admins can manage their events"
ON events FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'club_admin'
    AND club_id = events.club_id
  )
);

-- Create simplified policies for announcements
CREATE POLICY "Anyone can view announcements"
ON announcements FOR SELECT
USING (true);

CREATE POLICY "Admins can manage all announcements"
ON announcements FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);

CREATE POLICY "Club admins can manage their announcements"
ON announcements FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'club_admin'
    AND club_id = announcements.club_id
  )
);

-- Create policies for event registrations
CREATE POLICY "Anyone can view registrations"
ON event_registrations FOR SELECT
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
  OR EXISTS (
    SELECT 1 FROM profiles p
    JOIN events e ON e.club_id = p.club_id
    WHERE p.id = auth.uid()
    AND e.id = event_registrations.event_id
    AND p.role = 'club_admin'
  )
);

CREATE POLICY "Users can create registrations"
ON event_registrations FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Admins and club admins can update registrations"
ON event_registrations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
  OR EXISTS (
    SELECT 1 FROM profiles p
    JOIN events e ON e.club_id = p.club_id
    WHERE p.id = auth.uid()
    AND e.id = event_registrations.event_id
    AND p.role = 'club_admin'
  )
);

-- Create policies for announcement reactions
CREATE POLICY "Anyone can view reactions"
ON announcement_reactions FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can add reactions"
ON announcement_reactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can remove their own reactions"
ON announcement_reactions FOR DELETE
USING (auth.uid() = user_id);

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

-- Ensure existing admin users have correct permissions
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