import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Event } from '../types';
import EventCard from '../components/EventCard';
import { Calendar, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CreateEventModal from '../components/CreateEventModal';

export default function Events() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events_with_clubs')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;
      return data as (Event & { club_name: string })[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-purple-700" />
          <h1 className="text-3xl font-bold text-purple-700">Upcoming Events</h1>
        </div>
        {(user?.is_admin || user?.role === 'club_admin') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Event
          </button>
        )}
      </div>

      {!events?.length ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800">No events found</h2>
          <p className="text-gray-600 mt-2">Check back later for upcoming events!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <EventCard 
              key={event.id} 
              event={event} 
              onRegister={() => refetch()}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateEventModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            refetch();
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}