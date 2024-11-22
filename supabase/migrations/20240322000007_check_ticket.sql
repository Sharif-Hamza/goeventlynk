-- Query to check ticket status
SELECT 
    t.ticket_number,
    t.status,
    t.payment_status,
    e.title as event_title,
    p.full_name as attendee_name
FROM event_tickets t
JOIN events e ON t.event_id = e.id
JOIN profiles p ON t.user_id = p.id
WHERE t.ticket_number = 'TKT-1732298407169-8431';
