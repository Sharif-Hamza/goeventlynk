import CryptoJS from 'crypto-js';
import { supabase } from '../lib/supabase';

// Use environment variable or a secure key management system in production
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'eventlynk-dev-key';

export interface TicketData {
  ticketId: string;
  eventId: string;
  userId: string;
  ticketNumber: string;
  timestamp: number;
}

export const generateTicketNumber = (): string => {
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
    if (!decryptedString) {
      return null;
    }
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

    const requiredFields = ['ticketId', 'eventId', 'userId', 'ticketNumber', 'timestamp'];
    const isValid = requiredFields.every(field => decrypted.hasOwnProperty(field));
    
    return isValid ? decrypted : null;
  } catch (error) {
    console.error('Error validating ticket data:', error);
    return null;
  }
};

export const generateQRCodeData = (ticketData: TicketData): string => {
  return encryptTicketData(ticketData);
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

export const getTicketByNumber = async (ticketNumber: string) => {
  return await supabase
    .from('event_tickets')
    .select('*, events(*)')
    .eq('ticket_number', ticketNumber)
    .single();
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
