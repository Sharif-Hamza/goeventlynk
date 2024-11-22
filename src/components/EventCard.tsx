import React, { useState } from 'react';
import { format } from 'date-fns';
import { MapPin, Calendar, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { Event } from '../types';

interface EventCardProps {
  event: Event & { club_name?: string };
  onRegister?: () => void;
}

export default function EventCard({ event, onRegister }: EventCardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  // Query for registration count and user's registration status
  const { data: registrationData } = useQuery({
    queryKey: ['event-registrations', event.id],
    queryFn: async () => {
      const { data: registrations, error } = await supabase
        .from('event_registrations')
        .select('id, status, user_id, payment_status, payment_amount, stripe_session_id, stripe_payment_intent_id')
        .eq('event_id', event.id);

      if (error) throw error;

      const userRegistration = user 
        ? registrations.find(reg => reg.user_id === user.id)
        : null;

      const approvedCount = registrations.filter(reg => reg.status === 'approved').length;
      const pendingCount = registrations.filter(reg => reg.status === 'pending').length;
      const waitlistPosition = userRegistration?.status === 'pending' 
        ? registrations
            .filter(reg => reg.status === 'pending')
            .findIndex(reg => reg.id === userRegistration.id) + 1
        : null;

      return {
        total: registrations.length,
        approved: approvedCount,
        pending: pendingCount,
        userRegistration,
        waitlistPosition,
        isFull: approvedCount >= event.capacity
      };
    },
    enabled: !!event.id,
    refetchInterval: 5000 // Refetch every 5 seconds to keep counts updated
  });

  const handleRegister = async () => {
    if (!user) {
      toast.error('Please sign in to register for events');
      return;
    }

    setLoading(true);
    try {
      if (event.price > 0) {
        // Create Stripe checkout session
        const { data: session, error: stripeError } = await supabase.functions.invoke('create-checkout-session', {
          body: { 
            eventId: event.id,
            userId: user.id,
            successUrl: `${window.location.origin}/events?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${window.location.origin}/events`
          }
        });

        if (stripeError) throw stripeError;

        // Create registration with pending status
        const { error: regError } = await supabase
          .from('event_registrations')
          .insert([{
            event_id: event.id,
            user_id: user.id,
            email: user.email,
            status: 'pending',
            payment_status: 'pending',
            payment_amount: event.price,
            stripe_session_id: session.sessionId
          }]);

        if (regError) throw regError;

        // Redirect to Stripe
        window.location.href = session.url;
      } else {
        // Free event - direct RSVP
        const { error: regError } = await supabase
          .from('event_registrations')
          .insert([{
            event_id: event.id,
            user_id: user.id,
            email: user.email,
            status: 'pending'
          }]);

        if (regError) throw regError;

        toast.success('RSVP request submitted! Awaiting approval.');
      }

      await queryClient.invalidateQueries({ queryKey: ['event-registrations', event.id] });
      if (onRegister) onRegister();
    } catch (error) {
      console.error('Error registering for event:', error);
      toast.error('Failed to register for event');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRSVP = async () => {
    if (!user || !registrationData?.userRegistration) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('event_registrations')
        .delete()
        .eq('id', registrationData.userRegistration.id);

      if (error) throw error;

      toast.success('Registration cancelled successfully');
      await queryClient.invalidateQueries({ queryKey: ['event-registrations', event.id] });
      if (onRegister) onRegister();
    } catch (error) {
      console.error('Error cancelling registration:', error);
      toast.error('Failed to cancel registration');
    } finally {
      setLoading(false);
    }
  };

  const approvedCount = registrationData?.approved || 0;
  const pendingCount = registrationData?.pending || 0;
  const isFull = registrationData?.isFull || false;
  const userStatus = registrationData?.userRegistration?.status;
  const userPaymentStatus = registrationData?.userRegistration?.payment_status;
  const waitlistPosition = registrationData?.waitlistPosition;

  const getStatusBadge = () => {
    if (!userStatus) return null;

    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`inline-block px-2 py-1 rounded-full text-sm ${badges[userStatus]}`}>
        {userStatus === 'pending' && waitlistPosition && isFull
          ? `Waitlist #${waitlistPosition}`
          : userStatus.charAt(0).toUpperCase() + userStatus.slice(1)}
      </span>
    );
  };

  const getActionButton = () => {
    if (loading) {
      return (
        <button className="btn btn-primary w-full" disabled>
          Processing...
        </button>
      );
    }

    if (registrationData?.userRegistration) {
      return (
        <div className="space-y-2">
          <div className="text-center">{getStatusBadge()}</div>
          {userStatus !== 'rejected' && (
            <button 
              className="btn btn-secondary w-full"
              onClick={handleCancelRSVP}
              disabled={loading}
            >
              Cancel Registration
            </button>
          )}
        </div>
      );
    }

    if (isFull) {
      return (
        <button 
          onClick={handleRegister}
          className="btn btn-secondary w-full"
        >
          Join Waitlist
        </button>
      );
    }

    return (
      <button 
        className="btn btn-primary w-full"
        onClick={handleRegister}
      >
        {event.price > 0 ? `Purchase Ticket - $${event.price}` : 'RSVP Now'}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {event.image_url && (
        <img 
          src={event.image_url} 
          alt={event.title} 
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-800">{event.title}</h3>
            {event.club_name && (
              <p className="text-sm text-purple-600">{event.club_name}</p>
            )}
          </div>
          {getStatusBadge()}
        </div>
        
        <p className="text-gray-600 mb-4">{event.description}</p>
        
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-gray-600">
            <Calendar className="w-5 h-5 mr-2" />
            <span>{format(new Date(event.date), 'PPP')}</span>
          </div>
          
          <div className="flex items-center text-gray-600">
            <MapPin className="w-5 h-5 mr-2" />
            <span>{event.location}</span>
          </div>
          
          <div className="flex items-center text-gray-600">
            <Users className="w-5 h-5 mr-2" />
            <span>
              {approvedCount} / {event.capacity} spots taken
              {pendingCount > 0 && 
                ` (${pendingCount} on waitlist)`
              }
            </span>
          </div>
        </div>

        {getActionButton()}
      </div>
    </div>
  );
}