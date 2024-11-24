import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import EventTicket from '../components/EventTicket';
import { getUserTickets } from '../utils/ticketUtils';

export default function EventHistory() {
  const { user } = useAuth();

  // Fetch user's tickets using the working getUserTickets function
  const { data: tickets, isLoading: ticketsLoading, error, refetch } = useQuery({
    queryKey: ['user-tickets', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const tickets = await getUserTickets(user.id);
      if (!tickets) return [];
      return tickets.filter(ticket => ticket.event); // Only show tickets with valid event data
    },
    enabled: !!user,
    staleTime: 1000 * 60, // Consider data stale after 1 minute
    refetchOnWindowFocus: true,
  });

  // Handle error state
  if (error) {
    console.error('Error fetching tickets:', error);
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-2xl font-bold mb-6">Event History</h1>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-red-500">Error loading tickets. Please try again later.</p>
            <button 
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

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
              <EventTicket ticket={ticket} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}