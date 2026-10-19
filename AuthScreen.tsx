import { useEffect, useState } from 'react';
import { Zap, Mail, Lock, User as UserIcon, AlertCircle, Loader2, MailCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '@/supabaseClient';

interface AuthScreenProps {
  onAuthed: () => void;
}

type View = 'login' | 'register' | 'check-email';

export function AuthScreen({ onAuthed }: AuthScreenProps) {
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Listen for auth state changes. When the user clicks the email
  // confirmation link and is redirected back, Supabase fires SIGNED_IN.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setToast('Account successfully verified!');
        onAuthed();
      }
    });
    return () => subscription.unsubscribe();
  }, [onAuthed]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      if (view === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { handle: handle.trim() || email.split('@')[0] },
            emailRedirectTo: window.location.origin + window.location.pathname,
          },
        });
        if (signUpError) throw signUpError;
        // No active session → email confirmation required.
        if (!data.session) {
          setView('check-email');
          return;
        }
        onAuthed();
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        onAuthed();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      if (msg.toLowerCase().includes('invalid credentials') || msg.toLowerCase().includes('invalid login')) {
        setError('Incorrect email or password.');
      } else if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')) {
        setError('An account with this email already exists. Try logging in.');
      } else if (msg.toLowerCase().includes('email not confirmed')) {
        setError('Your email is not confirmed yet. Check your inbox for the activation link.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (view === 'check-email') {
    return (
      <div className="relative flex h-full flex-col items-center justify-center bg-neutral-950 px-6">
        {/* Animated envelope */}
        <div className="relative mb-8">
          <div className="absolute inset-0 animate-ping rounded-full bg-neon/10" />
          <div className="relative rounded-2xl bg-neon/15 p-6">
            <MailCheck className="h-12 w-12 text-neon" strokeWidth={1.5} />
          </div>
        </div>

        <h1 className="font-display text-2xl font-bold text-white text-center">
          Check your inbox!
        </h1>
        <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-white/60">
          We sent an activation link to:{' '}
          <span className="font-semibold text-neon">{email}</span>. Click it to verify your
          account and log in to Aura Music.
        </p>

        <button
          onClick={() => {
            setView('login');
            setPassword('');
            setError(null);
          }}
          className="mt-8 flex w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-neon py-3.5 text-sm font-bold text-neutral-950 neon-glow transition-transform active:scale-[0.98]"
        >
          Go to login <ArrowRight className="h-4 w-4" />
        </button>

        <button
          onClick={() => {
            setView('register');
            setError(null);
          }}
          className="mt-4 text-sm text-white/50 transition-colors hover:text-neon"
        >
          Use a different email
        </button>

        {toast && <Toast message={toast} />}
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center bg-neutral-950 px-6">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-3 rounded-2xl bg-neon/15 p-4">
          <Zap className="h-8 w-8 fill-neon text-neon" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white">AURA</h1>
        <p className="mt-1 text-sm text-white/50">
          {view === 'login' ? 'Welcome back' : 'Create your account'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {view === 'register' && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
              Handle
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full rounded-xl bg-neutral-900 border border-neutral-700 pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-neon/50"
                placeholder="@username"
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-neutral-900 border border-neutral-700 pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-neon/50"
              placeholder="you@email.com"
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-neutral-900 border border-neutral-700 pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-neon/50"
              placeholder="••••••••"
              autoComplete={view === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-neon py-3.5 text-sm font-bold text-neutral-950 neon-glow transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {view === 'login' ? 'Signing in...' : 'Creating account...'}
            </>
          ) : (
            <>{view === 'login' ? 'Log In' : 'Create Account'}</>
          )}
        </button>
      </form>

      {/* Toggle mode */}
      <button
        onClick={() => {
          setView((v) => (v === 'login' ? 'register' : 'login'));
          setError(null);
        }}
        className="mt-6 text-sm text-white/50 transition-colors hover:text-neon"
      >
        {view === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <span className="font-bold text-neon">
          {view === 'login' ? 'Sign up' : 'Log in'}
        </span>
      </button>

      {toast && <Toast message={toast} />}
    </div>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed top-6 left-1/2 z-[100] -translate-x-1/2 animate-fade-in">
      <div className="flex items-center gap-2.5 rounded-xl border border-neon/30 bg-neutral-900 px-4 py-3 shadow-2xl shadow-neon/10">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-neon" />
        <p className="text-sm font-semibold text-white">{message}</p>
      </div>
    </div>
  );
}
