import { supabase } from '@/supabaseClient';
import type { Post, VideoFilter } from '@/types';

interface PostRowBase {
  id: string;
  user_id: string;
  media_url: string;
  track_title: string;
  caption: string | null;
  genre: string | null;
  ai_prompt: string | null;
  ai_engine: string | null;
  overlay_text: string | null;
  overlay_filter: string | null;
  likes: number;
  views: number;
  boost_multiplier: number;
  boost_score: number | null;
  superlikes_count: number | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
  video_type: string;
  is_external: boolean | null;
  created_at: string;
  bpm: number | null;
  is_hidden: boolean | null;
  reports_count: number | null;
}

interface ProfileInfo {
  id: string;
  handle: string;
  bio: string;
  avatar_url: string | null;
}

function rowToPostWithProfile(
  row: PostRowBase,
  profileMap: Map<string, ProfileInfo>,
  currentUserId?: string,
  likedPostIds: Set<string> = new Set(),
  followingUserIds: Set<string> = new Set(),
  savedPostIds: Set<string> = new Set()
): Post {
  const profile = profileMap.get(row.user_id);
  return {
    id: row.id,
    videoUrl: row.media_url,
    trackTitle: row.track_title,
    artistHandle: profile?.handle ?? 'unknown',
    artistAvatar: (profile?.handle ?? '?').charAt(0).toUpperCase(),
    artistBio: profile?.bio ?? '',
    caption: row.caption ?? '',
    genre: row.genre ?? '',
    bpm: row.bpm ?? null,
    aiPrompt: row.ai_prompt ?? '',
    aiEngine: row.ai_engine ?? '',
    durationLabel: '',
    likes: row.likes ?? 0,
    views: row.views ?? 0,
    boostMultiplier: row.boost_multiplier ?? 1,
    boostScore: Number(row.boost_score ?? 0),
    superlikesCount: row.superlikes_count ?? 0,
    likesCount: row.likes_count ?? 0,
    commentsCount: row.comments_count ?? 0,
    sharesCount: row.shares_count ?? 0,
    savesCount: row.saves_count ?? 0,
    isFollowing: followingUserIds.has(row.user_id),
    isLiked: likedPostIds.has(row.id),
    isSaved: savedPostIds.has(row.id),
    comments: [],
    createdAt: new Date(row.created_at).getTime(),
    isOwn: currentUserId ? row.user_id === currentUserId : false,
    videoType: (row.video_type === 'track' ? 'track' : 'short'),
    isExternal: Boolean(row.is_external),
    overlayText: row.overlay_text || undefined,
    overlayFilter: (row.overlay_filter as VideoFilter) || undefined,
    userId: row.user_id,
  };
}

export async function fetchPosts(
  currentUserId?: string,
  videoType?: 'short' | 'track'
): Promise<Post[]> {
  let query = supabase
    .from('posts')
    .select('*')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false });
  if (videoType) {
    query = query.eq('video_type', videoType);
  }
  const { data, error } = await query;

  if (error) throw error;

  const rows = (data as PostRowBase[]).map((r) => ({ ...r, boost_multiplier: r.boost_multiplier ?? 1 }));

  // Collect unique user IDs and fetch their profiles in one query
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const profileMap = await fetchProfilesBatch(userIds);

  // Fetch the current user's likes, follows, and saves in parallel
  const [likedPostIds, followingUserIds, savedPostIds] = await Promise.all([
    fetchLikedPostIds(currentUserId),
    fetchFollowingUserIds(currentUserId),
    fetchSavedPostIds(currentUserId),
  ]);

  return rows
    .map((r) =>
      rowToPostWithProfile(r, profileMap, currentUserId, likedPostIds, followingUserIds, savedPostIds)
    )
    .sort((a, b) => {
      const scoreA =
        (a.views * 1) +
        (a.likesCount * 5) +
        (a.commentsCount * 15) +
        (a.savesCount * 20) +
        (a.sharesCount * 30);
      const scoreB =
        (b.views * 1) +
        (b.likesCount * 5) +
        (b.commentsCount * 15) +
        (b.savesCount * 20) +
        (b.sharesCount * 30);
      const finalA = scoreA * (a.boostMultiplier || 1) + (a.boostScore || 0);
      const finalB = scoreB * (b.boostMultiplier || 1) + (b.boostScore || 0);
      if (finalB !== finalA) return finalB - finalA;
      return b.createdAt - a.createdAt;
    });
}

