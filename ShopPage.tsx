import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Coins, Zap, Star, Shield, ArrowLeft, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import { STRIPE_PRODUCTS } from '@/stripe-config';
import { useCheckout } from '@/hooks/useCheckout';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { WalletBadge } from '@/components/WalletBadge';

const COIN_PERKS = [
  { icon: Zap, label: 'Boost your posts' },
  { icon: Star, label: 'Amplify your reach' },
  { icon: Sparkles, label: 'Stand out in the feed' },
];

export function ShopPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { checkout, loading, error } = useCheckout();
  const navigate = useNavigate();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const cancelled = searchParams.get('payment') === 'cancelled';

  const handleBuy = async (product: typeof STRIPE_PRODUCTS[0]) => {
    setSelectedProductId(product.id);
    await checkout(product);
    setSelectedProductId(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate('/', { replace: true })}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back</span>
          </button>

          <div className="flex items-center gap-2">
            <Coins size={20} className="text-violet-400" />
            <span className="font-bold text-lg tracking-tight">Aura Shop</span>
          </div>

          {user && <WalletBadge />}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 mb-6">
            <Sparkles size={14} className="text-violet-400" />
            <span className="text-sm text-violet-300 font-medium">In-App Currency</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-br from-white via-white/90 to-violet-300 bg-clip-text text-transparent">
            Aura Coins
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto leading-relaxed">
            Fuel your creative journey. Use Aura Coins to boost posts, unlock premium features, and grow your audience.
          </p>

          {profile && (
            <div className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10">
              <Coins size={16} className="text-violet-400" />
              <span className="text-white/70 text-sm">Your balance:</span>
              <span className="font-bold text-violet-300">{profile.wallet_balance.toLocaleString()} coins</span>
            </div>
          )}
        </div>

        {/* Perks */}
        <div className="grid grid-cols-3 gap-4 mb-16 max-w-xl mx-auto">
          {COIN_PERKS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/3 border border-white/8">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <Icon size={18} className="text-violet-400" />
              </div>
              <span className="text-xs text-white/60 text-center font-medium">{label}</span>
            </div>
          ))}
        </div>

        {/* Products */}
        <div className="flex justify-center">
          <div className="grid gap-6 w-full max-w-sm">
            {STRIPE_PRODUCTS.map((product) => {
              const isLoading = loading && selectedProductId === product.id;
              return (
                <div
                  key={product.id}
                  className="relative group rounded-3xl bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent border border-violet-500/20 p-8 hover:border-violet-400/40 transition-all duration-300"
                >
                  {/* Glow */}
                  <div className="absolute inset-0 rounded-3xl bg-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="relative">
                    {/* Icon + badge */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                        <Coins size={28} className="text-white" />
                      </div>
                      <div className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25">
                        <span className="text-xs font-semibold text-emerald-400">Best value</span>
                      </div>
                    </div>

                    {/* Name & description */}
                    <h2 className="text-2xl font-bold mb-2">{product.name}</h2>
                    <p className="text-white/50 text-sm leading-relaxed mb-6">{product.description}</p>

                    {/* What you get */}
                    <div className="space-y-2 mb-8">
                      {[
                        `${product.coins} Aura Coins`,
                        'Instant credit to wallet',
                        'Never expires',
                      ].map((item) => (
                        <div key={item} className="flex items-center gap-2.5">
                          <CheckCircle size={14} className="text-violet-400 flex-shrink-0" />
                          <span className="text-sm text-white/70">{item}</span>
                        </div>
                      ))}
                    </div>

                    {/* Price + CTA */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-3xl font-bold">{product.currencySymbol}{product.price.toFixed(2)}</span>
                        <span className="text-white/40 text-sm ml-1">{product.currency.toUpperCase()}</span>
                      </div>

                      <button
                        onClick={() => handleBuy(product)}
                        disabled={isLoading || loading}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 active:translate-y-0"
                      >
                        {isLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Redirecting…</span>
                          </>
                        ) : (
                          <>
                            <Zap size={14} />
                            <span>Buy Now</span>
                          </>
                        )}
                      </button>
                    </div>

                    {error && selectedProductId === product.id && (
                      <p className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                        {error}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Security note */}
        <div className="flex items-center justify-center gap-2 mt-12 text-white/30">
          <Shield size={14} />
          <span className="text-xs">Payments secured by Stripe. No card data stored.</span>
        </div>

        {cancelled && (
          <div className="mt-8 max-w-md mx-auto flex items-center gap-3 px-5 py-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span className="text-sm">Checkout was cancelled. Your wallet was not charged.</span>
          </div>
        )}

        {!user && (
          <div className="mt-8 text-center">
            <p className="text-white/40 text-sm">
              <Link
                to="/login"
                className="inline-flex items-center text-violet-400 hover:text-violet-300 underline underline-offset-4 font-medium px-1 py-0.5 touch-manipulation"
              >
                Sign in
              </Link>{' '}
              to purchase Aura Coins.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}