-- First, ensure all existing policies are removed
DROP POLICY IF EXISTS "Club admins can create events" ON events;
DROP POLICY IF EXISTS "Club admins can update events" ON events;
DROP POLICY IF EXISTS "Club admins can delete events" ON events;
DROP POLICY IF EXISTS "Club admins can create announcements" ON announcements;
DROP POLICY IF EXISTS "Club admins can update announcements" ON announcements;
DROP POLICY IF EXISTS "Club admins can delete announcements" ON announcements;

-- Simplified policies for events
CREATE POLICY "Anyone can view events" ON events FOR SELECT USING (true);

CREATE POLICY "Admins and club admins can manage events" ON events
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE is_admin = true OR role = 'club_admin'
    )
  );

-- Simplified policies for announcements
CREATE POLICY "Anyone can view announcements" ON announcements FOR SELECT USING (true);

CREATE POLICY "Admins and club admins can manage announcements" ON announcements
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE is_admin = true OR role = 'club_admin'
    )
  );

-- Update existing club admin users to ensure correct permissions
UPDATE profiles 
SET 
  role = 'club_admin',
  is_admin = false,
  username = (SELECT name FROM clubs WHERE admin_email = profiles.email)
WHERE email = 'ttnt745@gmail.com';

-- Ensure main admin has correct permissions
UPDATE profiles 
SET 
  role = 'admin',
  is_admin = true
WHERE email = 'hsharif701@gmail.com';