interface LikedJoinRow {
  post_id: string;
  posts: PostRowBase | null;
}

export async function fetchLikedPosts(currentUserId?: string): Promise<Post[]> {
  if (!currentUserId) return [];

  const { data, error } = await supabase
    .from('likes')
    .select('post_id, posts(*)')
    .eq('user_id', currentUserId)
    .order('created_at', { ascending: false });

  console.log('RAW LIKED DATA:', data);

  if (error) {
    console.error('[fetchLikedPosts] query error:', error);
    alert(`Failed to load liked posts: ${error.message}`);
    return [];
  }

  if (!data || data.length === 0) return [];

  const joinRows = data as unknown as LikedJoinRow[];

  // Extract the nested posts objects and filter out nulls
  const rows: PostRowBase[] = joinRows
    .map((r) => r.posts)
    .filter((p): p is PostRowBase => p != null);

  if (rows.length === 0) return [];

  // Fetch profiles for the post authors
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const profileMap = await fetchProfilesBatch(userIds);
  const likedSet = new Set(rows.map((r) => r.id));

  return rows.map((r) =>
    rowToPostWithProfile(r, profileMap, currentUserId, likedSet, new Set())
  );
}

export async function fetchFollowingPosts(currentUserId?: string): Promise<Post[]> {
  if (!currentUserId) return [];
  const { data: followRows, error } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', currentUserId);
  if (error) {
    console.error('[fetchFollowingPosts] error fetching follows:', error);
    return [];
  }
  const followedUserIds = (followRows as { followee_id: string }[]).map((r) => r.followee_id);
  if (followedUserIds.length === 0) return [];

  const { data: postRows, error: postErr } = await supabase
    .from('posts')
    .select('*')
    .eq('is_hidden', false)
    .in('user_id', followedUserIds)
    .order('created_at', { ascending: false });
  if (postErr) {
    console.error('[fetchFollowingPosts] error fetching posts:', postErr);
    return [];
  }

  const rows = postRows as PostRowBase[];
  const profileMap = await fetchProfilesBatch(followedUserIds);
  const followingSet = new Set(followedUserIds);
  const likedPostIds = await fetchLikedPostIds(currentUserId);

  return rows.map((r) =>
    rowToPostWithProfile(r, profileMap, currentUserId, likedPostIds, followingSet)
  );
}

// ── Saved Posts ───────────────────────────────────────────

export async function fetchSavedPostIds(userId?: string): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('saved_posts')
    .select('post_id')
    .eq('user_id', userId);
  if (error) {
    console.error('[fetchSavedPostIds] error:', error);
    return new Set();
  }
  return new Set((data as { post_id: string }[]).map((r) => r.post_id));
}

export async function toggleSave(
  postId: string,
  isSaved: boolean
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  if (isSaved) {
    const { error } = await supabase
      .from('saved_posts')
      .delete()
      .match({ post_id: postId, user_id: user.id });
    if (error) {
      console.error('[toggleSave] delete error:', error);
      alert(`Failed to unsave: ${error.message}`);
      throw error;
    }
  } else {
    const { error } = await supabase
      .from('saved_posts')
      .insert({ post_id: postId, user_id: user.id });
    if (error) {
      console.error('[toggleSave] insert error:', error);
      alert(`Failed to save: ${error.message}`);
      throw error;
    }
  }
}

export async function fetchSavedPosts(currentUserId?: string): Promise<Post[]> {
  if (!currentUserId) return [];

  // Step 1: Get only the IDs of the saved posts
  const { data: savedData, error: savedError } = await supabase
    .from('saved_posts')
    .select('post_id')
    .eq('user_id', currentUserId);

  if (savedError) {
    console.error('[fetchSavedPosts] error fetching saved IDs:', savedError);
    return [];
  }

  if (!savedData || savedData.length === 0) return [];

  // Step 2: Extract IDs and fetch the actual posts
  const postIds = (savedData as { post_id: string }[]).map((r) => r.post_id);

  const { data: postsData, error: postsError } = await supabase
    .from('posts')
    .select('*')
    .eq('is_hidden', false)
    .in('id', postIds)
    .order('created_at', { ascending: false });

  if (postsError) {
    console.error('[fetchSavedPosts] error fetching posts:', postsError);
    return [];
  }

  if (!postsData || postsData.length === 0) return [];

  const rows = postsData as PostRowBase[];

  // Fetch profiles for the post authors
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const profileMap = await fetchProfilesBatch(userIds);
  const savedSet = new Set(rows.map((r) => r.id));
  const likedPostIds = await fetchLikedPostIds(currentUserId);

  return rows.map((r) =>
    rowToPostWithProfile(r, profileMap, currentUserId, likedPostIds, new Set(), savedSet)
  );
}

