import { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Heart, Music2, Play, Pencil, Bookmark, Trash2, Pencil as EditIcon, LogOut, Mail, Coins, Zap, Plus, Shield } from 'lucide-react';
import type { CurrentUser, Post } from '@/types';
import { formatCount } from '@/hooks';
import { getFilterCss } from '@/filters';
import { fetchSavedPosts, fetchPostsByUserId } from '@/postsApi';
import { CoinStoreModal } from '@/components/CoinStoreModal';
import { AdminPanel } from '@/components/AdminPanel';

interface ProfileScreenProps {
  user: CurrentUser;
  userId?: string;
  followingCount: number;
  followersCount: number;
  onEditProfile: () => void;
  onOpenSettings: () => void;
  onPlayTrack: (postId: string, post: Post) => void;
  onDelete: (postId: string) => void;
  onEdit: (postId: string) => void;
  onSignOut: () => void;
}

export function ProfileScreen({
  user,
  userId,
  followingCount,
  followersCount,
  onEditProfile,
  onOpenSettings,
  onPlayTrack,
  onDelete,
  onEdit,
  onSignOut,
}: ProfileScreenProps) {
  const [ownPosts, setOwnPosts] = useState<Post[]>([]);
  const [loadingOwn, setLoadingOwn] = useState(true);
  const [activeTab, setActiveTab] = useState<'shorts' | 'tracks' | 'saved' | 'admin'>('shorts');

  const isAdmin = user.role === 'admin';

  const loadOwnPosts = useCallback(async () => {
    if (!userId) return;
    setLoadingOwn(true);
    try {
      const userPosts = await fetchPostsByUserId(userId, userId);
      setOwnPosts(userPosts);
    } catch (e) {
      console.error('Failed to load own posts:', e);
      setOwnPosts([]);
    } finally {
      setLoadingOwn(false);
    }
  }, [userId]);

  useEffect(() => {
    loadOwnPosts();
  }, [loadOwnPosts]);

  const ownShorts = ownPosts.filter((p) => p.videoType === 'short');
  const ownTracks = ownPosts.filter((p) => p.videoType === 'track');

  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [storeOpen, setStoreOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(user.walletBalance ?? 0);
  const [deleteConfirmPost, setDeleteConfirmPost] = useState<Post | null>(null);

  const loadSavedPosts = useCallback(async () => {
    if (!userId) return;
    setLoadingSaved(true);
    setSavedError(null);
    try {
      const saved = await fetchSavedPosts(userId);
      setSavedPosts(saved);
    } catch (e) {
      console.error('Failed to load saved posts:', e);
      setSavedError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingSaved(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSavedPosts();
  }, [loadSavedPosts]);

  const allSavedPosts = savedPosts;

  const gridPosts = activeTab === 'shorts' ? ownShorts : activeTab === 'tracks' ? ownTracks : allSavedPosts;

  return (
    <div className="no-scrollbar h-full overflow-y-auto bg-neutral-950 pb-32">
      {/* Header bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between bg-neutral-950/80 px-5 py-3 backdrop-blur-lg">
        <h1 className="font-display text-lg font-bold text-white">Profile</h1>
        <button
          onClick={onOpenSettings}
          className="rounded-full bg-white/8 p-2 text-white/70 transition-colors hover:text-neon"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Profile header */}
      <div className="px-5 pt-2 pb-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-neon to-emerald-700 p-[2px]">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.handle}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-neutral-900 text-2xl font-bold text-white">
                {user.avatar}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <h2 className="font-display text-xl font-bold text-white">{user.handle}</h2>
            {user.email && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-white/40">
                <Mail className="h-3 w-3" /> {user.email}
              </p>
            )}
            <p className="mt-1 text-sm text-white/60 line-clamp-2">{user.bio}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 flex items-center justify-around rounded-2xl bg-white/5 py-4">
          <div className="flex flex-col items-center">
            <span className="font-display text-lg font-bold text-white">{ownPosts.length}</span>
            <span className="text-[11px] text-white/50">Posts</span>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="font-display text-lg font-bold text-white">{formatCount(followersCount)}</span>
            <span className="text-[11px] text-white/50">Followers</span>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="font-display text-lg font-bold text-neon">{followingCount}</span>
            <span className="text-[11px] text-white/50">Following</span>
          </div>
        </div>

        {/* Wallet balance */}
        <button
          onClick={() => setStoreOpen(true)}
          className="group mt-4 flex w-full items-center gap-3 rounded-2xl border border-neon/20 bg-gradient-to-r from-neon/10 to-emerald-900/20 px-4 py-3 text-left transition-all hover:border-neon/50 hover:from-neon/15"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neon/20">
            <Coins className="h-5 w-5 text-neon" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Aura Wallet</p>
            <p className="font-display text-lg font-bold text-neon">{walletBalance.toLocaleString()} coins</p>
          </div>
          <span className="flex items-center gap-1 rounded-lg bg-neon px-3 py-1.5 text-xs font-bold text-black transition-transform group-hover:scale-105">
            <Plus className="h-3.5 w-3.5" /> Store
          </span>
        </button>

        {/* Edit profile + Logout */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={onEditProfile}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white transition-colors hover:border-neon/40 hover:text-neon"
          >
            <Pencil className="h-4 w-4" /> Edit Profile
          </button>
          <button
            onClick={onSignOut}
            className="flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/15"
          >
            <LogOut className="h-4 w-4" /> Log Out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 px-5">
        <button
          onClick={() => setActiveTab('shorts')}
          className={`relative flex items-center gap-1.5 pb-3 pr-5 text-sm font-semibold transition-colors ${
            activeTab === 'shorts' ? 'text-white' : 'text-white/40'
          }`}
        >
          <Zap className="h-4 w-4" /> Shorts
          {activeTab === 'shorts' && (
            <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-neon" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('tracks')}
          className={`relative flex items-center gap-1.5 pb-3 px-5 text-sm font-semibold transition-colors ${
            activeTab === 'tracks' ? 'text-white' : 'text-white/40'
          }`}
        >
          <Music2 className="h-4 w-4" /> Tracks
          {activeTab === 'tracks' && (
            <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-neon" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`relative flex items-center gap-1.5 pb-3 px-6 text-sm font-semibold transition-colors ${
            activeTab === 'saved' ? 'text-white' : 'text-white/40'
          }`}
        >
          <Bookmark className="h-4 w-4" /> Saved
          {activeTab === 'saved' && (
            <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-neon" />
          )}
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`relative flex items-center gap-1.5 pb-3 px-5 text-sm font-semibold transition-colors ${
              activeTab === 'admin' ? 'text-red-400' : 'text-white/40'
            }`}
          >
            <Shield className="h-4 w-4" /> Moderation
            {activeTab === 'admin' && (
              <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-red-400" />
            )}
          </button>
        )}
      </div>

      {/* Video grid */}
      {savedError && activeTab === 'saved' ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="mb-3 rounded-full bg-red-500/10 p-5">
            <Bookmark className="h-7 w-7 text-red-400" />
          </div>
          <p className="text-sm font-semibold text-red-400">Failed to load</p>
          <p className="mt-1 max-w-xs text-xs text-white/40">{savedError}</p>
          <button
            onClick={loadSavedPosts}
            className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
          >
            Retry
          </button>
        </div>
      ) : activeTab === 'admin' && isAdmin ? (
        <AdminPanel />
      ) : loadingSaved && activeTab === 'saved' && allSavedPosts.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon border-t-transparent" />
          <p className="mt-3 text-xs text-white/40">Loading...</p>
        </div>
      ) : loadingOwn && activeTab !== 'saved' && activeTab !== 'admin' ? (
        <div className="flex flex-col items-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon border-t-transparent" />
          <p className="mt-3 text-xs text-white/40">Loading...</p>
        </div>
      ) : activeTab !== 'admin' && gridPosts.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="mb-3 rounded-full bg-white/5 p-5">
            {activeTab === 'saved' ? (
              <Bookmark className="h-7 w-7 text-white/40" />
            ) : activeTab === 'shorts' ? (
              <Zap className="h-7 w-7 text-white/40" />
            ) : (
              <Music2 className="h-7 w-7 text-white/40" />
            )}
          </div>
          <p className="text-sm font-semibold text-white/60">
            {activeTab === 'saved'
              ? 'No saved tracks yet'
              : activeTab === 'shorts'
              ? 'No shorts yet'
              : 'No full tracks yet'}
          </p>
          <p className="mt-1 text-xs text-white/40">
            {activeTab === 'saved'
              ? 'Tap the bookmark icon on tracks to save them here.'
              : 'Drop your first track with AURA STUDIO.'}
          </p>
        </div>
      ) : activeTab !== 'admin' ? (
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
              {post.isOwn && (
                <div className="absolute right-1.5 top-1.5 flex flex-col gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(post.id); }}
                    className="rounded-full bg-black/60 p-1.5 backdrop-blur-sm transition-colors hover:bg-blue-500/80"
                    aria-label="Edit track"
                  >
                    <EditIcon className="h-3 w-3 text-white" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmPost(post); }}
                    className="rounded-full bg-black/60 p-1.5 backdrop-blur-sm transition-colors hover:bg-red-500/80"
                    aria-label="Delete track"
                  >
                    <Trash2 className="h-3 w-3 text-white" />
                  </button>
                </div>
              )}
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
      ) : null}

      <CoinStoreModal
        open={storeOpen}
        onClose={() => setStoreOpen(false)}
        userId={userId ?? ''}
        currentBalance={walletBalance}
        onPurchased={(newBalance) => setWalletBalance(newBalance)}
      />

      {/* Delete confirmation dialog */}
      {deleteConfirmPost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={() => setDeleteConfirmPost(null)} />
          <div className="relative mx-4 w-[min(24rem,calc(100%-2rem))] rounded-2xl border border-red-500/30 bg-neutral-900 p-5 shadow-2xl animate-fade-in">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="font-display text-base font-bold text-white">Delete Track</h3>
            </div>
            <p className="text-sm text-white/60">
              Are you sure you want to delete this track? This action cannot be undone.
            </p>
            {deleteConfirmPost.trackTitle && (
              <p className="mt-2 truncate rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50">
                {deleteConfirmPost.trackTitle}
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setDeleteConfirmPost(null)}
                className="flex-1 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const id = deleteConfirmPost.id;
                  setDeleteConfirmPost(null);
                  onDelete(id);
                }}
                className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-bold text-white transition-colors hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
