-- Drop existing views
DROP VIEW IF EXISTS events_with_clubs;
DROP VIEW IF EXISTS announcements_with_clubs;

-- Create views with proper permissions
CREATE VIEW events_with_clubs AS
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

CREATE VIEW announcements_with_clubs AS
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