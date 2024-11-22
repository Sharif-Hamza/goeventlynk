-- Drop existing policies for event_registrations
DROP POLICY IF EXISTS "Users can create their own registrations" ON event_registrations;
DROP POLICY IF EXISTS "Users can view their own registrations" ON event_registrations;
DROP POLICY IF EXISTS "Admins and club admins can manage registrations" ON event_registrations;
DROP POLICY IF EXISTS "Admins and club admins can update registrations" ON event_registrations;
DROP POLICY IF EXISTS "Admins and club admins can delete registrations" ON event_registrations;

-- Create new policies for event_registrations
CREATE POLICY "Anyone can create registrations"
ON event_registrations FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can view their own registrations"
ON event_registrations FOR SELECT
USING (
  auth.uid() = user_id OR
  auth.uid() IN (
    SELECT p.id FROM profiles p
    JOIN events e ON e.club_id = p.club_id
    WHERE e.id = event_registrations.event_id
    AND (p.is_admin = true OR p.role = 'club_admin')
  )
);

CREATE POLICY "Admins and club admins can update registrations"
ON event_registrations FOR UPDATE
USING (
  auth.uid() IN (
    SELECT p.id FROM profiles p
    JOIN events e ON e.club_id = p.club_id
    WHERE e.id = event_registrations.event_id
    AND (p.is_admin = true OR p.role = 'club_admin')
  )
);

CREATE POLICY "Admins and club admins can delete registrations"
ON event_registrations FOR DELETE
USING (
  auth.uid() IN (
    SELECT p.id FROM profiles p
    JOIN events e ON e.club_id = p.club_id
    WHERE e.id = event_registrations.event_id
    AND (p.is_admin = true OR p.role = 'club_admin')
  )
);