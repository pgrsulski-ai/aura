import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Heart,
  Music2,
  Play,
  Zap,
  Bookmark,
} from 'lucide-react';
import type { Post } from '@/types';
import { formatCount } from '@/hooks';
import { getFilterCss } from '@/filters';
import {
  fetchProfile,
  fetchPostsByUserId,
  fetchFollowCounts,
  toggleFollow as toggleFollowDb,
  type ProfileRow,
} from '@/postsApi';

interface CreatorProfileScreenProps {
  creatorId: string;
  currentUserId?: string;
  isFollowing: boolean;
  onBack: () => void;
  onPlayTrack: (postId: string, post: Post) => void;
  onFollowChange: (creatorId: string, following: boolean) => void;
}

export function CreatorProfileScreen({
  creatorId,
  currentUserId,
  isFollowing,
  onBack,
  onPlayTrack,
  onFollowChange,
}: CreatorProfileScreenProps) {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [creatorPosts, setCreatorPosts] = useState<Post[]>([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tracks' | 'shorts'>('tracks');
  const [following, setFollowing] = useState(isFollowing);
  const [followBusy, setFollowBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, psts, cnts] = await Promise.all([
        fetchProfile(creatorId),
        fetchPostsByUserId(creatorId, currentUserId),
        fetchFollowCounts(creatorId),
      ]);
      setProfile(p);
      setCreatorPosts(psts);
      setCounts(cnts);
    } catch (e) {
      console.error('[CreatorProfileScreen] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [creatorId, currentUserId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setFollowing(isFollowing);
  }, [isFollowing]);

  const handleFollow = useCallback(async () => {
    if (!currentUserId) return;
    const prev = following;
    setFollowing(!prev);
    setFollowBusy(true);
    try {
      await toggleFollowDb(creatorId, prev);
      onFollowChange(creatorId, !prev);
      setCounts((c) => ({
        ...c,
        followers: prev ? Math.max(0, c.followers - 1) : c.followers + 1,
      }));
    } catch (e) {
      setFollowing(prev);
      console.error('[CreatorProfileScreen] follow failed:', e);
    } finally {
      setFollowBusy(false);
    }
  }, [creatorId, currentUserId, following, onFollowChange]);

  const shorts = creatorPosts.filter((p) => p.videoType === 'short');
  const tracks = creatorPosts.filter((p) => p.videoType === 'track');
  const gridPosts = activeTab === 'shorts' ? shorts : tracks;
  const isSelf = currentUserId === creatorId;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-neutral-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-neutral-950">
        <p className="text-sm text-white/60">Creator not found</p>
        <button
          onClick={onBack}
          className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="no-scrollbar h-full overflow-y-auto bg-neutral-950 pb-32">
      {/* Header bar */}
      <div className="sticky top-0 z-20 flex items-center gap-3 bg-neutral-950/80 px-4 py-3 backdrop-blur-lg">
        <button
          onClick={onBack}
          className="rounded-full bg-white/8 p-2 text-white/70 transition-colors hover:text-neon"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-lg font-bold text-white">
          {profile.handle}
        </h1>
      </div>

      {/* Profile header */}
      <div className="px-5 pt-2 pb-5">
        <div className="flex items-start gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.handle}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-neon to-emerald-700 text-2xl font-bold text-white">
              {profile.handle.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0 pt-1">
            <h2 className="font-display text-xl font-bold text-white">
              {profile.handle}
            </h2>
            <p className="mt-1 text-sm text-white/60 line-clamp-2">
              {profile.bio || 'No bio yet'}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 flex items-center justify-around rounded-2xl bg-white/5 py-4">
          <div className="flex flex-col items-center">
            <span className="font-display text-lg font-bold text-white">
              {creatorPosts.length}
            </span>
            <span className="text-[11px] text-white/50">Posts</span>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="font-display text-lg font-bold text-white">
              {formatCount(counts.followers)}
            </span>
            <span className="text-[11px] text-white/50">Followers</span>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="font-display text-lg font-bold text-neon">
              {counts.following}
            </span>
            <span className="text-[11px] text-white/50">Following</span>
          </div>
        </div>

        {/* Follow button */}
        {!isSelf && (
          <button
            onClick={handleFollow}
            disabled={followBusy}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all ${
              following
                ? 'border border-neutral-600 bg-neutral-800 text-white'
                : 'bg-neon text-neutral-950 neon-glow'
            }`}
          >
            {following ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 px-5">
        <button
          onClick={() => setActiveTab('tracks')}
          className={`relative flex items-center gap-1.5 pb-3 pr-5 text-sm font-semibold transition-colors ${
            activeTab === 'tracks' ? 'text-white' : 'text-white/40'
          }`}
        >
          <Music2 className="h-4 w-4" /> Full Tracks
          {activeTab === 'tracks' && (
            <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-neon" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('shorts')}
          className={`relative flex items-center gap-1.5 pb-3 px-5 text-sm font-semibold transition-colors ${
            activeTab === 'shorts' ? 'text-white' : 'text-white/40'
          }`}
        >
          <Zap className="h-4 w-4" /> Shorts
          {activeTab === 'shorts' && (
            <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-neon" />
          )}
        </button>
      </div>

      {/* Video grid */}
      {gridPosts.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="mb-3 rounded-full bg-white/5 p-5">
            {activeTab === 'shorts' ? (
              <Zap className="h-7 w-7 text-white/40" />
            ) : (
              <Music2 className="h-7 w-7 text-white/40" />
            )}
          </div>
          <p className="text-sm font-semibold text-white/60">
            {activeTab === 'shorts' ? 'No shorts yet' : 'No full tracks yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 pt-0.5">
          {gridPosts.map((post) => (
            <button
              key={post.id}
              onClick={() => onPlayTrack(post.id, post)}
              className="group relative aspect-[9/14] overflow-hidden bg-neutral-900"
            >
              <video
                src={post.videoUrl}
                playsInline
                muted
                loop
                preload="metadata"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                style={{ filter: getFilterCss(post.overlayFilter) }}
              />
              {post.overlayText && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-2">
                  <p className="text-center text-[10px] font-black text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] uppercase tracking-wide leading-tight">
                    {post.overlayText}
                  </p>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute left-1.5 top-1.5 rounded-full bg-black/50 p-1 backdrop-blur-sm">
                <Play className="h-3 w-3 fill-white text-white" />
              </div>
              <div className="absolute bottom-1.5 left-1.5 right-1.5">
                <p className="truncate text-[10px] font-bold text-white drop-shadow">
                  {post.trackTitle}
                </p>
                <div className="flex items-center gap-1 text-[9px] text-white/80">
                  <Heart className="h-2.5 w-2.5 fill-neon text-neon" />
                  {formatCount(post.likes)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
