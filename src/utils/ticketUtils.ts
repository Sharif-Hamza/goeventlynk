import CryptoJS from 'crypto-js';
import { supabase } from '../lib/supabase';

// Use environment variable or a secure key management system in production
const ENCRYPTION_KEY = import.meta.env.VITE_TICKET_ENCRYPTION_KEY || 'eventlynk-dev-key';

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

export const createTicket = async (eventId: string, userId: string) => {
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
    const ticketData = {
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

export const createEventTicket = async (
  eventId: string,
  userId: string,
  ticketNumber: string = generateTicketNumber()
): Promise<{ data: any; error: any }> => {
  const ticketData = {
    event_id: eventId,
    user_id: userId,
    ticket_number: ticketNumber,
    status: 'valid',
    created_at: new Date().toISOString()
  };

  return await supabase.from('event_tickets').insert([ticketData]);
};

export const generateTicketNumber = (): string => {
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
    .select('*, events(*)')
    .eq('ticket_number', ticketNumber)
    .single();
};
