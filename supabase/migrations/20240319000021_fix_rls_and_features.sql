-- First, drop ALL existing policies
DO $$ 
BEGIN
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON ' || quote_ident(tablename) || ';', E'\n')
        FROM pg_policies 
        WHERE tablename IN ('events', 'announcements', 'event_registrations', 'announcement_reactions', 'profiles')
    );
END $$;

-- Create SIMPLE policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
ON profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Create SIMPLE policies for events
CREATE POLICY "Events are viewable by everyone"
ON events FOR SELECT
USING (true);

CREATE POLICY "Admins can manage all events"
ON events FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);

CREATE POLICY "Club admins can manage their events"
ON events FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'club_admin'
    AND club_id = events.club_id
  )
);

-- Create SIMPLE policies for announcements
CREATE POLICY "Announcements are viewable by everyone"
ON announcements FOR SELECT
USING (true);

CREATE POLICY "Admins can manage all announcements"
ON announcements FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);

CREATE POLICY "Club admins can manage their announcements"
ON announcements FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'club_admin'
    AND club_id = announcements.club_id
  )
);

-- Create SIMPLE policies for event registrations
CREATE POLICY "Anyone can view registrations"
ON event_registrations FOR SELECT
USING (true);

CREATE POLICY "Users can create registrations"
ON event_registrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all registrations"
ON event_registrations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);

CREATE POLICY "Club admins can manage their registrations"
ON event_registrations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN events e ON e.club_id = p.club_id
    WHERE p.id = auth.uid()
    AND e.id = event_registrations.event_id
    AND p.role = 'club_admin'
  )
);

-- Create SIMPLE policies for reactions
CREATE POLICY "Anyone can view reactions"
ON announcement_reactions FOR SELECT
USING (true);

CREATE POLICY "Users can add reactions"
ON announcement_reactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove reactions"
ON announcement_reactions FOR DELETE
USING (auth.uid() = user_id);

-- Update storage policies
CREATE POLICY "Anyone can view uploaded files"
ON storage.objects FOR SELECT
USING (true);

CREATE POLICY "Admins and club admins can upload files"
ON storage.objects FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role = 'club_admin')
  )
);

-- Add payment fields to event_registrations if they don't exist
ALTER TABLE event_registrations
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Add current_occupancy to events if it doesn't exist
ALTER TABLE events
ADD COLUMN IF NOT EXISTS current_occupancy INTEGER DEFAULT 0;

-- Create function to update event occupancy
CREATE OR REPLACE FUNCTION update_event_occupancy()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
    UPDATE events 
    SET current_occupancy = current_occupancy + 1
    WHERE id = NEW.event_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
      UPDATE events 
      SET current_occupancy = current_occupancy + 1
      WHERE id = NEW.event_id;
    ELSIF NEW.status != 'approved' AND OLD.status = 'approved' THEN
      UPDATE events 
      SET current_occupancy = GREATEST(current_occupancy - 1, 0)
      WHERE id = NEW.event_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
    UPDATE events 
    SET current_occupancy = GREATEST(current_occupancy - 1, 0)
    WHERE id = OLD.event_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for occupancy updates
DROP TRIGGER IF EXISTS update_occupancy ON event_registrations;
CREATE TRIGGER update_occupancy
  AFTER INSERT OR UPDATE OR DELETE ON event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_event_occupancy();