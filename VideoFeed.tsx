import { useEffect, useRef, useState } from 'react';
import { Plus, Zap, Music2 } from 'lucide-react';
import { VideoCard } from './VideoCard';
import type { Post, FeedTab, VideoTypeFilter } from '@/types';

interface VideoFeedProps {
  posts: Post[];
  activeIndex: number;
  feedTab: FeedTab;
  videoTypeFilter: VideoTypeFilter;
  onVideoTypeFilterChange: (v: VideoTypeFilter) => void;
  onTabChange: (tab: FeedTab) => void;
  onActiveIndexChange: (i: number) => void;
  onToggleFollow: (postId: string) => void;
  onToggleLike: (postId: string) => void;
  onToggleSave: (postId: string) => void;
  onOpenComments: (postId: string) => void;
  onOpenStudio: () => void;
  onDelete: (postId: string) => void;
  onEdit: (postId: string) => void;
  onBoost: (postId: string) => void;
  onSuperLike: (postId: string) => Promise<boolean>;
  onReport: (postId: string, hidden: boolean, alreadyReported: boolean) => void;
  isAdmin: boolean;
  onAdminDelete: (postId: string) => void;
  onAdminHide: (postId: string) => void;
  coinBalance: number;
  onOpenShop: () => void;
  onViewIncrement: (postId: string) => void;
}

export function VideoFeed({
  posts,
  activeIndex,
  feedTab,
  videoTypeFilter,
  onVideoTypeFilterChange,
  onTabChange,
  onActiveIndexChange,
  onToggleFollow,
  onToggleLike,
  onToggleSave,
  onOpenComments,
  onOpenStudio,
  onDelete,
  onEdit,
  onBoost,
  onSuperLike,
  onReport,
  isAdmin,
  onAdminDelete,
  onAdminHide,
  coinBalance,
  onOpenShop,
  onViewIncrement,
}: VideoFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [internalActive, setInternalActive] = useState(activeIndex);

  const followingPosts = posts.filter((p) => p.isFollowing || p.isOwn);
  const visiblePosts = feedTab === 'following' ? followingPosts : posts;

  // Scroll to a specific index (used by profile "play this track")
  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'auto' });
    }
  }, [activeIndex]);

  // IntersectionObserver: detect which video is most visible in the viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container || visiblePosts.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry with the highest intersection ratio that is intersecting
        let bestIdx = -1;
        let bestRatio = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = Number((entry.target as HTMLElement).dataset.index);
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestIdx = idx;
          }
        }
        if (bestIdx >= 0 && bestRatio > 0.5) {
          setInternalActive(bestIdx);
          onActiveIndexChange(bestIdx);
        }
      },
      {
        root: container,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    itemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [visiblePosts.length, onActiveIndexChange]);

  // Also detect via scroll for fast feedback
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const idx = Math.round(container.scrollTop / container.clientHeight);
        if (idx >= 0 && idx < visiblePosts.length) {
          setInternalActive(idx);
          onActiveIndexChange(idx);
        }
        ticking = false;
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [visiblePosts.length, onActiveIndexChange]);

  return (
    <div className="relative h-full bg-neutral-950">
      {/* Top tabs */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-center gap-8 pt-3 pb-2 bg-gradient-to-b from-black/70 to-transparent">
        <button
          onClick={() => onTabChange('discover')}
          className={`relative text-sm font-semibold transition-colors ${
            feedTab === 'discover' ? 'text-white' : 'text-white/50'
          }`}
        >
          Discover
          {feedTab === 'discover' && (
            <span className="absolute -bottom-1 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-neon" />
          )}
        </button>
        <button
          onClick={() => onTabChange('following')}
          className={`relative text-sm font-semibold transition-colors ${
            feedTab === 'following' ? 'text-white' : 'text-white/50'
          }`}
        >
          Following
          {feedTab === 'following' && (
            <span className="absolute -bottom-1 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-neon" />
          )}
        </button>
      </div>

      {/* Shorts / Full Tracks filter (Discover only) */}
      {feedTab === 'discover' && (
        <div className="absolute top-12 left-0 right-0 z-30 flex items-center justify-center gap-2 px-4 pb-2">
          <button
            onClick={() => onVideoTypeFilterChange('short')}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all ${
              videoTypeFilter === 'short'
                ? 'bg-neon text-neutral-950 shadow-neon-glow'
                : 'bg-white/10 text-white/70 backdrop-blur-sm'
            }`}
          >
            <Zap className="h-3 w-3" />
            Shorts
          </button>
          <button
            onClick={() => onVideoTypeFilterChange('track')}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all ${
              videoTypeFilter === 'track'
                ? 'bg-neon text-neutral-950 shadow-neon-glow'
                : 'bg-white/10 text-white/70 backdrop-blur-sm'
            }`}
          >
            <Music2 className="h-3 w-3" />
            Full Tracks
          </button>
        </div>
      )}

      {/* Feed */}
      {visiblePosts.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center px-8 text-center">
          <div className="mb-5 rounded-full bg-neon/10 p-5">
            <svg className="h-9 w-9 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0014.25-3.75M19.5 8.25v3.75m0-3.75h-3.75" />
            </svg>
          </div>
          <p className="font-display text-lg font-bold text-white">The feed is empty</p>
          <p className="mt-1 text-sm text-white/50">
            Drop your first track!
          </p>
          <button
            onClick={onOpenStudio}
            className="mt-6 flex items-center gap-2 rounded-full bg-neon px-6 py-3 text-sm font-bold text-neutral-950 neon-glow transition-transform active:scale-95"
            aria-label="Open Aura Studio"
          >
            <Plus size={20} strokeWidth={2.5} />
            Open Aura Studio
          </button>
        </div>
      ) : (
        <div ref={containerRef} className="no-scrollbar snap-feed h-full overflow-y-scroll">
          {visiblePosts.map((post, i) => (
            <div
              key={post.id}
              data-index={i}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              className="snap-item h-full w-full"
            >
              <VideoCard
                post={post}
                isActive={i === internalActive}
                onToggleFollow={onToggleFollow}
                onToggleLike={onToggleLike}
                onToggleSave={onToggleSave}
                onOpenComments={onOpenComments}
                onDelete={onDelete}
                onEdit={onEdit}
                onBoost={onBoost}
                onSuperLike={onSuperLike}
                onReport={onReport}
                isAdmin={isAdmin}
                onAdminDelete={onAdminDelete}
                onAdminHide={onAdminHide}
                coinBalance={coinBalance}
                onOpenShop={onOpenShop}
                onViewIncrement={onViewIncrement}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
