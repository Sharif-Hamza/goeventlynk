-- Add followers table
CREATE TABLE IF NOT EXISTS club_followers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(club_id, user_id)
);

-- Enable RLS on followers table
ALTER TABLE club_followers ENABLE ROW LEVEL SECURITY;

-- Create policies for followers
CREATE POLICY "Anyone can view followers"
ON club_followers FOR SELECT
USING (true);

CREATE POLICY "Users can follow/unfollow clubs"
ON club_followers FOR ALL
USING (auth.uid() = user_id);

-- Create function to delete club
CREATE OR REPLACE FUNCTION delete_club(
  club_id UUID
) RETURNS void AS $$
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

  -- Delete the club
  DELETE FROM clubs
  WHERE id = delete_club.club_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION delete_club TO authenticated;