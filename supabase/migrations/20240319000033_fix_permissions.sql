-- First, ensure we have proper permissions
GRANT USAGE ON SCHEMA public TO postgres, authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, authenticated;

-- Drop existing policies safely
DO $$ 
BEGIN
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON ' || quote_ident(tablename) || ';', E'\n')
        FROM pg_policies 
        WHERE tablename IN ('events', 'announcements', 'event_registrations', 'announcement_reactions', 'profiles')
    );
END $$;

-- Create views with proper permissions
CREATE OR REPLACE VIEW events_with_clubs AS
SELECT e.*, c.name as club_name
FROM events e
LEFT JOIN clubs c ON e.club_id = c.id;

CREATE OR REPLACE VIEW announcements_with_clubs AS
SELECT a.*, c.name as club_name
FROM announcements a
LEFT JOIN clubs c ON a.club_id = c.id;

GRANT SELECT ON events_with_clubs TO authenticated, anon;
GRANT SELECT ON announcements_with_clubs TO authenticated, anon;

-- Create simplified RLS policies
CREATE POLICY "events_select"
ON events FOR SELECT
USING (true);

CREATE POLICY "events_all"
ON events FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (
      is_admin = true 
      OR (role = 'club_admin' AND club_id = events.club_id)
    )
  )
);

CREATE POLICY "announcements_select"
ON announcements FOR SELECT
USING (true);

CREATE POLICY "announcements_all"
ON announcements FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (
      is_admin = true 
      OR (role = 'club_admin' AND club_id = announcements.club_id)
    )
  )
);

-- Create simple policies for event registrations
CREATE POLICY "registrations_select"
ON event_registrations FOR SELECT
USING (true);

CREATE POLICY "registrations_insert"
ON event_registrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "registrations_admin"
ON event_registrations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role = 'club_admin')
  )
);

-- Create simple policies for reactions
CREATE POLICY "reactions_select"
ON announcement_reactions FOR SELECT
USING (true);

CREATE POLICY "reactions_insert"
ON announcement_reactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reactions_delete"
ON announcement_reactions FOR DELETE
USING (auth.uid() = user_id);

-- Update storage policies
CREATE POLICY "storage_access"
ON storage.objects FOR ALL
USING (true);