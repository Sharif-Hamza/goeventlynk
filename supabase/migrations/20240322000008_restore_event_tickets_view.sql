-- Drop the existing view first
DROP VIEW IF EXISTS event_tickets_with_details CASCADE;

-- Recreate the event_tickets_with_details view
CREATE VIEW event_tickets_with_details AS
SELECT 
    t.id,
    t.user_id,
    t.event_id,
    t.ticket_number,
    t.status,
    t.payment_status,
    t.payment_id,
    t.qr_code_data,
    t.created_at,
    e.title as event_title,
    e.date as event_date,
    e.location as event_location,
    e.description,
    e.club_id,
    c.name as club_name,
    p.full_name,
    p.email
FROM event_tickets t
JOIN events e ON t.event_id = e.id
JOIN clubs c ON e.club_id = c.id
JOIN profiles p ON t.user_id = p.id;

-- Grant access to authenticated users
GRANT SELECT ON event_tickets_with_details TO authenticated;
