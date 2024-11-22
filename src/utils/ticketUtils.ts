import CryptoJS from 'crypto-js';
import { supabase } from '../lib/supabase';

const ENCRYPTION_KEY = import.meta.env.VITE_TICKET_ENCRYPTION_KEY || 'eventlynk-dev-key';

interface TicketData {
  ticketId: string;
  eventId: string;
  userId: string;
  ticketNumber: string;
  timestamp: number;
}

// Function to get user's tickets with all details
export const getUserTickets = async (userId: string) => {
  try {
    const { data: tickets, error } = await supabase
      .from('event_tickets')
      .select(`
        *,
        event: events!event_tickets_event_id_fkey (
          id,
          title,
          event_date,
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
    const ticketId = crypto.randomUUID();
    const ticketNumber = generateTicketNumber();
    
    // Create ticket data for the barcode
    const ticketData: TicketData = {
      ticketId,
      eventId,
      userId,
      ticketNumber,
      timestamp: Date.now(),
    };

    // Encrypt the ticket data for the barcode
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

    // Prepare ticket data for database
    const ticketToUpsert = {
      id: ticketId,
      user_id: userId,
      event_id: eventId,
      ticket_number: ticketNumber,
      qr_code_data: qrCodeData,
      ticket_data: ticketData, // Store raw ticket data for validation
      payment_status: paymentStatus,
      payment_id: paymentId,
      status: 'valid'
    };

    // If ticket exists, use its ID
    if (existingTickets?.[0]) {
      ticketToUpsert.id = existingTickets[0].id;
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

    // Get ticket with event details
    const { data: ticketWithDetails, error: detailsError } = await supabase
      .from('event_tickets')
      .select(`
        *,
        event: events!event_tickets_event_id_fkey (
          id,
          title,
          event_date,
          location,
          description,
          image_url
        )
      `)
      .eq('id', ticket.id)
      .single();

    if (detailsError) {
      console.error('Error fetching ticket details:', detailsError);
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

export const encryptTicketData = (data: TicketData): string => {
  const jsonString = JSON.stringify(data);
  return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
};

export const decryptTicketData = (encryptedData: string): TicketData | null => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Error decrypting ticket data:', error);
    return null;
  }
};

export const validateTicketData = (encryptedData: string): TicketData | null => {
  try {
    const decrypted = decryptTicketData(encryptedData);
    if (!decrypted) return null;

    // Verify all required fields are present
    const requiredFields: (keyof TicketData)[] = ['ticketId', 'eventId', 'userId', 'ticketNumber', 'timestamp'];
    const isValid = requiredFields.every(field => decrypted[field] !== undefined);
    
    return isValid ? decrypted : null;
  } catch (error) {
    console.error('Error validating ticket data:', error);
    return null;
  }
};

export const generateQRCodeData = (ticketData: TicketData): string => {
  return encryptTicketData(ticketData);
};

export const validateTicket = async (ticketId: string, validatedBy: string) => {
  try {
    // Get current ticket status
    const { data: ticket, error: fetchError } = await supabase
      .from('event_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (fetchError || !ticket) {
      throw new Error(fetchError?.message || 'Ticket not found');
    }

    if (ticket.status === 'used') {
      throw new Error('Ticket has already been used');
    }

    // Update ticket status
    const { data: updatedTicket, error: updateError } = await supabase
      .from('event_tickets')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        validated_by: validatedBy
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return {
      success: true,
      ticket: updatedTicket,
      message: 'Ticket validated successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to validate ticket'
    };
  }
};

export const getTicketByNumber = async (ticketNumber: string) => {
  return await supabase
    .from('event_tickets')
    .select(`
      *,
      event: events!event_tickets_event_id_fkey (
        id,
        title,
        event_date,
        location,
        description,
        image_url
      )
    `)
    .eq('ticket_number', ticketNumber)
    .single();
};
