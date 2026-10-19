import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Profile {
  id: string;
  handle: string;
  bio: string | null;
  avatar_url: string | null;
  wallet_balance: number;
  last_daily_bonus_at: string | null;
  role: 'user' | 'admin';
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  const refresh = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();
    if (data) setProfile(data);
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        setProfile(data);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  return { profile, loading, refresh };
}