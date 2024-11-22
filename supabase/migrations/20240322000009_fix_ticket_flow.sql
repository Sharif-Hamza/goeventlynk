-- Drop existing views to avoid conflicts
DROP VIEW IF EXISTS event_tickets_with_details CASCADE;
DROP VIEW IF EXISTS ticket_validation_details CASCADE;

-- Create the event_tickets_with_details view
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

-- Create ticket validation view
CREATE VIEW ticket_validation_details AS
SELECT 
    t.id,
    t.ticket_number,
    t.status,
    t.qr_code_data,
    t.created_at,
    e.title as event_title,
    e.date as event_date,
    e.location as event_location,
    p.full_name as attendee_name,
    p.email as attendee_email,
    c.name as club_name
FROM event_tickets t
JOIN events e ON t.event_id = e.id
JOIN clubs c ON e.club_id = c.id
JOIN profiles p ON t.user_id = p.id;

-- Grant access to authenticated users
GRANT SELECT ON event_tickets_with_details TO authenticated;
GRANT SELECT ON ticket_validation_details TO authenticated;
