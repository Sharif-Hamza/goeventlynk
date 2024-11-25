import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';

export const useStripeLoader = (publishableKey) => {
  const [stripe, setStripe] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadStripeScript = async () => {
      try {
        // First, try standard Stripe loading
        const stripeInstance = await loadStripe(publishableKey);
        
        if (stripeInstance) {
          setStripe(stripeInstance);
          return;
        }

        // Fallback: manual script injection
        const script = document.createElement('script');
        script.src = '/stripe/v3';
        script.async = true;
        
        script.onload = async () => {
          try {
            const fallbackStripe = await loadStripe(publishableKey);
            setStripe(fallbackStripe);
          } catch (fallbackError) {
            setError(fallbackError);
            console.error('Stripe fallback loading failed:', fallbackError);
          }
        };

        script.onerror = (err) => {
          setError(err);
          console.error('Stripe script loading error:', err);
        };

        document.head.appendChild(script);

        return () => {
          document.head.removeChild(script);
        };
      } catch (err) {
        setError(err);
        console.error('Stripe initialization error:', err);
      }
    };

    if (publishableKey) {
      loadStripeScript();
    }
  }, [publishableKey]);

  return { stripe, error };
};