// ── Likes ──────────────────────────────────────────────────

export async function fetchLikedPostIds(userId?: string): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', userId);
  if (error) {
    console.error('[fetchLikedPostIds] error:', error);
    return new Set();
  }
  return new Set((data as { post_id: string }[]).map((r) => r.post_id));
}

export async function toggleLike(
  postId: string,
  isLiked: boolean
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  if (isLiked) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .match({ post_id: postId, user_id: user.id });
    if (error) {
      console.error('[toggleLike] delete error:', error);
      alert(`Failed to unlike: ${error.message}`);
      throw error;
    }
  } else {
    const { error } = await supabase
      .from('likes')
      .insert({ post_id: postId, user_id: user.id });
    if (error) {
      console.error('[toggleLike] insert error:', error);
      alert(`Failed to like: ${error.message}`);
      throw error;
    }
  }
}

// ── Follows ────────────────────────────────────────────────

export async function fetchFollowingUserIds(
  userId?: string
): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', userId);
  if (error) {
    console.error('[fetchFollowingUserIds] error:', error);
    return new Set();
  }
  return new Set((data as { followee_id: string }[]).map((r) => r.followee_id));
}

export async function toggleFollow(
  targetUserId: string,
  isFollowing: boolean
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  if (isFollowing) {
    // Already following — unfollow
    const { error } = await supabase
      .from('follows')
      .delete()
      .match({ follower_id: user.id, followee_id: targetUserId });
    if (error) {
      console.error('[toggleFollow] delete error:', error);
      alert(`Failed to unfollow: ${error.message}`);
      throw error;
    }
  } else {
    // Not following — follow
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: user.id, followee_id: targetUserId });
    if (error) {
      console.error('[toggleFollow] insert error:', error);
      alert(`Failed to follow: ${error.message}`);
      throw error;
    }
  }
}

export async function fetchFollowCounts(
  userId: string
): Promise<{ followers: number; following: number }> {
  const [followersRes, followingRes] = await Promise.all([
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq(
      'followee_id',
      userId
    ),
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq(
      'follower_id',
      userId
    ),
  ]);
  return {
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
  };
}

// ── Profiles ───────────────────────────────────────────────

export interface ProfileRow {
  id: string;
  handle: string;
  bio: string;
  avatar_url: string | null;
  wallet_balance: number;
}

export async function fetchProfile(
  userId: string
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, handle, bio, avatar_url, wallet_balance')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('[fetchProfile] error:', error);
    return null;
  }
  return data as ProfileRow | null;
}

async function fetchProfilesBatch(
  userIds: string[]
): Promise<Map<string, ProfileInfo>> {
  const map = new Map<string, ProfileInfo>();
  if (userIds.length === 0) return map;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, handle, bio, avatar_url')
    .in('id', userIds);
  if (error) {
    console.error('[fetchProfilesBatch] error:', error);
    return map;
  }
  for (const row of data as ProfileInfo[]) {
    map.set(row.id, { id: row.id, handle: row.handle, bio: row.bio, avatar_url: row.avatar_url });
  }
  return map;
}

export async function ensureProfile(
  userId: string,
  handle: string,
  bio?: string
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .upsert(
      { id: userId, handle, bio: bio ?? '' },
      { onConflict: 'id' }
    );
  if (error) {
    console.error('[ensureProfile] error:', error);
    throw new Error(`Failed to save profile: ${error.message}`);
  }
}

export async function updateProfile(
  userId: string,
  handle: string,
  bio: string,
  avatarUrl?: string
): Promise<void> {
  const payload: Record<string, string> = { handle, bio };
  if (avatarUrl !== undefined) payload.avatar_url = avatarUrl;
  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId);
  if (error) throw error;
}

