import { useState } from 'react';
import { X, Coins, Loader2, Sparkles, Music2, Crown, ShieldCheck } from 'lucide-react';
import { supabase } from '@/supabaseClient';

interface CoinStoreModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  currentBalance: number;
  onPurchased: (newBalance: number) => void;
}

interface CoinPackage {
  id: 'starter' | 'artist' | 'label';
  name: string;
  coins: number;
  price: string;
  priceValue: number;
  save?: number;
  icon: typeof Coins;
  accent: string;
  glow: string;
  tagline: string;
  priceId: string;
}

// priceId maps each package to its Stripe Price. Coins are re-derived
// server-side from the priceId, so the client can't tamper with the amount.
const PACKAGES: CoinPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    coins: 100,
    price: '$1.00',
    priceValue: 1,
    icon: Sparkles,
    accent: 'from-sky-500/20 to-cyan-500/10 border-sky-400/30',
    glow: 'text-sky-400',
    tagline: 'Test the waters',
    priceId: 'price_1URqIL9PnkcrbnnbydTZ8cyH',
  },
  {
    id: 'artist',
    name: 'Artist',
    coins: 500,
    price: '$4.00',
    priceValue: 4,
    save: 20,
    icon: Music2,
    accent: 'from-neon/20 to-emerald-600/10 border-neon/40',
    glow: 'text-neon',
    tagline: 'Best for creators',
    priceId: 'price_1URqJa9PnkcrbnnbmMaOBW4D',
  },
  {
    id: 'label',
    name: 'Label',
    coins: 1000,
    price: '$7.00',
    priceValue: 7,
    save: 30,
    icon: Crown,
    accent: 'from-amber-500/20 to-orange-600/10 border-amber-400/40',
    glow: 'text-amber-400',
    tagline: 'Maximum value',
    priceId: 'price_1URqKC9Pnkcrbnnb9QUbI2n2',
  },
];

export function CoinStoreModal({ open, onClose, currentBalance, onPurchased }: CoinStoreModalProps) {
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleBuy = async (pkg: CoinPackage) => {
    setError(null);
    setPurchasing(pkg.id);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('You must be signed in to purchase.');

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          priceId: pkg.priceId,
          successUrl: `${window.location.origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/?payment=cancelled`,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.url) {
        throw new Error(payload.error ?? 'Failed to start checkout. Please try again.');
      }
      // Redirect to Stripe hosted checkout. Stripe will return the user
      // to /?checkout=success&session_id=... on completion.
      window.location.href = payload.url;
    } catch (e) {
      console.error('[CoinStore] checkout start failed:', e);
      setError(e instanceof Error ? e.message : 'Checkout failed. Please try again.');
      setPurchasing(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <button
        type="button"
        aria-label="Close store"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
      />
      <div className="relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto no-scrollbar rounded-t-3xl sm:rounded-3xl border border-white/10 bg-neutral-900/95 p-6 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neon/20">
              <Coins className="h-5 w-5 text-neon" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">Aura Store</h2>
              <p className="text-[11px] text-white/50">Buy coins to boost & support artists</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Current Balance</span>
          <span className="flex items-center gap-1.5 font-display text-base font-bold text-neon">
            <Coins className="h-4 w-4" />
            {currentBalance.toLocaleString()}
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {PACKAGES.map((pkg) => {
            const Icon = pkg.icon;
            const isBuying = purchasing === pkg.id;
            return (
              <div
                key={pkg.id}
                className={`relative overflow-hidden rounded-2xl border bg-gradient-to-r ${pkg.accent} p-4 transition-transform`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ${pkg.glow}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-base font-bold text-white">{pkg.name}</h3>
                        {pkg.save && (
                          <span className="rounded-full bg-neon/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neon">
                            Save {pkg.save}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/50">{pkg.tagline}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-white">
                        <Coins className={`h-3.5 w-3.5 ${pkg.glow}`} />
                        {pkg.coins.toLocaleString()} coins
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="font-display text-lg font-bold text-white">{pkg.price}</span>
                    <button
                      onClick={() => handleBuy(pkg)}
                      disabled={isBuying || purchasing !== null}
                      className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-bold text-black transition-all hover:scale-105 disabled:opacity-60 disabled:hover:scale-100"
                    >
                      {isBuying ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Redirecting
                        </>
                      ) : (
                        'Buy'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-xs font-semibold text-red-400">
            {error}
          </div>
        )}

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[10px] text-white/40">
          <ShieldCheck className="h-3 w-3 text-neon/70" />
          Secure checkout powered by Stripe. Coins credit after payment confirms.
        </p>
      </div>
    </div>
  );
}
