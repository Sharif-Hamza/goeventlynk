import React, { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import type { Event } from '../types';

interface RSVPModalProps {
  event: Event;
  isFull: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RSVPModal({ event, isFull, onClose, onSuccess }: RSVPModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: user?.email || '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please sign in to RSVP');
      return;
    }

    setLoading(true);
    try {
      // Check if user already registered
      const { data: existingReg } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .single();

      if (existingReg) {
        toast.error('You have already registered for this event');
        onClose();
        return;
      }

      const { error: regError } = await supabase
        .from('event_registrations')
        .insert({
          event_id: event.id,
          user_id: user.id,
          email: formData.email,
          message: formData.message,
          status: 'pending'
        });

      if (regError) throw regError;

      toast.success(isFull 
        ? 'Added to waitlist! You will be notified if a spot becomes available.'
        : 'RSVP request submitted successfully!'
      );
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Error registering for event:', error);
      toast.error('Failed to submit registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {isFull ? 'Join Waitlist' : (event.price > 0 ? 'Purchase Ticket' : 'RSVP')} for {event.title}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {isFull && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800">
              This event is currently full. You will be added to the waitlist and notified if a spot becomes available.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              required
              className="input"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700">
              Message (Optional)
            </label>
            <textarea
              id="message"
              rows={3}
              className="input"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Any special requests or notes?"
            />
          </div>

          {event.price > 0 && (
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-purple-800 font-medium">
                Ticket Price: ${event.price}
              </p>
              <p className="text-sm text-purple-600 mt-1">
                Payment will be collected at the event
              </p>
            </div>
          )}

          <div className="flex justify-end gap-4 mt-6">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : isFull ? 'Join Waitlist' : (event.price > 0 ? 'Request Ticket' : 'Submit RSVP')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}