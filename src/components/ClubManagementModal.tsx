import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

interface ClubManagementModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ClubManagementModal({ onClose, onSuccess }: ClubManagementModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    admin_email: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.is_admin) {
      toast.error('Only administrators can create clubs');
      return;
    }

    setLoading(true);
    try {
      let banner_url = null;

      if (banner) {
        const fileExt = banner.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('clubs')
          .upload(fileName, banner);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('clubs')
          .getPublicUrl(fileName);

        banner_url = publicUrl;
      }

      // Create club
      const { error: clubError } = await supabase
        .from('clubs')
        .insert([{
          ...formData,
          banner_url
        }]);

      if (clubError) throw clubError;

      // Assign club admin role
      const { error: assignError } = await supabase.rpc(
        'assign_club_admin',
        { 
          user_email: formData.admin_email,
          club_id: (await supabase
            .from('clubs')
            .select('id')
            .eq('admin_email', formData.admin_email)
            .single()
          ).data?.id
        }
      );

      if (assignError) throw assignError;

      toast.success('Club created successfully!');
      onSuccess();
    } catch (error) {
      console.error('Error creating club:', error);
      toast.error('Failed to create club');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Create New Club</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Club Name
            </label>
            <input
              type="text"
              id="name"
              required
              className="input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              required
              rows={4}
              className="input"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="admin_email" className="block text-sm font-medium text-gray-700">
              Club Admin Email
            </label>
            <input
              type="email"
              id="admin_email"
              required
              className="input"
              value={formData.admin_email}
              onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Club Banner (Optional)
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="banner"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-purple-600 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="banner"
                      name="banner"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => setBanner(e.target.files?.[0] || null)}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF up to 10MB
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Club'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}