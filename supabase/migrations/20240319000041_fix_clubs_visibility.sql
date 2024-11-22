-- Drop existing policies for clubs
DROP POLICY IF EXISTS "Admins can manage clubs" ON clubs;

-- Create proper policies for clubs
CREATE POLICY "Anyone can view clubs"
ON clubs FOR SELECT
USING (true);

CREATE POLICY "Admins can manage clubs"
ON clubs FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);

-- Update club_followers view to include counts
CREATE OR REPLACE VIEW club_followers_count AS
SELECT 
  club_id,
  COUNT(*) as follower_count
FROM club_followers
GROUP BY club_id;