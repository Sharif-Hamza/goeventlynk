-- Enable storage for images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for images bucket
CREATE POLICY "Anyone can view images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'images' );

CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'images' 
  AND auth.uid() = owner
);

CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'images' 
  AND auth.uid() = owner
);

-- Fix announcement reactions policies
DROP POLICY IF EXISTS "Everyone can view reactions" ON announcement_reactions;
DROP POLICY IF EXISTS "Users can add their own reactions" ON announcement_reactions;
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

-- Update announcements table to properly track reactions
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS reaction_counts JSONB DEFAULT '{}'::jsonb;

-- Function to update reaction counts
CREATE OR REPLACE FUNCTION update_announcement_reaction_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE announcements
    SET reaction_counts = COALESCE(reaction_counts, '{}'::jsonb) || 
      jsonb_build_object(NEW.reaction_type, COALESCE((reaction_counts->>NEW.reaction_type)::int, 0) + 1)
    WHERE id = NEW.announcement_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE announcements
    SET reaction_counts = COALESCE(reaction_counts, '{}'::jsonb) || 
      jsonb_build_object(OLD.reaction_type, GREATEST(COALESCE((reaction_counts->>OLD.reaction_type)::int, 0) - 1, 0))
    WHERE id = OLD.announcement_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for reaction counts
DROP TRIGGER IF EXISTS on_reaction_added ON announcement_reactions;
CREATE TRIGGER on_reaction_added
  AFTER INSERT OR DELETE ON announcement_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_announcement_reaction_counts();

-- Fix announcement policies to ensure proper access
CREATE POLICY "Admins and club admins can manage announcements with images"
ON announcements FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE is_admin = true 
    OR (role = 'club_admin' AND club_id = announcements.club_id)
  )
);

-- Ensure proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_announcement_reactions_announcement_id 
ON announcement_reactions(announcement_id);

CREATE INDEX IF NOT EXISTS idx_announcement_reactions_user_id 
ON announcement_reactions(user_id);

-- Update existing announcements to initialize reaction_counts
UPDATE announcements
SET reaction_counts = '{}'::jsonb
WHERE reaction_counts IS NULL;