import { Coins } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';

export function WalletBadge() {
  const { user } = useAuth();
  const { profile } = useProfile();

  if (!user || !profile) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30 rounded-full">
      <Coins size={14} className="text-violet-400" />
      <span className="text-sm font-semibold text-violet-300">
        {profile.wallet_balance.toLocaleString()}
      </span>
    </div>
  );
}