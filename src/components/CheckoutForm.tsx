import React, { useState } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import type { Event } from '../types';

interface CheckoutFormProps {
  event: Event;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CheckoutForm({ event, onSuccess, onCancel }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !user) return;

    setLoading(true);
    setMessage('');

    try {
      // Create payment intent
      const { data: { clientSecret, paymentIntentId } } = await supabase
        .functions.invoke('create-payment-intent', {
          body: { eventId: event.id, userId: user.id }
        });

      if (!clientSecret) throw new Error('Failed to create payment intent');

      // Create event registration
      const { error: regError } = await supabase
        .from('event_registrations')
        .insert([
          {
            event_id: event.id,
            user_id: user.id,
            email: user.email,
            stripe_payment_intent_id: paymentIntentId,
            payment_amount: event.price,
          },
        ]);

      if (regError) throw regError;

      // Confirm payment
      const { error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
        },
      });

      if (stripeError) {
        setMessage(stripeError.message || 'Payment failed');
        return;
      }

      toast.success('Payment successful!');
      onSuccess();
    } catch (error) {
      console.error('Error processing payment:', error);
      setMessage('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-purple-50 p-4 rounded-lg">
        <p className="text-purple-800 font-medium">
          Total Amount: ${event.price}
        </p>
      </div>

      <div className="p-4 border rounded-lg">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
        />
      </div>

      {message && (
        <div className="text-red-600 text-sm">{message}</div>
      )}

      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!stripe || loading}
        >
          {loading ? 'Processing...' : `Pay $${event.price}`}
        </button>
      </div>
    </form>
  );
}