// ── Posts CRUD ─────────────────────────────────────────────

export interface CreatePostInput {
  mediaUrl: string;
  isExternal: boolean;
  trackTitle: string;
  caption: string;
  genre: string;
  aiPrompt: string;
  aiEngine: string;
  overlayText: string;
  overlayFilter: VideoFilter;
  videoType: 'short' | 'track';
  bpm: number | null;
}

export interface CreatePostResult {
  post: Post | null;
  uploadReward: UploadRewardResult | null;
}

export async function createPost(input: CreatePostInput): Promise<CreatePostResult> {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr) {
    console.error('[createPost] Auth error:', authErr);
    throw new Error(`Authentication check failed: ${authErr.message}`);
  }
  if (!authData.user) {
    console.error('[createPost] No authenticated user found');
    throw new Error('You must be logged in to publish a track.');
  }

  const insertPayload = {
    user_id: authData.user.id,
    media_url: input.mediaUrl,
    is_external: input.isExternal,
    track_title: input.trackTitle,
    caption: input.caption,
    genre: input.genre,
    ai_prompt: input.aiPrompt,
    ai_engine: input.aiEngine,
    overlay_text: input.overlayText,
    overlay_filter: input.overlayFilter,
    video_type: input.videoType,
    bpm: input.bpm,
  };

  const { data: insertedRow, error: insertError } = await supabase
    .from('posts')
    .insert(insertPayload)
    .select('*')
    .single();

  if (insertError) {
    console.error('[createPost] Database insert error:', insertError);
    throw new Error(`Database insert failed: ${insertError.message} (code: ${insertError.code})`);
  }

  const profileMap = await fetchProfilesBatch([authData.user.id]);
  const post = rowToPostWithProfile(
    insertedRow as PostRowBase,
    profileMap,
    authData.user.id
  );

  let uploadReward: UploadRewardResult | null = null;
  try {
    uploadReward = await claimUploadReward();
  } catch (e) {
    console.error('[createPost] upload reward failed:', e);
  }

  return { post, uploadReward };
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw error;
}

export async function updatePost(
  postId: string,
  trackTitle: string,
  caption: string
): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .update({ track_title: trackTitle, caption })
    .eq('id', postId);
  if (error) throw error;
}

export async function boostPost(
  postId: string
): Promise<{ newWalletBalance: number; newBoostMultiplier: number }> {
  const { data, error } = await supabase
    .rpc('boost_post', { p_post_id: postId });
  if (error) throw error;
  const row = (data as { new_wallet_balance: number; new_boost_multiplier: number }[])[0];
  if (!row) throw new Error('Boost failed');
  return {
    newWalletBalance: Number(row.new_wallet_balance),
    newBoostMultiplier: Number(row.new_boost_multiplier),
  };
}

export async function sendSuperLike(
  postId: string
): Promise<{ remainingCoins: number; superlikesCount: number }> {
  const { data, error } = await supabase
    .rpc('send_superlike', { target_post_id: postId });
  if (error) throw new Error(error.message);
  const result = data as { success: boolean; remaining_coins?: number; superlikes_count?: number; error?: string } | null;
  if (!result) throw new Error('SuperLike returned no response');
  if (!result.success) throw new Error(result.error ?? 'SuperLike failed');
  return { remainingCoins: Number(result.remaining_coins), superlikesCount: Number(result.superlikes_count ?? 0) };
}

// ── Search ─────────────────────────────────────────────────

// ── Content Reporting ──────────────────────────────────────

export interface ReportResult {
  ok: boolean;
  alreadyReported: boolean;
  hidden: boolean;
}

export async function submitReport(
  postId: string,
  reason: string,
  details?: string
): Promise<ReportResult> {
  const { data, error } = await supabase.rpc('submit_report', {
    p_post_id: postId,
    p_reason: reason,
    p_details: details ?? null,
  });
  if (error) throw new Error(error.message);
  const result = data as { ok: boolean; already_reported?: boolean; hidden?: boolean; error?: string } | null;
  if (!result || result.ok === false) {
    return { ok: false, alreadyReported: false, hidden: false };
  }
  return {
    ok: true,
    alreadyReported: Boolean(result.already_reported),
    hidden: Boolean(result.hidden),
  };
}

