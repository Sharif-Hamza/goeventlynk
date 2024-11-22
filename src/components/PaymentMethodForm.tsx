import React, { useState } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface PaymentMethodFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function PaymentMethodForm({ onSuccess, onCancel }: PaymentMethodFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    try {
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement)!,
      });

      if (stripeError) throw stripeError;

      // Save payment method to database
      const { error: dbError } = await supabase
        .from('payment_methods')
        .insert([
          {
            stripe_payment_method_id: paymentMethod.id,
            card_last4: paymentMethod.card?.last4,
            card_brand: paymentMethod.card?.brand,
            is_default: true, // First payment method is default
          },
        ]);

      if (dbError) throw dbError;

      toast.success('Payment method added successfully');
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error saving payment method:', error);
      toast.error('Failed to save payment method');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <div className="flex justify-end gap-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!stripe || loading}
        >
          {loading ? 'Saving...' : 'Save Payment Method'}
        </button>
      </div>
    </form>
  );
}