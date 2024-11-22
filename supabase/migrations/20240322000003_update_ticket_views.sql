-- Drop existing views if they exist
DROP VIEW IF EXISTS events_with_clubs CASCADE;
DROP VIEW IF EXISTS event_tickets_with_details CASCADE;

-- Create a view for events with club details
CREATE OR REPLACE VIEW events_with_clubs AS
SELECT 
    e.id,
    e.title,
    e.description,
    e.date,
    e.location,
    e.price,
    e.capacity,
    e.image_url,
    e.admin_id,
    e.club_id,
    e.created_at,
    c.name as club_name
FROM events e
LEFT JOIN clubs c ON e.club_id = c.id;

-- Create a view for tickets with all related details
CREATE OR REPLACE VIEW event_tickets_with_details AS
SELECT 
    t.*,
    e.title,
    e.date,
    e.location,
    e.description,
    e.image_url as event_image_url,
    e.club_id,
    c.name as club_name,
    p.full_name,
    p.email
FROM event_tickets t
LEFT JOIN events e ON t.event_id = e.id
LEFT JOIN clubs c ON e.club_id = c.id
LEFT JOIN profiles p ON t.user_id = p.id;

-- Update the events table to ensure consistent column names
ALTER TABLE events 
    DROP COLUMN IF EXISTS name,
    DROP COLUMN IF EXISTS start_time;

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ;
