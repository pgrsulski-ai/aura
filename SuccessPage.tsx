import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Coins, Home, ShoppingBag, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

type VerifyState = 'verifying' | 'paid' | 'pending' | 'error';

export function SuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading, refresh } = useProfile();
  const [animationDone, setAnimationDone] = useState(false);
  const [verifyState, setVerifyState] = useState<VerifyState>('verifying');
  const [balance, setBalance] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const t = setTimeout(() => setAnimationDone(true), 600);
    return () => clearTimeout(t);
  }, []);

  // Wait until auth has finished restoring before verifying. On a fresh
  // redirect from Stripe, getSession() may still be resolving, so checking
  // too early produces a false "You must be signed in" error.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      if (!sessionId) {
        setVerifyState('error');
        setErrorMsg('Missing checkout session.');
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !user) {
          setVerifyState('error');
          setErrorMsg('You must be signed in.');
          return;
        }
        const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-success?session_id=${encodeURIComponent(sessionId)}`;
        const res = await fetch(fnUrl, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        });
        if (cancelled) return;
        if (!res.ok) {
          setVerifyState('error');
          setErrorMsg('Could not verify your payment with Stripe.');
          return;
        }
        const payload = await res.json();
        if (payload.paid && typeof payload.balance === 'number') {
          setBalance(payload.balance);
          setVerifyState('paid');
          if (payload.credited) await refresh();
        } else if (payload.paid) {
          setVerifyState('paid');
          if (payload.credited) await refresh();
        } else {
          setVerifyState('pending');
        }
      } catch (e) {
        if (cancelled) return;
        setVerifyState('error');
        setErrorMsg(e instanceof Error ? e.message : 'Verification failed.');
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, authLoading, user]);

  const displayBalance = balance ?? profile?.wallet_balance ?? 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[200px] bg-emerald-500/10 rounded-full blur-2xl" />
      </div>

      <div className="relative max-w-md w-full text-center">
        {verifyState === 'verifying' && (
          <div className="flex flex-col items-center gap-4 py-20">
            <Loader2 size={32} className="text-violet-400 animate-spin" />
            <p className="text-white/50 text-sm">Confirming your payment with Stripe…</p>
          </div>
        )}

        {verifyState === 'error' && (
          <div className="py-20">
            <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <AlertCircle size={36} className="text-red-400" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Verification Problem</h1>
            <p className="text-white/50 mb-8">{errorMsg ?? 'Something went wrong.'}</p>
            <button
              onClick={() => navigate('/shop', { replace: true })}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/8 border border-white/10 text-white font-medium"
            >
              <ShoppingBag size={16} /> Back to Shop
            </button>
          </div>
        )}

        {verifyState === 'pending' && (
          <div className="py-20">
            <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Loader2 size={36} className="text-amber-400 animate-spin" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Payment Processing</h1>
            <p className="text-white/50 mb-8">Your coins will be credited once your payment finishes processing. You can check your wallet shortly.</p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/8 border border-white/10 text-white font-medium"
            >
              <Home size={16} /> Go Home
            </button>
          </div>
        )}

        {verifyState === 'paid' && (
          <>
            {/* Success icon */}
            <div
              className={`mx-auto mb-8 w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/10 border border-emerald-500/30 flex items-center justify-center transition-all duration-700 ${
                animationDone ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
              }`}
            >
              <CheckCircle size={44} className="text-emerald-400" strokeWidth={1.5} />
            </div>

            {/* Sparkle decoration */}
            <div className="flex justify-center gap-2 mb-6">
              {[...Array(3)].map((_, i) => (
                <Sparkles
                  key={i}
                  size={16}
                  className="text-violet-400 opacity-60"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>

            <h1 className="text-4xl font-bold mb-3 bg-gradient-to-br from-white to-white/70 bg-clip-text text-transparent">
              Payment Successful!
            </h1>
            <p className="text-white/50 text-lg mb-8 leading-relaxed">
              Your Aura Coins have been credited to your wallet. Time to make some noise.
            </p>

            {/* Wallet balance */}
            {!loading && (
              <div className="mb-10 p-6 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20">
                <p className="text-white/40 text-sm mb-2 uppercase tracking-widest text-xs font-semibold">
                  Current Balance
                </p>
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                    <Coins size={20} className="text-violet-400" />
                  </div>
                  <span className="text-4xl font-bold text-violet-300">
                    {displayBalance.toLocaleString()}
                  </span>
                  <span className="text-white/40 font-medium">coins</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate('/', { replace: true })}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white font-medium transition-all duration-200 hover:-translate-y-0.5"
              >
                <Home size={16} />
                Go Home
              </button>
              <button
                onClick={() => navigate('/shop', { replace: true })}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5"
              >
                <ShoppingBag size={16} />
                Buy More
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
