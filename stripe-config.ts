export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  currencySymbol: string;
  mode: 'payment' | 'subscription';
  coins: number;
}

// Stripe LIVE production price IDs. Coins are re-derived server-side from
// the priceId in the stripe-checkout edge function, so the client cannot
// tamper with the credited amount.
export const STRIPE_PRODUCTS: StripeProduct[] = [
  {
    id: 'tier_1_starter',
    priceId: 'price_1URqIL9PnkcrbnnbydTZ8cyH',
    name: '100 Aura Coins',
    description: 'Test the waters — 100 coins to boost posts and support artists.',
    price: 1.00,
    currency: 'usd',
    currencySymbol: '$',
    mode: 'payment',
    coins: 100,
  },
  {
    id: 'tier_2_artist',
    priceId: 'price_1URqJa9PnkcrbnnbmMaOBW4D',
    name: '500 Aura Coins',
    description: 'Best for creators — 500 coins with a 20% bonus. Boost more, reach further.',
    price: 4.00,
    currency: 'usd',
    currencySymbol: '$',
    mode: 'payment',
    coins: 500,
  },
  {
    id: 'tier_3_label',
    priceId: 'price_1URqKC9Pnkcrbnnb9QUbI2n2',
    name: '1000 Aura Coins',
    description: 'Maximum value — 1000 coins with a 30% bonus. Top-tier reach for labels.',
    price: 7.00,
    currency: 'usd',
    currencySymbol: '$',
    mode: 'payment',
    coins: 1000,
  },
];
