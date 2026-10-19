import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface DailyBonusResult {
  claimed: boolean;
  newBalance: number | null;
}

// Claims the 5-coin daily login bonus once per UTC calendar day, on mount,
// when an authenticated user is present. Returns the latest claim result and
// a `claiming` flag so callers can show a celebratory toast.
export function useDailyBonus(userId: string | undefined) {
  const [claiming, setClaiming] = useState(false);
  const [lastResult, setLastResult] = useState<DailyBonusResult | null>(null);
  const ranRef = useRef<string | null>(null);

  const claim = useCallback(async (): Promise<DailyBonusResult | null> => {
    const { data, error } = await supabase.rpc('claim_daily_bonus');
    if (error) {
      console.error('[useDailyBonus] claim_daily_bonus failed:', error);
      return null;
    }
    const result = data as DailyBonusResult & { ok?: boolean; error?: string };
    if (result && result.ok !== false) {
      return { claimed: Boolean(result.claimed), newBalance: result.newBalance ?? null };
    }
    return null;
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (ranRef.current === userId) return;
    ranRef.current = userId;

    let cancelled = false;
    (async () => {
      setClaiming(true);
      // Log the welcome bonus row the first time we see this user, so the
      // 100-coin signup bonus shows up in their transaction history.
      await supabase.rpc('log_welcome_bonus_if_missing').then(
        (r) => {
          if (r.error) console.error('[useDailyBonus] welcome bonus log failed:', r.error);
        },
      );
      const res = await claim();
      if (cancelled) return;
      setLastResult(res);
      setClaiming(false);
    })();

    return () => { cancelled = true; };
  }, [userId, claim]);

  return { claiming, lastResult, claim };
}
