-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view registrations" ON event_registrations;
DROP POLICY IF EXISTS "Authenticated users can create registrations" ON event_registrations;
DROP POLICY IF EXISTS "Users can manage their own registrations" ON event_registrations;
DROP POLICY IF EXISTS "Admins and club admins can manage all registrations" ON event_registrations;

-- Create proper policies for event registrations
CREATE POLICY "Anyone can view registrations"
ON event_registrations FOR SELECT
USING (
  auth.uid() = user_id 
  OR auth.uid() IN (
    SELECT p.id FROM profiles p
    JOIN events e ON e.club_id = p.club_id
    WHERE e.id = event_registrations.event_id
    AND (p.is_admin = true OR p.role = 'club_admin')
  )
);

CREATE POLICY "Users can create registrations"
ON event_registrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own registrations"
ON event_registrations FOR UPDATE
USING (
  auth.uid() = user_id 
  OR auth.uid() IN (
    SELECT p.id FROM profiles p
    JOIN events e ON e.club_id = p.club_id
    WHERE e.id = event_registrations.event_id
    AND (p.is_admin = true OR p.role = 'club_admin')
  )
);

CREATE POLICY "Users can delete their own registrations"
ON event_registrations FOR DELETE
USING (
  auth.uid() = user_id 
  OR auth.uid() IN (
    SELECT p.id FROM profiles p
    JOIN events e ON e.club_id = p.club_id
    WHERE e.id = event_registrations.event_id
    AND (p.is_admin = true OR p.role = 'club_admin')
  )
);