import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Building, UserMinus, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

interface Club {
  id: string;
  name: string;
  admin_email: string;
  description: string;
}

export default function ClubAdminManagement() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [selectedClub, setSelectedClub] = useState<string>('');
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const { data: clubs } = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clubs')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Club[];
    },
  });

  const { data: clubAdmins } = useQuery({
    queryKey: ['club-admins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('email, username, club_id')
        .eq('role', 'club_admin');

      if (error) throw error;
      return data;
    },
  });

  const handleAssignAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClub || !newAdminEmail) return;

    setLoading(true);
    try {
      const { error } = await supabase.rpc(
        'assign_club_admin',
        { 
          user_email: newAdminEmail,
          club_id: selectedClub
        }
      );

      if (error) throw error;

      toast.success('Club admin assigned successfully');
      setNewAdminEmail('');
      setSelectedClub('');
      queryClient.invalidateQueries({ queryKey: ['club-admins'] });
    } catch (error) {
      console.error('Error assigning club admin:', error);
      toast.error('Failed to assign club admin');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc(
        'remove_club_admin',
        { user_email: email }
      );

      if (error) throw error;

      toast.success('Club admin removed successfully');
      queryClient.invalidateQueries({ queryKey: ['club-admins'] });
    } catch (error) {
      console.error('Error removing club admin:', error);
      toast.error('Failed to remove club admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-3 mb-6">
        <Building className="w-6 h-6 text-purple-600" />
        <h2 className="text-xl font-semibold">Club Admin Management</h2>
      </div>

      {/* Assign New Admin Form */}
      <form onSubmit={handleAssignAdmin} className="mb-8 space-y-4">
        <div>
          <label htmlFor="club" className="block text-sm font-medium text-gray-700">
            Select Club
          </label>
          <select
            id="club"
            required
            className="input"
            value={selectedClub}
            onChange={(e) => setSelectedClub(e.target.value)}
          >
            <option value="">Select a club...</option>
            {clubs?.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            New Admin Email
          </label>
          <input
            type="email"
            id="email"
            required
            className="input"
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary flex items-center gap-2"
          disabled={loading}
        >
          <UserPlus className="w-5 h-5" />
          {loading ? 'Assigning...' : 'Assign Admin'}
        </button>
      </form>

      {/* Current Club Admins List */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Current Club Admins</h3>
        <div className="space-y-4">
          {clubAdmins?.map((admin) => (
            <div
              key={admin.email}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div>
                <p className="font-medium text-gray-900">{admin.username}</p>
                <p className="text-sm text-gray-600">{admin.email}</p>
              </div>
              <button
                onClick={() => handleRemoveAdmin(admin.email)}
                className="btn btn-secondary flex items-center gap-2"
                disabled={loading}
              >
                <UserMinus className="w-5 h-5" />
                Remove
              </button>
            </div>
          ))}
          {!clubAdmins?.length && (
            <p className="text-gray-500 text-center py-4">No club admins found</p>
          )}
        </div>
      </div>
    </div>
  );
}