-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view clubs" ON clubs;
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

-- Create function to handle club deletion
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION delete_club TO authenticated;