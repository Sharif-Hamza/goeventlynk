-- Drop existing club name columns and triggers
DROP TRIGGER IF EXISTS update_event_club_name ON events;
DROP TRIGGER IF EXISTS update_announcement_club_name ON announcements;
DROP FUNCTION IF EXISTS update_club_name();
ALTER TABLE events DROP COLUMN IF EXISTS club_name;
ALTER TABLE announcements DROP COLUMN IF EXISTS club_name;

-- Create views to include club names
CREATE OR REPLACE VIEW events_with_clubs AS
SELECT e.*, c.name as club_name
FROM events e
LEFT JOIN clubs c ON e.club_id = c.id;

CREATE OR REPLACE VIEW announcements_with_clubs AS
SELECT a.*, c.name as club_name
FROM announcements a
LEFT JOIN clubs c ON a.club_id = c.id;

-- Update RLS policies for views
ALTER VIEW events_with_clubs OWNER TO authenticated;
ALTER VIEW announcements_with_clubs OWNER TO authenticated;

GRANT SELECT ON events_with_clubs TO authenticated;
GRANT SELECT ON announcements_with_clubs TO authenticated;

-- Create policies for the base tables
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