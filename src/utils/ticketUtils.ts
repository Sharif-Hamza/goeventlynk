import CryptoJS from 'crypto-js';
import { supabase } from '../lib/supabase';

// Use environment variable or a secure key management system in production
const ENCRYPTION_KEY = import.meta.env.VITE_TICKET_ENCRYPTION_KEY || 'eventlynk-dev-key';

export interface TicketData {
  ticketId: string;
  userId: string;
  eventId: string;
  ticketNumber: string;
  timestamp: number;
}

export const generateTicketNumber = () => {
  // Generate a random 8-digit number
  const randomNum = Math.floor(10000000 + Math.random() * 90000000);
  return `TKT${randomNum}`;
};

export const encryptTicketData = (data: TicketData): string => {
  const jsonString = JSON.stringify(data);
  return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
};

export const decryptTicketData = (encryptedData: string): TicketData => {
  const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
  const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
  return JSON.parse(decryptedString);
};

export const generateQRCodeData = (ticketData: TicketData): string => {
  return encryptTicketData(ticketData);
};

export const validateTicketData = (encryptedData: string): TicketData | null => {
  try {
    return decryptTicketData(encryptedData);
  } catch (error) {
    console.error('Error validating ticket data:', error);
    return null;
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
    const ticketData: TicketData = {
      ticketId: crypto.randomUUID(),
      userId,
      eventId,
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
