-- Create a view for ticket validation that includes all necessary information
CREATE OR REPLACE VIEW ticket_validation_details AS
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

-- Grant access to authenticated users
GRANT SELECT ON ticket_validation_details TO authenticated;

-- Create function to validate ticket
CREATE OR REPLACE FUNCTION validate_ticket(ticket_number_param TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    ticket_record RECORD;
    result JSONB;
BEGIN
    -- Check if the user is an admin or club admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND (is_admin = true OR role = 'club_admin')
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Unauthorized: Only admins and club admins can validate tickets'
        );
    END IF;

    -- Get ticket details
    SELECT t.*, 
           e.title as event_title,
           e.club_id,
           p.full_name as attendee_name,
           p.email as attendee_email
    INTO ticket_record
    FROM event_tickets t
    JOIN events e ON t.event_id = e.id
    JOIN profiles p ON t.user_id = p.id
    WHERE t.ticket_number = ticket_number_param;

    -- Check if ticket exists
    IF ticket_record IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Ticket not found'
        );
    END IF;

    -- For club admins, check if they have access to this event's club
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND (
            is_admin = true 
            OR (role = 'club_admin' AND club_id = ticket_record.club_id)
        )
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Unauthorized: You can only validate tickets for your club''s events'
        );
    END IF;

    -- Check if ticket is already used
    IF ticket_record.status = 'used' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Ticket has already been used',
            'ticket', jsonb_build_object(
                'ticket_number', ticket_record.ticket_number,
                'event_title', ticket_record.event_title,
                'attendee_name', ticket_record.attendee_name,
                'attendee_email', ticket_record.attendee_email,
                'status', ticket_record.status
            )
        );
    END IF;

    -- Update ticket status
    UPDATE event_tickets
    SET status = 'used'
    WHERE ticket_number = ticket_number_param;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Ticket validated successfully',
        'ticket', jsonb_build_object(
            'ticket_number', ticket_record.ticket_number,
            'event_title', ticket_record.event_title,
            'attendee_name', ticket_record.attendee_name,
            'attendee_email', ticket_record.attendee_email,
            'status', 'used'
        )
    );
END;
$$;
