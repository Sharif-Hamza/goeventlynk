-- Update handle_new_user function to handle email/password users
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  matching_club clubs%ROWTYPE;
  user_email TEXT;
BEGIN
  -- Get email from auth.users
  SELECT email INTO user_email 
  FROM auth.users 
  WHERE id = NEW.id;

  -- Set basic user data
  NEW.email := user_email;
  NEW.created_at := NOW();
  NEW.updated_at := NOW();
  
  -- Check if user should be main admin
  IF user_email = 'hsharif701@gmail.com' THEN
    NEW.role := 'admin';
    NEW.is_admin := true;
    NEW.username := 'Admin';
    RETURN NEW;
  END IF;
  
  -- Check if user should be club admin
  SELECT * INTO matching_club FROM clubs 
  WHERE admin_email = user_email;
  
  IF matching_club.id IS NOT NULL THEN
    NEW.role := 'club_admin';
    NEW.club_id := matching_club.id;
    NEW.username := matching_club.name;
    NEW.is_admin := false;
    RETURN NEW;
  END IF;
  
  -- Default to regular user
  NEW.role := 'user';
  NEW.is_admin := false;
  NEW.username := split_part(user_email, '@', 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for email confirmations
CREATE OR REPLACE FUNCTION handle_email_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  -- When email is confirmed, ensure profile exists
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    INSERT INTO public.profiles (id, email, role, is_admin)
    VALUES (
      NEW.id,
      NEW.email,
      CASE 
        WHEN NEW.email = 'hsharif701@gmail.com' THEN 'admin'
        WHEN EXISTS (SELECT 1 FROM clubs WHERE admin_email = NEW.email) THEN 'club_admin'
        ELSE 'user'
      END,
      NEW.email = 'hsharif701@gmail.com'
    )
    ON CONFLICT (id) DO UPDATE
    SET email = NEW.email,
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