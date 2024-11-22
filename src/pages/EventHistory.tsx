import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import EventTicket from '../components/EventTicket';
import { generateQRCodeData } from '../utils/ticketUtils';
import toast from 'react-hot-toast';

export default function EventHistory() {
  const { user } = useAuth();

  // Fetch user's tickets
  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ['user-tickets', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('event_tickets_with_details')
        .select()
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (ticketsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-2xl font-bold mb-6">Loading tickets...</h1>
        </div>
      </div>
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-2xl font-bold mb-6">Event History</h1>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">No tickets found. RSVP to events to see them here!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-6">Event History</h1>
        
        <div className="space-y-6">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="bg-white rounded-lg shadow overflow-hidden">
              <EventTicket
                eventName={ticket.event_title}
                eventDate={ticket.event_date}
                eventLocation={ticket.event_location}
                ticketNumber={ticket.ticket_number}
                qrCodeData={ticket.qr_code_data}
                userName={ticket.full_name || user?.email || ''}
                status={ticket.status}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}