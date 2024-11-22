-- Add banner_url to clubs if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clubs' AND column_name = 'banner_url'
    ) THEN
        ALTER TABLE clubs ADD COLUMN banner_url TEXT;
    END IF;
END $$;

-- Create club posts table
CREATE TABLE IF NOT EXISTS club_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE club_posts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view club posts" ON club_posts;
DROP POLICY IF EXISTS "Club admins can manage their club posts" ON club_posts;

-- Create policies for club posts
CREATE POLICY "Anyone can view club posts"
ON club_posts FOR SELECT
USING (true);

CREATE POLICY "Club admins can manage their club posts"
ON club_posts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (
      is_admin = true
      OR (role = 'club_admin' AND (
        SELECT club_id FROM profiles WHERE id = auth.uid()
      ) = club_posts.club_id)
    )
  )
);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create reactions" ON club_post_reactions;
DROP POLICY IF EXISTS "Users can delete their own reactions" ON club_post_reactions;
DROP POLICY IF EXISTS "Everyone can view reactions" ON club_post_reactions;
DROP POLICY IF EXISTS "Users can manage their own reactions" ON club_post_reactions;
DROP POLICY IF EXISTS "Anyone can view reactions" ON club_post_reactions;

-- Drop existing table and recreate
DROP TABLE IF EXISTS club_post_reactions;

-- Create club post reactions table
CREATE TABLE IF NOT EXISTS club_post_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES club_posts(id) ON DELETE CASCADE NOT NULL,
  reaction_type TEXT NOT NULL
);

-- Create a unique constraint that allows multiple reaction types per user per post
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_post_reaction 
ON club_post_reactions (post_id, user_id, reaction_type);

-- Enable RLS
ALTER TABLE club_post_reactions ENABLE ROW LEVEL SECURITY;

-- Create policies for club post reactions
CREATE POLICY "Users can create reactions"
  ON club_post_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete their own reactions"
  ON club_post_reactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Everyone can view reactions"
  ON club_post_reactions
  FOR SELECT
  TO authenticated
  USING (true);

-- Create event tickets table
CREATE TABLE IF NOT EXISTS event_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    qr_code_data TEXT NOT NULL,
    ticket_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'valid',
    payment_status TEXT DEFAULT 'not_required',
    payment_id TEXT,
    check_in_time TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, event_id)
);

-- Enable RLS
ALTER TABLE event_tickets ENABLE ROW LEVEL SECURITY;

-- Create policies for event tickets
CREATE POLICY "Users can view their own tickets"
    ON event_tickets
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Club admins can view event tickets"
    ON event_tickets
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM events e
            JOIN clubs c ON e.club_id = c.id
            WHERE e.id = event_tickets.event_id
            AND (
                EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid()
                    AND (
                        p.is_admin = true
                        OR (p.role = 'club_admin' AND p.club_id = c.id)
                    )
                )
            )
        )
    );

CREATE POLICY "Club admins can update ticket status"
    ON event_tickets
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM events e
            JOIN clubs c ON e.club_id = c.id
            WHERE e.id = event_tickets.event_id
            AND (
                EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid()
                    AND (
                        p.is_admin = true
                        OR (p.role = 'club_admin' AND p.club_id = c.id)
                    )
                )
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM events e
            JOIN clubs c ON e.club_id = c.id
            WHERE e.id = event_tickets.event_id
            AND (
                EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid()
                    AND (
                        p.is_admin = true
                        OR (p.role = 'club_admin' AND p.club_id = c.id)
                    )
                )
            )
        )
    );

-- Create storage buckets if they don't exist
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('club-posts', 'club-posts', true)
    ON CONFLICT (id) DO NOTHING;
    
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('club-banners', 'club-banners', true)
    ON CONFLICT (id) DO NOTHING;
END $$;

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Anyone can view club post images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload club post images" ON storage.objects;
DROP POLICY IF EXISTS "Club admins can delete their post images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view club banners" ON storage.objects;
DROP POLICY IF EXISTS "Club admins can manage their club banner" ON storage.objects;

-- Set up storage policies
CREATE POLICY "Anyone can view club post images"
ON storage.objects FOR SELECT
USING (bucket_id = 'club-posts');

CREATE POLICY "Authenticated users can upload club post images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'club-posts'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Club admins can delete their post images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'club-posts'
  AND auth.role() = 'authenticated'
  AND (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (
        is_admin = true
        OR role = 'club_admin'
      )
    )
  )
);

-- Banner policies
CREATE POLICY "Anyone can view club banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'club-banners');

CREATE POLICY "Club admins can manage their club banner"
ON storage.objects FOR ALL
USING (
  bucket_id = 'club-banners'
  AND auth.role() = 'authenticated'
  AND (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (
        is_admin = true
        OR role = 'club_admin'
      )
    )
  )
);

-- Create view for club statistics
CREATE OR REPLACE VIEW club_statistics AS
SELECT 
  c.id as club_id,
  c.name as club_name,
  COUNT(DISTINCT cf.user_id) as follower_count,
  COUNT(DISTINCT a.id) as announcement_count,
  COUNT(DISTINCT e.id) as event_count,
  COUNT(DISTINCT cp.id) as post_count
FROM clubs c
LEFT JOIN club_followers cf ON c.id = cf.club_id
LEFT JOIN announcements a ON c.id = a.club_id
LEFT JOIN events e ON c.id = e.club_id
LEFT JOIN club_posts cp ON c.id = cp.club_id
GROUP BY c.id, c.name;

-- Create function to check if user is club admin
CREATE OR REPLACE FUNCTION is_club_admin(club_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (
      is_admin = true
      OR (role = 'club_admin' AND profiles.club_id = is_club_admin.club_id)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
