import { useState, useEffect } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';

export const useStripeLoader = (publishableKey: string) => {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [error, setError] = useState<Error | null>(null);

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
            setError(fallbackError as Error);
            console.error('Stripe fallback loading failed:', fallbackError);
          }
        };

        script.onerror = (err) => {
          setError(err as Error);
          console.error('Stripe script loading error:', err);
        };

        document.head.appendChild(script);

        return () => {
          document.head.removeChild(script);
        };
      } catch (err) {
        setError(err as Error);
        console.error('Stripe initialization error:', err);
      }
    };

    if (publishableKey) {
      loadStripeScript();
    }
  }, [publishableKey]);

  return { stripe, error };
};
