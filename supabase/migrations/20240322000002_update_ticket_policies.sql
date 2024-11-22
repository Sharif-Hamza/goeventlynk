-- Drop existing policies to update them
DROP POLICY IF EXISTS "Club admins can create tickets" ON event_tickets;
DROP POLICY IF EXISTS "Users can create their own tickets" ON event_tickets;
DROP POLICY IF EXISTS "Club admins can update tickets" ON event_tickets;
DROP POLICY IF EXISTS "Users can update their own tickets" ON event_tickets;

-- Enable RLS
ALTER TABLE event_tickets ENABLE ROW LEVEL SECURITY;

-- Policy for club admins to manage tickets
CREATE POLICY "Club admins can manage tickets"
    ON event_tickets
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM events e
            JOIN clubs c ON e.club_id = c.id
            WHERE e.id = event_id
            AND EXISTS (
                SELECT 1 FROM profiles p
                WHERE p.id = auth.uid()
                AND (
                    p.is_admin = true
                    OR (p.role = 'club_admin' AND p.club_id = c.id)
                )
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM events e
            JOIN clubs c ON e.club_id = c.id
            WHERE e.id = event_id
            AND EXISTS (
                SELECT 1 FROM profiles p
                WHERE p.id = auth.uid()
                AND (
                    p.is_admin = true
                    OR (p.role = 'club_admin' AND p.club_id = c.id)
                )
            )
        )
    );

-- Policy for users to manage their own tickets
CREATE POLICY "Users can manage their own tickets"
    ON event_tickets
    FOR ALL
    TO authenticated
    USING (
        auth.uid() = user_id
    )
    WITH CHECK (
        auth.uid() = user_id
    );
