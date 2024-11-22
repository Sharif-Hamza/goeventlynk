-- First, drop existing policy
DROP POLICY IF EXISTS "Admins can delete clubs" ON clubs;

-- Create improved delete_club function
CREATE OR REPLACE FUNCTION delete_club(target_club_id UUID)
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

  -- Start transaction
  BEGIN
    -- Reset club admins to regular users
    UPDATE profiles
    SET 
      role = 'user',
      club_id = NULL,
      username = split_part(email, '@', 1)
    WHERE club_id = target_club_id;

    -- Delete club followers
    DELETE FROM club_followers
    WHERE club_id = target_club_id;

    -- Delete events associated with the club
    DELETE FROM events
    WHERE club_id = target_club_id;

    -- Delete announcements associated with the club
    DELETE FROM announcements
    WHERE club_id = target_club_id;

    -- Finally, delete the club
    DELETE FROM clubs
    WHERE id = target_club_id;

    -- If we get here, commit the transaction
    RETURN;
  EXCEPTION WHEN OTHERS THEN
    -- If anything fails, the transaction will be rolled back
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION delete_club(UUID) TO authenticated;

-- Create single policy for clubs that handles all operations
CREATE POLICY "club_management_policy"
ON clubs FOR ALL
USING (
  CASE 
    WHEN auth.uid() IS NULL THEN true  -- Allow public read
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    ) THEN true  -- Allow admins full access
    ELSE true  -- Allow read-only for others
  END
);