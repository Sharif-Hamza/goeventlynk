-- Fix the handle_notification function to use correct fields
CREATE OR REPLACE FUNCTION handle_notification() 
RETURNS TRIGGER AS $$
BEGIN
  -- Notify through Postgres NOTIFY
  PERFORM pg_notify(
    'push_notification',
    json_build_object(
      'title', 
      CASE 
        WHEN TG_TABLE_NAME = 'events' THEN 'New Event: ' || NEW.title
        ELSE 'New Announcement: ' || NEW.title
      END,
      'body',
      CASE 
        WHEN TG_TABLE_NAME = 'events' THEN SUBSTRING(COALESCE(NEW.description, '') FROM 1 FOR 200)
        ELSE SUBSTRING(COALESCE(NEW.content, '') FROM 1 FOR 200)
      END,
      'url',
      CASE 
        WHEN TG_TABLE_NAME = 'events' THEN '/events'
        ELSE '/announcements'
      END
    )::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure announcements table has reaction_counts
ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS reaction_counts JSONB DEFAULT '{}'::jsonb;

-- Create or replace function to update reaction counts
CREATE OR REPLACE FUNCTION update_announcement_reaction_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE announcements
    SET reaction_counts = COALESCE(reaction_counts, '{}'::jsonb) || 
      jsonb_build_object(NEW.reaction_type, (
        SELECT COUNT(*)
        FROM announcement_reactions
        WHERE announcement_id = NEW.announcement_id
        AND reaction_type = NEW.reaction_type
      ))
    WHERE id = NEW.announcement_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE announcements
    SET reaction_counts = COALESCE(reaction_counts, '{}'::jsonb) || 
      jsonb_build_object(OLD.reaction_type, (
        SELECT COUNT(*)
        FROM announcement_reactions
        WHERE announcement_id = OLD.announcement_id
        AND reaction_type = OLD.reaction_type
      ))
    WHERE id = OLD.announcement_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger for reaction counts
DROP TRIGGER IF EXISTS on_reaction_added ON announcement_reactions;
CREATE TRIGGER on_reaction_added
  AFTER INSERT OR DELETE ON announcement_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_announcement_reaction_counts();

-- Update policies for announcements
DROP POLICY IF EXISTS "Anyone can view announcements" ON announcements;
DROP POLICY IF EXISTS "Admins and club admins can manage announcements" ON announcements;

CREATE POLICY "Anyone can view announcements"
ON announcements FOR SELECT
USING (true);

CREATE POLICY "Admins and club admins can manage announcements"
ON announcements FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE is_admin = true 
    OR (role = 'club_admin' AND club_id = announcements.club_id)
  )
);