-- First drop the existing policy
DROP POLICY IF EXISTS "Admins and club admins can manage announcements" ON announcements;

-- Recreate the policy with the correct permissions
CREATE POLICY "Admins and club admins can manage announcements" ON announcements
FOR ALL USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE is_admin = true 
    OR (role = 'club_admin' AND club_id = announcements.club_id)
  )
);

-- Ensure storage policies are correctly set
DROP POLICY IF EXISTS "Admins and club admins can upload announcement images" ON storage.objects;
CREATE POLICY "Admins and club admins can upload announcement images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'announcements' 
  AND auth.role() = 'authenticated'
  AND auth.uid() IN (
    SELECT id FROM profiles
    WHERE is_admin = true OR role = 'club_admin'
  )
);

-- Ensure proper access to announcement reactions
DROP POLICY IF EXISTS "Anyone can view reactions" ON announcement_reactions;
CREATE POLICY "Anyone can view reactions"
ON announcement_reactions FOR SELECT
USING (true);

-- Refresh the trigger for reaction counts
DROP TRIGGER IF EXISTS on_reaction_added ON announcement_reactions;
CREATE TRIGGER on_reaction_added
  AFTER INSERT OR DELETE ON announcement_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_announcement_reaction_counts();