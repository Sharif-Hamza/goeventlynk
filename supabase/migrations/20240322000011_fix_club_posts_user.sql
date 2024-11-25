-- Add user_id column to club_posts
ALTER TABLE club_posts 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing rows to set user_id from admin_id
UPDATE club_posts
SET user_id = (
  SELECT auth.uid() 
  FROM profiles 
  WHERE profiles.id = club_posts.admin_id
);

-- Maintain existing admin_id column and policies
-- This preserves the current admin functionality
