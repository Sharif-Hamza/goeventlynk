-- Add used_at timestamp column to event_tickets table
ALTER TABLE event_tickets 
ADD COLUMN used_at TIMESTAMPTZ DEFAULT NULL;

-- Update existing tickets that are marked as used
UPDATE event_tickets 
SET used_at = NOW() 
WHERE status = 'used';

-- Update the event_tickets_with_details view to include used_at
CREATE OR REPLACE VIEW event_tickets_with_details AS
SELECT 
    t.*,
    e.title as event_title,
    e.date as event_date,
    e.location as event_location,
    e.club_id,
    c.name as club_name,
    p.full_name as attendee_name,
    p.email as attendee_email
FROM event_tickets t
JOIN events e ON t.event_id = e.id
JOIN clubs c ON e.club_id = c.id
JOIN profiles p ON t.user_id = p.id;