// ── Admin Moderation ───────────────────────────────────────

export async function adminDeletePost(postId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_delete_post', { p_post_id: postId });
  if (error) throw new Error(error.message);
  const result = data as { ok: boolean; error?: string } | null;
  return Boolean(result?.ok);
}

export async function adminDeleteComment(commentId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_delete_comment', { p_comment_id: commentId });
  if (error) throw new Error(error.message);
  const result = data as { ok: boolean; error?: string } | null;
  return Boolean(result?.ok);
}

export async function adminRestorePost(postId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_restore_post', { p_post_id: postId });
  if (error) throw new Error(error.message);
  const result = data as { ok: boolean; error?: string } | null;
  return Boolean(result?.ok);
}

export interface ReportedPost {
  post_id: string;
  track_title: string;
  caption: string | null;
  user_id: string;
  handle: string;
  media_url: string;
  reports_count: number;
  is_hidden: boolean;
  report_reasons: string[];
}

export async function fetchReportedPosts(): Promise<ReportedPost[]> {
  const { data, error } = await supabase.rpc('fetch_reported_posts');
  if (error) {
    console.error('[fetchReportedPosts] error:', error);
    return [];
  }
  return (data as ReportedPost[]) ?? [];
}

// ── Engagement Rewards ─────────────────────────────────────

export interface UploadRewardResult {
  awarded: boolean;
  amount: number;
}

export async function claimUploadReward(): Promise<UploadRewardResult> {
  const { data, error } = await supabase.rpc('claim_upload_reward');
  if (error) throw new Error(error.message);
  const result = data as { ok: boolean; awarded?: boolean; amount?: number; error?: string } | null;
  if (!result || result.ok === false) return { awarded: false, amount: 0 };
  return { awarded: Boolean(result.awarded), amount: Number(result.amount ?? 0) };
}

export interface CommentRewardResult {
  ok: boolean;
  commentId: string | null;
  awarded: boolean;
  amount: number;
}

export async function postCommentWithReward(
  postId: string,
  text: string
): Promise<CommentRewardResult> {
  const { data, error } = await supabase.rpc('post_comment', {
    p_post_id: postId,
    p_text: text,
  });
  if (error) throw new Error(error.message);
  const result = data as {
    ok: boolean;
    comment_id?: string;
    awarded?: boolean;
    amount?: number;
    error?: string;
  } | null;
  if (!result || result.ok === false) {
    return { ok: false, commentId: null, awarded: false, amount: 0 };
  }
  return {
    ok: true,
    commentId: result.comment_id ?? null,
    awarded: Boolean(result.awarded),
    amount: Number(result.amount ?? 0),
  };
}

export interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  likes: number;
  created_at: string;
}

export async function fetchComments(postId: string): Promise<CommentRow[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('id, post_id, user_id, text, likes, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[fetchComments] error:', error);
    return [];
  }
  return (data as CommentRow[]) ?? [];
}

export async function checkLikesMilestone(postId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_10_likes_milestone', {
    p_post_id: postId,
  });
  if (error) {
    console.error('[checkLikesMilestone] error:', error);
    return false;
  }
  const result = data as { ok: boolean; awarded?: boolean } | null;
  return Boolean(result?.awarded);
}

// ── Search ─────────────────────────────────────────────────

export interface CreatorResult {
  id: string;
  handle: string;
  bio: string;
  avatarUrl: string | null;
}

export async function searchProfiles(query: string): Promise<CreatorResult[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, handle, bio, avatar_url')
    .ilike('handle', `%${q}%`)
    .order('handle', { ascending: true })
    .limit(15);
  if (error) {
    console.error('[searchProfiles] error:', error);
    return [];
  }
  return (data as { id: string; handle: string; bio: string; avatar_url: string | null }[]).map((r) => ({
    id: r.id,
    handle: r.handle,
    bio: r.bio,
    avatarUrl: r.avatar_url,
  }));
}

