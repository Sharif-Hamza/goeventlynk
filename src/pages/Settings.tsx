import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Settings as SettingsIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import NotificationToggle from '../components/NotificationToggle';

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        full_name: user.full_name || '',
      });
    }
  }, [user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    setAvatar(e.target.files[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      let avatar_url = user.avatar_url;

      if (avatar) {
        const fileExt = avatar.name.split('.').pop();
        const fileName = `${user.id}-${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(`avatars/${fileName}`, avatar);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('images')
          .getPublicUrl(`avatars/${fileName}`);

        avatar_url = publicUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          username: formData.username,
          full_name: formData.full_name,
          avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="w-8 h-8 text-purple-700" />
        <h1 className="text-3xl font-bold text-purple-700">Settings</h1>
      </div>

      <div className="space-y-6">
        {/* Profile Settings */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Profile Settings</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Profile Picture
              </label>
              <div className="mt-2 flex items-center space-x-4">
                <img
                  src={user?.avatar_url || 'https://via.placeholder.com/150'}
                  alt="Profile"
                  className="h-16 w-16 rounded-full object-cover"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                type="text"
                id="username"
                required
                className="input"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                type="text"
                id="full_name"
                required
                className="input"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>

            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Notification Settings</h2>
          <NotificationToggle />
          
          <div className="mt-6 space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Email Notifications</h3>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={user?.notification_preferences?.events}
                  onChange={async (e) => {
                    if (!user) return;
                    const { error } = await supabase
                      .from('profiles')
                      .update({
                        notification_preferences: {
                          ...user.notification_preferences,
                          events: e.target.checked
                        }
                      })
                      .eq('id', user.id);

                    if (error) {
                      toast.error('Failed to update notification settings');
                    }
                  }}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Notify me about new events
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={user?.notification_preferences?.announcements}
                  onChange={async (e) => {
                    if (!user) return;
                    const { error } = await supabase
                      .from('profiles')
                      .update({
                        notification_preferences: {
                          ...user.notification_preferences,
                          announcements: e.target.checked
                        }
                      })
                      .eq('id', user.id);

                    if (error) {
                      toast.error('Failed to update notification settings');
                    }
                  }}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Notify me about new announcements
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}