import React, { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { initializeNotifications, disconnectNotifications } from '../lib/notifications';
import toast from 'react-hot-toast';

export default function NotificationToggle() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const checkSupport = async () => {
      const isSupported = 'Notification' in window;
      setSupported(isSupported);

      if (isSupported && user?.notification_preferences?.push_enabled) {
        setEnabled(Notification.permission === 'granted');
      }
    };

    checkSupport();
  }, [user]);

  const handleToggle = async () => {
    if (!user) {
      toast.error('Please sign in to manage notifications');
      return;
    }

    if (!supported) {
      toast.error('Notifications are not supported in your browser');
      return;
    }

    setLoading(true);
    try {
      if (!enabled) {
        // Initialize notifications
        const success = await initializeNotifications(user.id);
        if (!success) {
          toast.error('Please enable notifications in your browser settings');
          return;
        }
        setEnabled(true);
        toast.success('Notifications enabled successfully');
      } else {
        // Disconnect notifications
        await disconnectNotifications(user.id);
        setEnabled(false);
        toast.success('Notifications disabled');
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      toast.error('Failed to update notification settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Browser Notifications</h3>
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {enabled ? (
              <Bell className="w-5 h-5 text-purple-600" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-600" />
            )}
            <span className="text-sm font-medium text-gray-900">
              Browser Notifications
            </span>
          </div>
          <button
            onClick={handleToggle}
            disabled={loading}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2 ${
              enabled ? 'bg-purple-600' : 'bg-gray-200'
            }`}
            role="switch"
            aria-checked={enabled}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {loading
            ? 'Processing...'
            : enabled
            ? 'You will receive notifications for new events and announcements'
            : 'Enable notifications to stay updated with new events and announcements'}
        </p>
        {!supported && (
          <p className="mt-2 text-sm text-red-500">
            Your browser does not support notifications
          </p>
        )}
      </div>
    </div>
  );
}