export async function searchPosts(
  query: string,
  currentUserId?: string
): Promise<Post[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('is_hidden', false)
    .or(`track_title.ilike.%${q}%,caption.ilike.%${q}%,genre.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) {
    console.error('[searchPosts] error:', error);
    return [];
  }
  const rows = (data as PostRowBase[]).map((r) => ({
    ...r,
    boost_multiplier: r.boost_multiplier ?? 1,
  }));
  if (rows.length === 0) return [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const [profileMap, likedPostIds, followingUserIds, savedPostIds] =
    await Promise.all([
      fetchProfilesBatch(userIds),
      fetchLikedPostIds(currentUserId),
      fetchFollowingUserIds(currentUserId),
      fetchSavedPostIds(currentUserId),
    ]);
  return rows.map((r) =>
    rowToPostWithProfile(
      r,
      profileMap,
      currentUserId,
      likedPostIds,
      followingUserIds,
      savedPostIds
    )
  );
}

export async function fetchPostsByUserId(
  userId: string,
  currentUserId?: string
): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[fetchPostsByUserId] error:', error);
    return [];
  }
  const rows = (data as PostRowBase[]).map((r) => ({
    ...r,
    boost_multiplier: r.boost_multiplier ?? 1,
  }));
  if (rows.length === 0) return [];
  const profileMap = await fetchProfilesBatch([userId]);
  const [likedPostIds, followingUserIds, savedPostIds] = await Promise.all([
    fetchLikedPostIds(currentUserId),
    fetchFollowingUserIds(currentUserId),
    fetchSavedPostIds(currentUserId),
  ]);
  return rows.map((r) =>
    rowToPostWithProfile(
      r,
      profileMap,
      currentUserId,
      likedPostIds,
      followingUserIds,
      savedPostIds
    )
  );
}

export async function fetchTrendingPosts(
  currentUserId?: string,
  limit: number = 4
): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('is_hidden', false)
    .order('boost_score', { ascending: false, nullsFirst: false })
    .order('superlikes_count', { ascending: false, nullsFirst: false })
    .order('views', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[fetchTrendingPosts] error:', error);
    return [];
  }
  const rows = (data as PostRowBase[]).map((r) => ({
    ...r,
    boost_multiplier: r.boost_multiplier ?? 1,
  }));
  if (rows.length === 0) return [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const [profileMap, likedPostIds, followingUserIds, savedPostIds] =
    await Promise.all([
      fetchProfilesBatch(userIds),
      fetchLikedPostIds(currentUserId),
      fetchFollowingUserIds(currentUserId),
      fetchSavedPostIds(currentUserId),
    ]);
  return rows.map((r) =>
    rowToPostWithProfile(
      r,
      profileMap,
      currentUserId,
      likedPostIds,
      followingUserIds,
      savedPostIds
    )
  );
}

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/avatar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const BUCKET_NAME = 'aura-media';

  const { error: upErr } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, { cacheControl: '3600', upsert: true });

  if (upErr) {
    console.error('[uploadAvatar] Storage upload error:', upErr);
    throw new Error(`Avatar upload failed: ${upErr.message}`);
  }

  const { data: pubData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return pubData.publicUrl;
}

export async function uploadMedia(
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr) {
    console.error('[uploadMedia] Auth error:', authErr);
    throw new Error(`Authentication check failed: ${authErr.message}`);
  }
  if (!authData.user) {
    console.error('[uploadMedia] No authenticated user found');
    throw new Error('You must be logged in to upload media.');
  }
  console.log('[uploadMedia] Authenticated user_id:', authData.user.id);

  const ext = file.name.split('.').pop() || 'mp4';
  const path = `${authData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const BUCKET_NAME = 'aura-media';
  console.log('[uploadMedia] Bucket name being sent to Supabase:', JSON.stringify(BUCKET_NAME));
  console.log('[uploadMedia] Uploading to path:', path, '| file size:', file.size, 'bytes | type:', file.type);

  const { data: upData, error: upErr } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      ...(onProgress
        ? {
            progress: (event: { loaded: number; total: number }) => {
              if (event.total) {
                onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
              }
            },
          }
        : {}),
    });

  if (onProgress) onProgress(100);

  if (upErr) {
    console.error('[uploadMedia] Storage upload error:', upErr);
    throw new Error(`Storage upload failed: ${upErr.message}`);
  }

  console.log('[uploadMedia] Upload succeeded:', upData);

  const { data: pubData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  console.log('[uploadMedia] Public URL:', pubData.publicUrl);
  return pubData.publicUrl;
}
