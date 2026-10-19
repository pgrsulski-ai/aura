import { Home, Search, User, Plus, ShoppingBag } from 'lucide-react';
import type { TabKey } from '@/types';

interface BottomNavProps {
  active: TabKey | 'shop';
  onChange: (tab: TabKey) => void;
  onCreate?: () => void;
  onOpenShop?: () => void;
  isAuthed?: boolean;
}

export function BottomNav({ active, onChange, onCreate, onOpenShop, isAuthed }: BottomNavProps) {
  const tabButton = (key: TabKey, icon: React.ReactNode, label: string) => {
    const isActive = active === key;
    return (
      <button
        onClick={() => onChange(key)}
        className="flex flex-1 flex-col items-center gap-0.5 transition-colors touch-manipulation"
      >
        <span className={isActive ? 'text-neon neon-text' : 'text-white/55'}>
          {icon}
        </span>
        <span
          className={`text-[10px] font-semibold ${
            isActive ? 'text-neon' : 'text-white/55'
          }`}
        >
          {label}
        </span>
      </button>
    );
  };

  return (
    <>
      {/* Floating Action Button — bottom-right, above the nav bar */}
      {isAuthed && (
        <button
          onClick={() => onCreate?.()}
          aria-label="Create"
          className="absolute bottom-[112px] right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-neon to-emerald-400 text-neutral-950 shadow-[0_0_24px_rgba(0,255,163,0.55)] ring-4 ring-neutral-950 transition-transform active:scale-90 hover:scale-105"
        >
          <Plus size={28} strokeWidth={3} />
        </button>
      )}

      {/* Clean bottom nav bar: Home, Search, Shop, Profile */}
      <nav className="absolute bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-neutral-950/95 backdrop-blur-lg pb-14">
        <div className="flex items-stretch justify-around px-2 py-2">
          {tabButton('home', <Home className="h-6 w-6" />, 'Home')}
          {tabButton('search', <Search className="h-6 w-6" />, 'Search')}
          <button
            onClick={() => onOpenShop?.()}
            className="flex flex-1 flex-col items-center gap-0.5 transition-colors touch-manipulation"
          >
            <span className={active === 'shop' ? 'text-neon neon-text' : 'text-white/55'}>
              <ShoppingBag className="h-6 w-6" />
            </span>
            <span
              className={`text-[10px] font-semibold ${
                active === 'shop' ? 'text-neon' : 'text-white/55'
              }`}
            >
              Shop
            </span>
          </button>
          {tabButton('profile', <User className="h-6 w-6" />, 'Profile')}
        </div>
      </nav>
    </>
  );
}
