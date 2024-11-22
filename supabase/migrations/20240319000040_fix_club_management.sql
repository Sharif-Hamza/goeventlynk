-- Drop existing function
DROP FUNCTION IF EXISTS delete_club(UUID);

-- Create improved delete_club function
CREATE OR REPLACE FUNCTION delete_club(club_id UUID)
RETURNS void AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Only administrators can delete clubs';
  END IF;

  -- Reset club admins to regular users
  UPDATE profiles
  SET 
    role = 'user',
    club_id = NULL,
    username = split_part(email, '@', 1)
  WHERE club_id = delete_club.club_id;

  -- Delete club followers
  DELETE FROM club_followers
  WHERE club_id = delete_club.club_id;

  -- Delete the club
  DELETE FROM clubs
  WHERE id = delete_club.club_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view followers" ON club_followers;
DROP POLICY IF EXISTS "Users can follow/unfollow clubs" ON club_followers;

-- Create improved policies for club_followers
CREATE POLICY "Anyone can view followers"
ON club_followers FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can follow clubs"
ON club_followers FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = user_id
);

CREATE POLICY "Users can unfollow clubs"
ON club_followers FOR DELETE
USING (auth.uid() = user_id);

-- Create policy for clubs
CREATE POLICY "Admins can delete clubs"
ON clubs FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);