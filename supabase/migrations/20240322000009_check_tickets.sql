-- Check event_tickets table
SELECT * FROM event_tickets ORDER BY created_at DESC LIMIT 5;

-- Check the event_tickets_with_details view
SELECT * FROM event_tickets_with_details ORDER BY created_at DESC LIMIT 5;

-- Check specific ticket
SELECT * FROM event_tickets WHERE ticket_number = 'TKT-1732298407169-8431';

-- Check if the joins are working
SELECT 
    t.*,
    e.title,
    c.name as club_name,
    p.full_name
FROM event_tickets t
LEFT JOIN events e ON t.event_id = e.id
LEFT JOIN clubs c ON e.club_id = c.id
LEFT JOIN profiles p ON t.user_id = p.id
WHERE t.ticket_number = 'TKT-1732298407169-8431';
