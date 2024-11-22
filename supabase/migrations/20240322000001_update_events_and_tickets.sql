-- Add requires_approval column to events
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT true;

-- Drop existing policies to update them
DROP POLICY IF EXISTS "Club admins can create tickets" ON event_tickets;
DROP POLICY IF EXISTS "Users can create their own tickets" ON event_tickets;

-- Add ticket creation policy for admins
CREATE POLICY "Club admins can create tickets"
    ON event_tickets
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM events e
            JOIN clubs c ON e.club_id = c.id
            WHERE e.id = event_id
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

-- Add policy for users to create their own tickets
CREATE POLICY "Users can create their own tickets"
    ON event_tickets
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id
    );
