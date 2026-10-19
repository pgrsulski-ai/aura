import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useDailyBonus } from '@/hooks/useDailyBonus';
import { usePersistentState } from '@/hooks';
import { DEFAULT_SETTINGS, DEFAULT_USER } from '@/data';
import {
  fetchPosts,
  fetchFollowingUserIds,
  toggleLike,
  toggleSave,
  toggleFollow,
  deletePost,
  updatePost,
  boostPost,
  sendSuperLike,
  postCommentWithReward,
  checkLikesMilestone,
  adminDeletePost,
  adminDeleteComment,
  type ProfileRow,
  type UploadRewardResult,
} from '@/postsApi';
import type { CurrentUser, FeedTab, Post, Settings, TabKey, VideoTypeFilter } from '@/types';

import { BottomNav } from '@/components/BottomNav';
import { VideoFeed } from '@/components/VideoFeed';
import { SearchScreen } from '@/components/SearchScreen';
import { ProfileScreen } from '@/components/ProfileScreen';
import { CreatorProfileScreen } from '@/components/CreatorProfileScreen';
import { AuthScreen } from '@/components/AuthScreen';
import { AuraStudioModal } from '@/components/AuraStudioModal';
import { CommentsModal } from '@/components/CommentsModal';
import { SettingsModal } from '@/components/SettingsModal';
import { EditProfileModal } from '@/components/EditProfileModal';
import { EditTrackModal } from '@/components/EditTrackModal';
import { Zap, MessageCircle, Star, Flag } from 'lucide-react';

interface FollowingCounts {
  [userId: string]: boolean;
}

