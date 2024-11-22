import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { initializeNotifications, disconnectNotifications } from '../lib/notifications';

export function useNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Initialize notifications if enabled
    if (user.notification_preferences?.push_enabled) {
      initializeNotifications(user.id);
    }

    return () => {
      if (user.notification_preferences?.push_enabled) {
        disconnectNotifications(user.id);
      }
    };
  }, [user]);
}