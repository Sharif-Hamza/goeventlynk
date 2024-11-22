-- Add policies for profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Update existing admin users
UPDATE profiles 
SET role = 'admin'
WHERE email = 'hsharif701@gmail.com';

UPDATE profiles 
SET role = 'club_admin'
WHERE email = 'ttnt745@gmail.com';

-- Modify the handle_new_user function to properly set admin roles
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  matching_club clubs%ROWTYPE;
BEGIN
  -- Set email from auth.users
  NEW.email := (SELECT email FROM auth.users WHERE id = NEW.id);
  
  -- Check if user should be main admin
  IF NEW.email = 'hsharif701@gmail.com' THEN
    NEW.role := 'admin';
    RETURN NEW;
  END IF;
  
  -- Check if user should be club admin
  SELECT * INTO matching_club FROM clubs 
  WHERE admin_email = NEW.email;
  
  IF matching_club.id IS NOT NULL THEN
    NEW.role := 'club_admin';
    NEW.club_id := matching_club.id;
    RETURN NEW;
  END IF;
  
  -- Default to regular user
  NEW.role := 'user';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON profiles;
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();