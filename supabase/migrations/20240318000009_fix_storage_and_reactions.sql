-- First, create the storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('announcements', 'announcements', true),
  ('events', 'events', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for announcements bucket
CREATE POLICY "Anyone can view announcement images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'announcements' );

CREATE POLICY "Admins and club admins can upload announcement images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'announcements' 
  AND auth.role() = 'authenticated'
  AND auth.uid() IN (
    SELECT id FROM auth.users
    WHERE id IN (
      SELECT id FROM profiles
      WHERE is_admin = true OR role = 'club_admin'
    )
  )
);

-- Create storage policies for events bucket
CREATE POLICY "Anyone can view event images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'events' );

CREATE POLICY "Admins and club admins can upload event images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'events' 
  AND auth.role() = 'authenticated'
  AND auth.uid() IN (
    SELECT id FROM auth.users
    WHERE id IN (
      SELECT id FROM profiles
      WHERE is_admin = true OR role = 'club_admin'
    )
  )
);

-- Add reaction_counts column to announcements if it doesn't exist
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

-- Create or replace trigger for reaction counts
DROP TRIGGER IF EXISTS on_reaction_added ON announcement_reactions;
CREATE TRIGGER on_reaction_added
  AFTER INSERT OR DELETE ON announcement_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_announcement_reaction_counts();

-- Update policies for announcement reactions
DROP POLICY IF EXISTS "Anyone can view reactions" ON announcement_reactions;
DROP POLICY IF EXISTS "Authenticated users can add reactions" ON announcement_reactions;
DROP POLICY IF EXISTS "Users can remove their own reactions" ON announcement_reactions;

CREATE POLICY "Anyone can view reactions"
ON announcement_reactions FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can add reactions"
ON announcement_reactions FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = user_id
);

CREATE POLICY "Users can remove their own reactions"
ON announcement_reactions FOR DELETE
USING (auth.uid() = user_id);

-- Update announcement policies to ensure proper access
CREATE POLICY "Admins and club admins can manage announcements"
ON announcements FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE is_admin = true 
    OR (role = 'club_admin' AND club_id = announcements.club_id)
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_announcement_reactions_announcement_id 
ON announcement_reactions(announcement_id);

CREATE INDEX IF NOT EXISTS idx_announcement_reactions_user_id 
ON announcement_reactions(user_id);

-- Initialize reaction_counts for existing announcements
UPDATE announcements a
SET reaction_counts = (
  SELECT jsonb_object_agg(reaction_type, count)
  FROM (
    SELECT reaction_type, COUNT(*) as count
    FROM announcement_reactions
    WHERE announcement_id = a.id
    GROUP BY reaction_type
  ) reactions
)
WHERE reaction_counts IS NULL OR reaction_counts = '{}'::jsonb;