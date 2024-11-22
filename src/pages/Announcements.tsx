import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Announcement } from '../types';
import AnnouncementCard from '../components/AnnouncementCard';
import { Bell, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CreateAnnouncementModal from '../components/CreateAnnouncementModal';

export default function Announcements() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: announcements, isLoading, refetch } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements_with_clubs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (Announcement & { club_name: string })[];
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
          <Bell className="w-8 h-8 text-purple-700" />
          <h1 className="text-3xl font-bold text-purple-700">Announcements</h1>
        </div>
        {(user?.is_admin || user?.role === 'club_admin') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Announcement
          </button>
        )}
      </div>

      {!announcements?.length ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800">No announcements found</h2>
          <p className="text-gray-600 mt-2">Check back later for updates!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {announcements.map((announcement) => (
            <AnnouncementCard 
              key={announcement.id} 
              announcement={announcement}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateAnnouncementModal
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