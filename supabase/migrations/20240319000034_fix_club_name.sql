-- Drop existing views if they exist
DROP VIEW IF EXISTS events_with_clubs;
DROP VIEW IF EXISTS announcements_with_clubs;

-- Create views with proper permissions
CREATE OR REPLACE VIEW events_with_clubs AS
SELECT 
  e.id,
  e.title,
  e.description,
  e.date,
  e.location,
  e.price,
  e.capacity,
  e.image_url,
  e.admin_id,
  e.club_id,
  e.created_at,
  e.current_occupancy,
  c.name as club_name
FROM events e
LEFT JOIN clubs c ON e.club_id = c.id;

CREATE OR REPLACE VIEW announcements_with_clubs AS
SELECT 
  a.id,
  a.title,
  a.content,
  a.image_url,
  a.admin_id,
  a.club_id,
  a.created_at,
  a.reaction_counts,
  c.name as club_name
FROM announcements a
LEFT JOIN clubs c ON a.club_id = c.id;

-- Grant permissions
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