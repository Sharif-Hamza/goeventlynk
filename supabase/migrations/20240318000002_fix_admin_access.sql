-- Add is_admin column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Update existing admin users
UPDATE profiles 
SET is_admin = true,
    role = 'admin'
WHERE email = 'hsharif701@gmail.com';

UPDATE profiles 
SET role = 'club_admin'
WHERE email = 'ttnt745@gmail.com';

-- Update RLS policies for admin access
DROP POLICY IF EXISTS "Admins can access everything" ON profiles;
CREATE POLICY "Admins can access everything" ON profiles
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE is_admin = true
    )
  );

-- Update the handle_new_user function to handle is_admin
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
    NEW.is_admin := true;
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
  NEW.is_admin := false;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;