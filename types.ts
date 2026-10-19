export interface Reply {
  id: string;
  handle: string;
  avatar: string;
  text: string;
  likes: number;
  createdAt: number;
}

export interface Comment {
  id: string;
  handle: string;
  avatar: string;
  text: string;
  likes: number;
  createdAt: number;
  replies: Reply[];
}

export type VideoFilter = 'normal' | 'grayscale' | 'sepia' | 'contrast' | 'vintage';

export interface Post {
  id: string;
  videoUrl: string;
  trackTitle: string;
  artistHandle: string;
  artistAvatar: string;
  artistBio: string;
  caption: string;
  genre: string;
  bpm: number | null;
  aiPrompt: string;
  aiEngine: string;
  durationLabel: string;
  likes: number;
  views: number;
  boostMultiplier: number;
  boostScore: number;
  superlikesCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  isFollowing: boolean;
  isLiked: boolean;
  isSaved: boolean;
  comments: Comment[];
  createdAt: number;
  isOwn?: boolean;
  videoType: 'short' | 'track';
  isExternal?: boolean;
  overlayText?: string;
  overlayFilter?: VideoFilter;
  userId?: string;
}

export interface CurrentUser {
  handle: string;
  bio: string;
  avatar: string;
  avatarUrl?: string;
  email?: string;
  walletBalance?: number;
  coinBalance?: number;
  role?: 'user' | 'admin';
}

export type TabKey = 'home' | 'search' | 'profile';
export type FeedTab = 'discover' | 'following';
export type VideoTypeFilter = 'short' | 'track';

export interface Settings {
  losslessAudio: boolean;
  backgroundPlay: boolean;
}
