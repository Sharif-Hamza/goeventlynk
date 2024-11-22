import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

interface TicketValidatorProps {
  clubId: string;
}

export default function TicketValidator({ clubId }: TicketValidatorProps) {
  const [ticketNumber, setTicketNumber] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const { user } = useAuth();

  const validateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketNumber.trim()) {
      toast.error('Please enter a ticket number');
      return;
    }

    setIsValidating(true);
    try {
      // Call the validate_ticket function
      const { data, error } = await supabase
        .rpc('validate_ticket', {
          ticket_number_param: ticketNumber.trim()
        });

      if (error) throw error;

      if (!data.success) {
        toast.error(data.message);
        return;
      }

      // Show success message with ticket details
      toast.success(data.message);
      
      // Show additional ticket info
      toast.success(
        `Validated ticket for ${data.ticket.event_title}\nAttendee: ${data.ticket.attendee_name}`,
        { duration: 5000 }
      );
      
      setTicketNumber(''); // Clear the input
    } catch (error: any) {
      console.error('Validation error:', error);
      toast.error(error.message || 'Error validating ticket');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Manual Ticket Validation</h3>
      <form onSubmit={validateTicket} className="space-y-4">
        <div>
          <label htmlFor="ticketNumber" className="block text-sm font-medium text-gray-700 mb-1">
            Ticket Number
          </label>
          <input
            type="text"
            id="ticketNumber"
            value={ticketNumber}
            onChange={(e) => setTicketNumber(e.target.value)}
            placeholder="Enter ticket number"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <button
          type="submit"
          disabled={isValidating}
          className={`w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
            isValidating ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isValidating ? 'Validating...' : 'Validate Ticket'}
        </button>
      </form>
    </div>
  );
}
