-- Drop existing policies
DROP POLICY IF EXISTS "Users can create their own registrations" ON event_registrations;
DROP POLICY IF EXISTS "Users can view their own registrations" ON event_registrations;
DROP POLICY IF EXISTS "Admins and club admins can manage registrations" ON event_registrations;
DROP POLICY IF EXISTS "Club admins can manage their registrations" ON event_registrations;

-- Create new policies
CREATE POLICY "Anyone can view registrations"
ON event_registrations FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create registrations"
ON event_registrations FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can manage their own registrations"
ON event_registrations FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins and club admins can manage all registrations"
ON event_registrations FOR UPDATE
USING (
  auth.uid() IN (
    SELECT p.id FROM profiles p
    LEFT JOIN events e ON e.club_id = p.club_id
    WHERE e.id = event_registrations.event_id
    AND (p.is_admin = true OR p.role = 'club_admin')
  )
);