-- Drop existing policies
DROP POLICY IF EXISTS "Club admins can create events" ON events;
DROP POLICY IF EXISTS "Club admins can create announcements" ON announcements;
DROP POLICY IF EXISTS "Club admins can manage registrations" ON event_registrations;

-- Create new policies for events
CREATE POLICY "Club admins can create events" ON events
  FOR INSERT 
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE (role = 'club_admin' AND club_id = events.club_id)
      OR is_admin = true
    )
  );

CREATE POLICY "Club admins can update events" ON events
  FOR UPDATE 
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE (role = 'club_admin' AND club_id = events.club_id)
      OR is_admin = true
    )
  );

CREATE POLICY "Club admins can delete events" ON events
  FOR DELETE 
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE (role = 'club_admin' AND club_id = events.club_id)
      OR is_admin = true
    )
  );

-- Create new policies for announcements
CREATE POLICY "Club admins can create announcements" ON announcements
  FOR INSERT 
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE (role = 'club_admin' AND club_id = announcements.club_id)
      OR is_admin = true
    )
  );

CREATE POLICY "Club admins can update announcements" ON announcements
  FOR UPDATE 
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE (role = 'club_admin' AND club_id = announcements.club_id)
      OR is_admin = true
    )
  );

CREATE POLICY "Club admins can delete announcements" ON announcements
  FOR DELETE 
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE (role = 'club_admin' AND club_id = announcements.club_id)
      OR is_admin = true
    )
  );

-- Create new policies for event registrations
CREATE POLICY "Club admins can manage registrations" ON event_registrations
  FOR ALL 
  USING (
    auth.uid() IN (
      SELECT p.id FROM profiles p
      JOIN events e ON e.club_id = p.club_id
      WHERE (p.role = 'club_admin' AND e.id = event_registrations.event_id)
      OR p.is_admin = true
    )
  );

-- Ensure club admins have their club_id and username set correctly
UPDATE profiles p
SET 
  username = c.name,
  club_id = c.id
FROM clubs c
WHERE 
  p.email = c.admin_email 
  AND p.role = 'club_admin';