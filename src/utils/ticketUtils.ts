import CryptoJS from 'crypto-js';
import { supabase } from '../lib/supabase';

// Use environment variable or a secure key management system in production
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default-key-for-development';

export interface TicketData {
  ticketId: string;
  eventId: string;
  userId: string;
  ticketNumber: string;
  timestamp: number;
}

export const generateTicketNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TKT-${timestamp}-${random}`;
};

export const encryptTicketData = (ticketData: {
  ticketId: string;
  eventId: string;
  userId: string;
  ticketNumber: string;
  timestamp: number;
}): string => {
  try {
    const dataString = JSON.stringify(ticketData);
    return CryptoJS.AES.encrypt(dataString, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error('Error encrypting ticket data:', error);
    return '';
  }
};

export const decryptTicketData = (encryptedData: string): {
  ticketId: string;
  eventId: string;
  userId: string;
  ticketNumber: string;
  timestamp: number;
} | null => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedString) {
      return null;
    }
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Error decrypting ticket data:', error);
    return null;
  }
};

export const validateTicketData = (ticketData: any): boolean => {
  if (!ticketData) return false;
  
  const requiredFields = ['ticketId', 'eventId', 'userId', 'ticketNumber', 'timestamp'];
  return requiredFields.every(field => ticketData.hasOwnProperty(field));
};

export const generateQRCodeData = (ticketData: TicketData): string => {
  return encryptTicketData(ticketData);
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
    const ticketData: TicketData = {
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
      .select('*')
      .eq('id', ticket.id)
      .maybeSingle();

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

export const createTicket = async (supabase: SupabaseClient, eventId: string, userId: string) => {
  try {
    const ticketNumber = generateTicketNumber();
    
    const { data: ticket, error } = await supabase
      .from('event_tickets')
      .insert([
        {
          event_id: eventId,
          user_id: userId,
          ticket_number: ticketNumber,
          status: 'active',
          created_at: new Date().toISOString(),
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Create encrypted ticket data
    const ticketData: TicketData = {
      ticketId: ticket.id,
      eventId: ticket.event_id,
      userId: ticket.user_id,
      ticketNumber: ticket.ticket_number,
      timestamp: Date.now()
    };

    // Return both the ticket and its encrypted data
    return {
      ...ticket,
      encryptedData: encryptTicketData(ticketData)
    };
  } catch (error) {
    console.error('Error creating ticket:', error);
    throw error;
  }
};

// Function to get user's tickets
export const getUserTickets = async (userId: string) => {
  try {
    const { data: tickets, error } = await supabase
      .from('event_tickets_with_details')
      .select('*')
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
