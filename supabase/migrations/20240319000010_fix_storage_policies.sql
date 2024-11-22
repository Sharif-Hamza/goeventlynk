-- First, drop ALL existing storage policies
DO $$ 
BEGIN
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON storage.objects;', E'\n')
        FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects'
    );
END $$;

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('events', 'events', true),
  ('announcements', 'announcements', true)
ON CONFLICT (id) DO NOTHING;

-- Create single, simplified storage policies
CREATE POLICY "Anyone can view uploaded files"
ON storage.objects FOR SELECT
USING (true);

CREATE POLICY "Admins and club admins can manage files"
ON storage.objects FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    JOIN public.profiles ON profiles.id = auth.users.id
    WHERE auth.users.id = auth.uid()
    AND (profiles.is_admin = true OR profiles.role = 'club_admin')
  )
);