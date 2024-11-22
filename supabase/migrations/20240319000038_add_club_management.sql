-- Add banner_url to clubs table
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Create club management policies for admins
CREATE POLICY "Admins can manage clubs"
ON clubs FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);

-- Create function to handle club admin assignment
CREATE OR REPLACE FUNCTION assign_club_admin(
  user_email TEXT,
  club_id UUID
) RETURNS void AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get user ID from email
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email;

  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Update user's profile
  UPDATE profiles
  SET 
    role = 'club_admin',
    club_id = assign_club_admin.club_id,
    username = (SELECT name FROM clubs WHERE id = assign_club_admin.club_id)
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to remove club admin
CREATE OR REPLACE FUNCTION remove_club_admin(
  user_email TEXT
) RETURNS void AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get user ID from email
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email;

  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Update user's profile
  UPDATE profiles
  SET 
    role = 'user',
    club_id = NULL,
    username = split_part(user_email, '@', 1)
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION assign_club_admin TO authenticated;
GRANT EXECUTE ON FUNCTION remove_club_admin TO authenticated;