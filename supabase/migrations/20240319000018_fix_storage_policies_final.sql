-- First, drop existing storage policies safely
DO $$ 
BEGIN
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON storage.objects;', E'\n')
        FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects'
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('events', 'events', true),
  ('announcements', 'announcements', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Anyone can view uploaded files"
ON storage.objects FOR SELECT
USING (true);

CREATE POLICY "Admins and club admins can upload files"
ON storage.objects FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    JOIN public.profiles ON profiles.id = auth.users.id
    WHERE auth.users.id = auth.uid()
    AND (profiles.is_admin = true OR profiles.role = 'club_admin')
  )
);

-- Create simplified RLS policies for events
CREATE POLICY "Events are viewable by everyone"
ON events FOR SELECT
USING (true);

CREATE POLICY "Admins and club admins can manage events"
ON events FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role = 'club_admin')
  )
);

-- Create simplified RLS policies for announcements
CREATE POLICY "Announcements are viewable by everyone"
ON announcements FOR SELECT
USING (true);

CREATE POLICY "Admins and club admins can manage announcements"
ON announcements FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role = 'club_admin')
  )
);

-- Create simplified RLS policies for event registrations
CREATE POLICY "Anyone can view registrations"
ON event_registrations FOR SELECT
USING (true);

CREATE POLICY "Users can create registrations"
ON event_registrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and club admins can manage registrations"
ON event_registrations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role = 'club_admin')
  )
);

-- Create simplified RLS policies for reactions
CREATE POLICY "Anyone can view reactions"
ON announcement_reactions FOR SELECT
USING (true);

CREATE POLICY "Users can add reactions"
ON announcement_reactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove reactions"
ON announcement_reactions FOR DELETE
USING (auth.uid() = user_id);