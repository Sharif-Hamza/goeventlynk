-- Drop existing function
DROP FUNCTION IF EXISTS delete_club(UUID);

-- Create improved delete_club function with explicit column references
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

  -- Delete the club
  DELETE FROM clubs
  WHERE id = target_club_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION delete_club TO authenticated;

-- Create or replace the handle_email_confirmation function
CREATE OR REPLACE FUNCTION handle_email_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  -- When email is confirmed, ensure profile exists
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    INSERT INTO public.profiles (
      id,
      email,
      username,
      role,
      is_admin,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      split_part(NEW.email, '@', 1),
      CASE 
        WHEN NEW.email = 'hsharif701@gmail.com' THEN 'admin'
        WHEN EXISTS (SELECT 1 FROM clubs WHERE admin_email = NEW.email) THEN 'club_admin'
        ELSE 'user'
      END,
      NEW.email = 'hsharif701@gmail.com',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      email = NEW.email,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for email confirmations
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL)
  EXECUTE FUNCTION handle_email_confirmation();