export function HomePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, refresh: refreshProfileHook } = useProfile();
  const { lastResult: dailyBonusResult } = useDailyBonus(user?.id);
  const [rewardToast, setRewardToast] = useState<{ icon: 'zap' | 'comment' | 'star' | 'flag'; message: string; highlight: string } | null>(null);

  const showRewardToast = useCallback((icon: 'zap' | 'comment' | 'star' | 'flag', message: string, highlight: string) => {
    setRewardToast({ icon, message, highlight });
    const t = setTimeout(() => setRewardToast(null), 4000);
    return () => clearTimeout(t);
  }, []);

  // When a daily bonus is claimed, refresh the profile balance and show a toast.
  useEffect(() => {
    if (!dailyBonusResult) return;
    if (dailyBonusResult.claimed) {
      void refreshProfileHook();
      showRewardToast('zap', 'Daily bonus claimed!', '+5 Aura Coins');
    }
  }, [dailyBonusResult, refreshProfileHook, showRewardToast]);

  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [feedTab, setFeedTab] = useState<FeedTab>('discover');
  const [videoTypeFilter, setVideoTypeFilter] = useState<VideoTypeFilter>('short');
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [following, setFollowing] = useState<FollowingCounts>({});
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [creatorId, setCreatorId] = useState<string | null>(null);

  const [settings, setSettings] = usePersistentState<Settings>('aura-settings', DEFAULT_SETTINGS);

  const [studioOpen, setStudioOpen] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editTrackPost, setEditTrackPost] = useState<Post | null>(null);
  const [optimisticCoinOffset, setOptimisticCoinOffset] = useState(0);

  const currentUser: CurrentUser = useMemo(() => {
    const adminEmails = ['pgrsulski@gmail.com', 'sulskipgr@gmail.com'];
    const isAdminEmail = adminEmails.includes(user?.email ?? '');
    if (!profile) {
      return { ...DEFAULT_USER, email: user?.email, role: isAdminEmail ? 'admin' as const : 'user' as const };
    }
    return {
      handle: profile.handle,
      bio: profile.bio ?? '',
      avatar: profile.handle.charAt(0).toUpperCase(),
      avatarUrl: profile.avatar_url ?? undefined,
      email: user?.email,
      walletBalance: (profile?.wallet_balance ?? 0) + optimisticCoinOffset,
      role: (profile?.role === 'admin' || isAdminEmail) ? 'admin' : 'user',
    };
  }, [profile, user, optimisticCoinOffset]);

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const fetched = await fetchPosts(user?.id, videoTypeFilter);
      setPosts(fetched);
    } catch (e) {
      console.error('[HomePage] loadPosts failed:', e);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, [user?.id, videoTypeFilter]);

  useEffect(() => {
    if (authLoading) return;
    loadPosts();
  }, [authLoading, loadPosts]);

  useEffect(() => {
    if (!user) return;
    fetchFollowingUserIds(user.id).then((set) => {
      const map: FollowingCounts = {};
      set.forEach((id) => { map[id] = true; });
      setFollowing(map);
    });
    supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('followee_id', user.id)
      .then(({ count }) => setFollowersCount(count ?? 0));
    supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', user.id)
      .then(({ count }) => setFollowingCount(count ?? 0));
  }, [user]);

  const handleToggleLike = useCallback(async (postId: string) => {
    const wasLiked = posts.find((p) => p.id === postId)?.isLiked ?? false;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const next = !p.isLiked;
        return {
          ...p,
          isLiked: next,
          likesCount: next ? p.likesCount + 1 : Math.max(0, p.likesCount - 1),
        };
      })
    );
    const post = posts.find((p) => p.id === postId);
    if (post) {
      try {
        await toggleLike(postId, post.isLiked);
        // If we just liked (not unliking), check if this triggered the 10-likes milestone.
        if (!wasLiked) {
          const awarded = await checkLikesMilestone(postId);
          if (awarded) {
            void refreshProfileHook();
            showRewardToast('star', 'Your track reached 10 likes!', '+10 Aura Coins');
          }
        }
      } catch (e) {
        console.error('[HomePage] toggleLike failed:', e);
      }
    }
  }, [posts, refreshProfileHook, showRewardToast]);

  const handleToggleSave = useCallback(async (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, isSaved: !p.isSaved } : p))
    );
    const post = posts.find((p) => p.id === postId);
    if (post) {
      try {
        await toggleSave(postId, post.isSaved);
      } catch (e) {
        console.error('[HomePage] toggleSave failed:', e);
      }
    }
  }, [posts]);

  const handleToggleFollow = useCallback((postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId || !p.userId) return p;
        const next = !p.isFollowing;
        return { ...p, isFollowing: next };
      })
    );
    const post = posts.find((p) => p.id === postId);
    if (post?.userId) {
      toggleFollow(post.userId, post.isFollowing).catch((e) =>
        console.error('[HomePage] toggleFollow failed:', e)
      );
    }
  }, [posts]);

  const handleDelete = useCallback(async (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await deletePost(postId);
      showRewardToast('flag', 'Track deleted successfully.', '');
    } catch (e) {
      console.error('[HomePage] deletePost failed:', e);
      loadPosts();
    }
  }, [loadPosts, showRewardToast]);

  const handleEditSave = useCallback(async (postId: string, trackTitle: string, caption: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, trackTitle, caption } : p))
    );
    setEditTrackPost(null);
    try {
      await updatePost(postId, trackTitle, caption);
    } catch (e) {
      console.error('[HomePage] updatePost failed:', e);
    }
  }, []);

  const handleBoost = useCallback(async (postId: string) => {
    setOptimisticCoinOffset((o) => o - 100);
    try {
      const result = await boostPost(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, boostMultiplier: result.newBoostMultiplier } : p
        )
      );
      setOptimisticCoinOffset(0);
      void refreshProfileHook();
    } catch (e) {
      console.error('[HomePage] boostPost failed:', e);
      setOptimisticCoinOffset(0);
      void refreshProfileHook();
      if (e instanceof Error && e.message.toLowerCase().includes('insufficient')) {
        navigate('/shop');
      }
    }
  }, [navigate, refreshProfileHook]);

  const handleSuperLike = useCallback(async (postId: string): Promise<boolean> => {
    setOptimisticCoinOffset((o) => o - 10);
    try {
      const result = await sendSuperLike(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, superlikesCount: result.superlikesCount || p.superlikesCount + 1, boostScore: p.boostScore + 15 }
            : p
        )
      );
      setOptimisticCoinOffset(0);
      void refreshProfileHook();
      return true;
    } catch (e) {
      console.error('[HomePage] sendSuperLike failed:', e);
      setOptimisticCoinOffset(0);
      void refreshProfileHook();
      const msg = e instanceof Error ? e.message : 'Could not send SuperLike';
      alert(`SuperLike failed: ${msg}`);
      if (msg.toLowerCase().includes('insufficient')) {
        navigate('/shop');
      }
      return false;
    }
  }, [navigate, refreshProfileHook]);

  const handleViewIncrement = useCallback((postId: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, views: p.views + 1 } : p))
    );
  }, []);

  const handleReport = useCallback((postId: string, hidden: boolean, alreadyReported: boolean) => {
    if (hidden) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
    if (alreadyReported) {
      showRewardToast('flag', 'You have already reported this track.', '');
    } else {
      showRewardToast('flag', 'Report submitted successfully.', '');
    }
  }, [showRewardToast]);

  const isAdmin = currentUser.role === 'admin';

  const handleAdminDelete = useCallback(async (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await adminDeletePost(postId);
      showRewardToast('flag', 'Post deleted by Admin.', '');
    } catch (e) {
      console.error('[HomePage] adminDeletePost failed:', e);
      loadPosts();
    }
  }, [showRewardToast, loadPosts]);

  const handleAdminHide = useCallback(async (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      const { error } = await supabase
        .from('posts')
        .update({ is_hidden: true })
        .eq('id', postId);
      if (error) throw error;
      showRewardToast('flag', 'Video hidden by Admin.', '');
    } catch (e) {
      console.error('[HomePage] adminHidePost failed:', e);
      loadPosts();
    }
  }, [showRewardToast, loadPosts]);

  const handleAdminDeleteComment = useCallback(async (commentId: string) => {
    try {
      await adminDeleteComment(commentId);
    } catch (e) {
      console.error('[HomePage] adminDeleteComment failed:', e);
    }
  }, []);

  const handlePlayTrack = useCallback((postId: string, _post?: Post) => {
    const idx = posts.findIndex((p) => p.id === postId);
    if (idx >= 0) {
      setActiveIndex(idx);
      setActiveTab('home');
      setFeedTab('discover');
    }
  }, [posts]);

  const handleViewCreator = useCallback((id: string) => {
    setCreatorId(id);
  }, []);

  const handleCreatorBack = useCallback(() => {
    setCreatorId(null);
  }, []);

  const handleCreatorFollowChange = useCallback((id: string, isFollowing: boolean) => {
    setFollowing((prev) => ({ ...prev, [id]: isFollowing }));
    setPosts((prev) =>
      prev.map((p) => (p.userId === id ? { ...p, isFollowing } : p))
    );
  }, []);

  const handleEditProfileSave = useCallback((updated: CurrentUser) => {
    setEditProfileOpen(false);
    void refreshProfileHook();
    void updated;
  }, [refreshProfileHook]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSettingsOpen(false);
  }, []);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthed={() => {}} />;
  }

  const commentsPost = commentsPostId
    ? posts.find((p) => p.id === commentsPostId) ?? null
    : null;

  return (
    <div className="fixed inset-0 bg-neutral-950 text-white">
      {/* Main view area */}
      <div className="absolute inset-0 bottom-[88px]">
        {creatorId ? (
          <CreatorProfileScreen
            creatorId={creatorId}
            currentUserId={user.id}
            isFollowing={!!following[creatorId]}
            onBack={handleCreatorBack}
            onPlayTrack={handlePlayTrack}
            onFollowChange={handleCreatorFollowChange}
          />
        ) : activeTab === 'home' ? (
          loadingPosts ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon border-t-transparent" />
            </div>
          ) : (
            <VideoFeed
              posts={posts}
              activeIndex={activeIndex}
              feedTab={feedTab}
              videoTypeFilter={videoTypeFilter}
              onVideoTypeFilterChange={setVideoTypeFilter}
              onTabChange={setFeedTab}
              onActiveIndexChange={setActiveIndex}
              onToggleFollow={handleToggleFollow}
              onToggleLike={handleToggleLike}
              onToggleSave={handleToggleSave}
              onOpenComments={(id) => setCommentsPostId(id)}
              onOpenStudio={() => setStudioOpen(true)}
              onDelete={handleDelete}
              onEdit={(id) => {
                const p = posts.find((pp) => pp.id === id);
                if (p) setEditTrackPost(p);
              }}
              onBoost={handleBoost}
              onSuperLike={handleSuperLike}
              coinBalance={(profile?.wallet_balance ?? 0) + optimisticCoinOffset}
              onOpenShop={() => navigate('/shop')}
              onViewIncrement={handleViewIncrement}
              onReport={handleReport}
              isAdmin={isAdmin}
              onAdminDelete={handleAdminDelete}
              onAdminHide={handleAdminHide}
            />
          )
        ) : activeTab === 'search' ? (
          <SearchScreen
            posts={posts}
            onPlayTrack={handlePlayTrack}
            onViewCreator={handleViewCreator}
            currentUserId={user.id}
          />
        ) : (
          <ProfileScreen
            user={currentUser}
            userId={user.id}
            followingCount={followingCount}
            followersCount={followersCount}
            onEditProfile={() => setEditProfileOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onPlayTrack={handlePlayTrack}
            onDelete={handleDelete}
            onEdit={(id) => {
              const p = posts.find((pp) => pp.id === id);
              if (p) setEditTrackPost(p);
            }}
            onSignOut={handleSignOut}
          />
        )}
      </div>

      {/* Bottom navigation - always visible so user can leave shop anytime */}
      {!creatorId && (
        <BottomNav
          active={activeTab}
          onChange={(tab) => {
            setActiveTab(tab);
            setCreatorId(null);
          }}
          onCreate={() => setStudioOpen(true)}
          onOpenShop={() => navigate('/shop')}
          isAuthed={!!user}
        />
      )}

      {/* Modals */}
      {studioOpen && (
        <AuraStudioModal
          currentUserHandle={currentUser.handle}
          currentUserAvatar={currentUser.avatar}
          onPublish={(newPost: Post, uploadReward?: UploadRewardResult | null) => {
            setPosts((prev) => [newPost, ...prev]);
            setStudioOpen(false);
            setActiveTab('home');
            setActiveIndex(0);
            if (uploadReward?.awarded) {
              void refreshProfileHook();
              showRewardToast('zap', 'Track published!', '+5 Aura Coins');
            }
          }}
          onClose={() => setStudioOpen(false)}
        />
      )}

      {commentsPost && (
        <CommentsModal
          post={commentsPost}
          currentUserHandle={currentUser.handle}
          currentUserAvatar={currentUser.avatar}
          onClose={() => setCommentsPostId(null)}
          isAdmin={isAdmin}
          onAdminDeleteComment={handleAdminDeleteComment}
          onAddComment={async (postId: string, text: string) => {
            try {
              const result = await postCommentWithReward(postId, text);
              if (result.ok) {
                setPosts((prev) =>
                  prev.map((p) =>
                    p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p
                  )
                );
              }
              if (result.awarded) {
                void refreshProfileHook();
                showRewardToast('comment', 'Comment reward!', '+2 Aura Coins');
              }
            } catch (e) {
              console.error('[HomePage] postComment failed:', e);
            }
          }}
          onAddReply={() => {}}
          onLikeComment={() => {}}
          onLikeReply={() => {}}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
          onClearData={() => {
            setSettings(DEFAULT_SETTINGS);
            setSettingsOpen(false);
          }}
        />
      )}

      {editProfileOpen && (
        <EditProfileModal
          user={currentUser}
          userId={user.id}
          onSave={handleEditProfileSave}
          onClose={() => setEditProfileOpen(false)}
        />
      )}

      {editTrackPost && (
        <EditTrackModal
          post={editTrackPost}
          onClose={() => setEditTrackPost(null)}
          onSave={handleEditSave}
        />
      )}

      {rewardToast && (
        <div className="fixed top-6 left-1/2 z-[100] -translate-x-1/2 animate-fade-in">
          <div className="flex items-center gap-2.5 rounded-xl border border-neon/40 bg-neutral-900 px-4 py-3 shadow-2xl shadow-neon/20">
            {rewardToast.icon === 'zap' && <Zap className="h-5 w-5 shrink-0 fill-neon text-neon" />}
            {rewardToast.icon === 'comment' && <MessageCircle className="h-5 w-5 shrink-0 text-neon" />}
            {rewardToast.icon === 'star' && <Star className="h-5 w-5 shrink-0 fill-amber-400 text-amber-400" />}
            {rewardToast.icon === 'flag' && <Flag className="h-5 w-5 shrink-0 text-neon" />}
            <p className="text-sm font-bold text-white">
              {rewardToast.message} <span className="text-neon">{rewardToast.highlight}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
