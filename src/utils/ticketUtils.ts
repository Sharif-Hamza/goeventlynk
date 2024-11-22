import CryptoJS from 'crypto-js';
import { supabase } from '../lib/supabase';

const ENCRYPTION_KEY = import.meta.env.VITE_TICKET_ENCRYPTION_KEY || 'eventlynk-dev-key';

// Function to get user's tickets with all details
export const getUserTickets = async (userId: string) => {
  try {
    const { data: tickets, error } = await supabase
      .from('event_tickets_with_details')
      .select(`
        *,
        events (
          id,
          name,
          date,
          location,
          description,
          image_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tickets:', error);
      throw error;
    }

    return tickets || [];
  } catch (error) {
    console.error('Error in getUserTickets:', error);
    throw error;
  }
};

export const createEventTicket = async (
  userId: string,
  eventId: string,
  paymentStatus: 'not_required' | 'pending' | 'paid' = 'not_required',
  paymentId?: string
) => {
  try {
    // Generate ticket data
    const ticketNumber = generateTicketNumber();
    const ticketData = {
      ticketId: crypto.randomUUID(),
      eventId,
      userId,
      ticketNumber,
      timestamp: Date.now(),
    };
    const qrCodeData = generateQRCodeData(ticketData);

    // Try to get existing ticket
    const { data: existingTickets, error: existingError } = await supabase
      .from('event_tickets')
      .select('id')
      .eq('user_id', userId)
      .eq('event_id', eventId);

    if (existingError) {
      console.error('Error checking existing tickets:', existingError);
      throw existingError;
    }

    // Prepare ticket data
    const ticketToUpsert = {
      user_id: userId,
      event_id: eventId,
      qr_code_data: qrCodeData,
      ticket_number: ticketNumber,
      payment_status: paymentStatus,
      payment_id: paymentId,
      status: 'valid'
    };

    // If ticket exists, include its ID
    if (existingTickets?.[0]) {
      ticketToUpsert['id'] = existingTickets[0].id;
    }

    // Create or update ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('event_tickets')
      .upsert(ticketToUpsert)
      .select()
      .single();

    if (ticketError || !ticket) {
      console.error('Error managing ticket:', ticketError);
      throw ticketError || new Error('Failed to manage ticket');
    }

    // Add a small delay to ensure the ticket is properly created in the database
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get ticket with details
    const { data: ticketWithDetails, error: detailsError } = await supabase
      .from('event_tickets_with_details')
      .select(`
        *,
        events (
          id,
          name,
          date,
          location,
          description,
          image_url
        )
      `)
      .eq('id', ticket.id)
      .single();

    if (detailsError) {
      console.error('Error fetching ticket details:', detailsError);
      // Return the basic ticket if we can't get the details
      return ticket;
    }

    return ticketWithDetails || ticket;
  } catch (error) {
    console.error('Error in createEventTicket:', error);
    throw error;
  }
};

export const generateTicketNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TKT-${timestamp}-${random}`;
};

export const encryptTicketData = (data: any): string => {
  const jsonString = JSON.stringify(data);
  return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
};

export const decryptTicketData = (encryptedData: string): any => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Error decrypting ticket data:', error);
    return null;
  }
};

export const validateTicketData = (encryptedData: string): any => {
  try {
    const decrypted = decryptTicketData(encryptedData);
    if (!decrypted) return null;

    const requiredFields = ['ticketId', 'eventId', 'userId', 'ticketNumber', 'timestamp'];
    const isValid = requiredFields.every(field => decrypted.hasOwnProperty(field));
    
    return isValid ? decrypted : null;
  } catch (error) {
    console.error('Error validating ticket data:', error);
    return null;
  }
};

export const generateQRCodeData = (ticketData: any): string => {
  return encryptTicketData(ticketData);
};

export const validateTicket = async (ticketId: string, validatedBy: string) => {
  return await supabase
    .from('event_tickets')
    .update({
      status: 'used',
      used_at: new Date().toISOString(),
      validated_by: validatedBy
    })
    .eq('id', ticketId);
};

export const getTicketByNumber = async (ticketNumber: string) => {
  return await supabase
    .from('event_tickets')
    .select(`
      *,
      events (
        id,
        name,
        date,
        location,
        description,
        image_url
      )
    `)
    .eq('ticket_number', ticketNumber)
    .single();
};
