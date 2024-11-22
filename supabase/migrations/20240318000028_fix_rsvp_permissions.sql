-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view registrations" ON event_registrations;
DROP POLICY IF EXISTS "Users can create registrations" ON event_registrations;
DROP POLICY IF EXISTS "Users can update their own registrations" ON event_registrations;
DROP POLICY IF EXISTS "Users can delete their own registrations" ON event_registrations;

-- Create proper policies for event registrations
CREATE POLICY "Anyone can view registrations"
ON event_registrations FOR SELECT
USING (
  -- Users can view their own registrations
  auth.uid() = user_id 
  OR 
  -- Admins can view all registrations
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
  OR
  -- Club admins can view registrations for their club's events
  auth.uid() IN (
    SELECT p.id FROM profiles p
    JOIN events e ON e.club_id = p.club_id
    WHERE e.id = event_registrations.event_id
    AND p.role = 'club_admin'
  )
);

-- Allow any authenticated user to create registrations
CREATE POLICY "Authenticated users can create registrations"
ON event_registrations FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = user_id
);

-- Allow admins and relevant club admins to update registrations
CREATE POLICY "Admins and club admins can update registrations"
ON event_registrations FOR UPDATE
USING (
  -- Admins can update any registration
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
  OR
  -- Club admins can only update registrations for their club's events
  auth.uid() IN (
    SELECT p.id FROM profiles p
    JOIN events e ON e.club_id = p.club_id
    WHERE e.id = event_registrations.event_id
    AND p.role = 'club_admin'
  )
);

-- Allow users to delete their own registrations, and admins/club admins to delete registrations
CREATE POLICY "Users can delete registrations"
ON event_registrations FOR DELETE
USING (
  -- Users can delete their own registrations
  auth.uid() = user_id
  OR
  -- Admins can delete any registration
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
  OR
  -- Club admins can only delete registrations for their club's events
  auth.uid() IN (
    SELECT p.id FROM profiles p
    JOIN events e ON e.club_id = p.club_id
    WHERE e.id = event_registrations.event_id
    AND p.role = 'club_admin'
  )
);