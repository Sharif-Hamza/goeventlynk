import { supabase } from './supabase';

export async function initializeNotifications(userId: string) {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return false;
    }

    // Update user preferences
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        notification_preferences: {
          push_enabled: true,
          events: true,
          announcements: true
        }
      })
      .eq('id', userId);

    if (updateError) throw updateError;
    return true;
  } catch (error) {
    console.error('Error initializing notifications:', error);
    throw error;
  }
}

export async function disconnectNotifications(userId: string) {
  try {
    // Update user preferences
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        notification_preferences: {
          push_enabled: false,
          events: true,
          announcements: true
        }
      })
      .eq('id', userId);

    if (updateError) throw updateError;
    return true;
  } catch (error) {
    console.error('Error disconnecting notifications:', error);
    throw error;
  }
}