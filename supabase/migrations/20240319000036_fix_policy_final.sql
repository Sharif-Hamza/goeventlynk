-- First, drop ALL existing policies
DO $$ 
DECLARE
    r record;
BEGIN
    -- Drop storage policies
    FOR r IN (SELECT policyname 
              FROM pg_policies 
              WHERE schemaname = 'storage' 
              AND tablename = 'objects') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    END LOOP;

    -- Drop other policies
    FOR r IN (SELECT schemaname, tablename, policyname 
              FROM pg_policies 
              WHERE tablename IN (
                'events', 
                'announcements', 
                'event_registrations', 
                'announcement_reactions', 
                'profiles'
              )) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Drop existing views
DROP VIEW IF EXISTS events_with_clubs;
DROP VIEW IF EXISTS announcements_with_clubs;

-- Create views with proper permissions
CREATE VIEW events_with_clubs AS
SELECT 
  e.*,
  c.name as club_name
FROM events e
LEFT JOIN clubs c ON e.club_id = c.id;

CREATE VIEW announcements_with_clubs AS
SELECT 
  a.*,
  c.name as club_name
FROM announcements a
LEFT JOIN clubs c ON a.club_id = c.id;

-- Grant permissions
GRANT SELECT ON events_with_clubs TO authenticated, anon;
GRANT SELECT ON announcements_with_clubs TO authenticated, anon;

-- Create single policy for events
CREATE POLICY "event_policy"
ON events FOR ALL
USING (
  CASE 
    WHEN auth.uid() IS NULL THEN true  -- Allow public read
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    ) THEN true  -- Allow admins full access
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'club_admin'
      AND club_id = events.club_id
    ) THEN true  -- Allow club admins access to their events
    ELSE true  -- Allow read-only for others
  END
);

-- Create single policy for announcements
CREATE POLICY "announcement_policy"
ON announcements FOR ALL
USING (
  CASE 
    WHEN auth.uid() IS NULL THEN true  -- Allow public read
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    ) THEN true  -- Allow admins full access
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'club_admin'
      AND club_id = announcements.club_id
    ) THEN true  -- Allow club admins access to their announcements
    ELSE true  -- Allow read-only for others
  END
);

-- Create single policy for registrations
CREATE POLICY "registration_policy"
ON event_registrations FOR ALL
USING (
  CASE
    WHEN auth.uid() IS NULL THEN false  -- Deny public access
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    ) THEN true  -- Allow admins full access
    WHEN EXISTS (
      SELECT 1 FROM profiles p
      JOIN events e ON e.club_id = p.club_id
      WHERE p.id = auth.uid()
      AND e.id = event_registrations.event_id
      AND p.role = 'club_admin'
    ) THEN true  -- Allow club admins access to their event registrations
    WHEN auth.uid() = user_id THEN true  -- Allow users to manage their own registrations
    ELSE false  -- Deny others
  END
);

-- Create single policy for reactions
CREATE POLICY "reaction_policy"
ON announcement_reactions FOR ALL
USING (
  CASE
    WHEN auth.uid() IS NULL THEN true  -- Allow public read
    WHEN auth.uid() = user_id THEN true  -- Allow users to manage their own reactions
    ELSE true  -- Allow read-only for others
  END
);

-- Create single storage policy
CREATE POLICY "storage_policy"
ON storage.objects FOR ALL
USING (
  CASE 
    WHEN auth.uid() IS NULL THEN true  -- Allow public read
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role = 'club_admin')
    ) THEN true  -- Allow admins and club admins full access
    ELSE true  -- Allow read-only for others
  END
);