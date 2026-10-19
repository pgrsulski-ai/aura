import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { StripeProduct } from '@/stripe-config';

export function useCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkout = async (product: StripeProduct) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('You must be signed in to purchase Aura Coins.');

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`;
      const payload = {
        priceId: product.priceId,
        mode: product.mode,
        successUrl: `${window.location.origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/?payment=cancelled`,
      };

      console.log('[useCheckout] POST', fnUrl, { ...payload, token: '[redacted]' });

      const response = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      console.log('[useCheckout] response', response.status, data);

      if (!response.ok) {
        const msg = data.error || `Checkout failed (${response.status})`;
        throw new Error(msg);
      }

      if (!data.url) {
        throw new Error('No checkout URL returned by server');
      }

      window.location.href = data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      console.error('[useCheckout] checkout error:', err);
      setError(msg);
      setLoading(false);
      alert(`Checkout error: ${msg}`);
    }
  };

  return { checkout, loading, error };
}