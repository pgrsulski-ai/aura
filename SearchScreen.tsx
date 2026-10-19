import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search as SearchIcon,
  TrendingUp,
  Hash,
  X,
  Play,
  Loader2,
  User as UserIcon,
  Music2,
  Flame,
  Sparkles,
  ArrowRight,
  Eye,
  Rocket,
  Heart,
} from 'lucide-react';
import type { Post } from '@/types';
import { formatCount } from '@/hooks';
import { getFilterCss } from '@/filters';
import {
  searchProfiles,
  searchPosts,
  fetchTrendingPosts,
  type CreatorResult,
} from '@/postsApi';

interface SearchScreenProps {
  posts: Post[];
  onPlayTrack: (postId: string, post?: Post) => void;
  onViewCreator: (userId: string) => void;
  currentUserId?: string;
}

const TRENDING_TAGS = [
  '#darkbass',
  '#slavicfolk',
  '#pagan',
  '#subbass',
  '#krakow',
  '#gusli',
  '#ritual',
];

export function SearchScreen({
  posts,
  onPlayTrack,
  onViewCreator,
  currentUserId,
}: SearchScreenProps) {
  const [query, setQuery] = useState('');
  const [creators, setCreators] = useState<CreatorResult[]>([]);
  const [trackResults, setTrackResults] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [trending, setTrending] = useState<Post[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchTrendingPosts(currentUserId, 4)
      .then(setTrending)
      .catch((e) => console.error('[SearchScreen] trending failed:', e))
      .finally(() => setTrendingLoading(false));
  }, [currentUserId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setCreators([]);
      setTrackResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const [profileResults, postResults] = await Promise.all([
          searchProfiles(q),
          searchPosts(q, currentUserId),
        ]);
        setCreators(profileResults);
        setTrackResults(postResults);
      } catch (e) {
        console.error('[SearchScreen] search failed:', e);
        setCreators([]);
        setTrackResults([]);
      } finally {
        setLoading(false);
        setHasSearched(true);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, currentUserId]);

  const hasResults = creators.length > 0 || trackResults.length > 0;
  const isSearching = query.trim().length > 0;
  const fallbackTrending = useMemo(() => posts.slice(0, 4), [posts]);
  const trendingPosts = trending.length > 0 ? trending : fallbackTrending;

  return (
    <div className="no-scrollbar h-full overflow-y-auto bg-neutral-950 pb-24">
      {/* Search bar */}
      <div className="sticky top-0 z-20 bg-neutral-950/80 px-4 py-3 backdrop-blur-lg">
        <div className="flex items-center gap-2.5 rounded-full bg-white/8 px-4 py-2.5">
          <SearchIcon className="h-4 w-4 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search creators, tracks, genres..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
          />
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-neon" />
          ) : query ? (
            <button onClick={() => setQuery('')} className="text-white/40">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* ─── SEARCH RESULTS (when query is active) ─── */}
      {isSearching ? (
        loading && !hasSearched ? (
          <div className="flex flex-col items-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-neon" />
            <p className="mt-3 text-xs text-white/40">Searching...</p>
          </div>
        ) : !hasResults ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="mb-3 rounded-full bg-white/5 p-5">
              <SearchIcon className="h-7 w-7 text-white/40" />
            </div>
            <p className="text-sm text-white/60">No results for "{query}"</p>
            <p className="mt-1 text-xs text-white/40">
              Try a different keyword or tag.
            </p>
          </div>
        ) : (
          <div className="px-4 space-y-5">
            {/* Creators section */}
            {creators.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-3.5 w-3.5 text-neon" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                    Creators ({creators.length})
                  </p>
                </div>
                <div className="space-y-2">
                  {creators.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onViewCreator(c.id)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-white/5 p-3 text-left transition-colors hover:bg-white/8 active:scale-[0.99]"
                    >
                      {c.avatarUrl ? (
                        <img
                          src={c.avatarUrl}
                          alt={c.handle}
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neon to-emerald-700 text-sm font-bold text-neutral-950">
                          {c.handle.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">
                          {c.handle}
                        </p>
                        <p className="truncate text-[11px] text-white/50">
                          {c.bio || 'No bio yet'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tracks & Shorts section */}
            {trackResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Music2 className="h-3.5 w-3.5 text-neon" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                    Tracks &amp; Shorts ({trackResults.length})
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {trackResults.map((post) => (
                    <button
                      key={post.id}
                      onClick={() => onPlayTrack(post.id)}
                      className="group relative aspect-video overflow-hidden rounded-xl bg-neutral-800"
                    >
                      <video
                        src={post.videoUrl}
                        playsInline
                        muted
                        preload="metadata"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        style={{ filter: getFilterCss(post.overlayFilter) }}
                      />
                      {post.overlayText && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-2">
                          <p className="text-center text-xs font-black text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] uppercase tracking-wide leading-tight">
                            {post.overlayText}
                          </p>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <div className="absolute left-1.5 top-1.5 rounded-full bg-black/50 p-1 backdrop-blur-sm">
                        <Play className="h-3 w-3 fill-white text-white" />
                      </div>
                      {post.videoType === 'track' && (
                        <span className="absolute right-1.5 top-1.5 rounded-full bg-neon/80 px-1.5 py-0.5 text-[8px] font-bold text-black">
                          TRACK
                        </span>
                      )}
                      <div className="absolute bottom-1.5 left-2 right-2">
                        <p className="truncate text-[11px] font-bold text-white">
                          {post.trackTitle}
                        </p>
                        <p className="truncate text-[9px] text-white/70">
                          {post.artistHandle}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        /* ─── EXPLORE DASHBOARD (no query) ─── */
        <div className="px-4 space-y-6">
          {/* Sponsored Hero Banner (ad placeholder) */}
          <button
            onClick={() => alert('Ad slots coming soon! Contact us to promote your track.')}
            className="group relative mt-1 w-full overflow-hidden rounded-3xl border border-neon/20 bg-gradient-to-br from-emerald-900/40 via-neutral-900 to-neutral-950 p-5 text-left transition-all hover:border-neon/50 hover:from-emerald-900/60"
          >
            {/* Decorative glow blobs */}
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-neon/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-emerald-500/10 blur-3xl" />

            {/* Sponsored tag */}
            <div className="relative flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/70 backdrop-blur-sm">
                <Sparkles className="h-2.5 w-2.5 text-neon" />
                Sponsored
              </span>
              {trendingPosts[0]?.boostMultiplier > 1 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
                  <Rocket className="h-2.5 w-2.5" />
                  Boosted
                </span>
              )}
            </div>

            {/* Banner content */}
            <div className="relative mt-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-xl font-black leading-tight text-white">
                  Promote your track here!
                </h2>
                <p className="mt-1 text-xs text-white/60">
                  Reach thousands of listeners. Reserve your featured slot.
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-neon px-4 py-1.5 text-xs font-bold text-neutral-950 transition-transform group-hover:scale-105">
                  Get featured
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
              {/* Decorative icon block */}
              <div className="hidden shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-neon/30 to-emerald-700/30 p-4 backdrop-blur-sm sm:flex">
                <Flame className="h-8 w-8 text-neon" />
              </div>
            </div>
          </button>

          {/* Trending Tracks */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-neon" />
                <h3 className="font-display text-sm font-bold text-white">
                  Trending Tracks
                </h3>
              </div>
              {trendingLoading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
              )}
            </div>
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
              {trendingPosts.map((post, idx) => (
                <button
                  key={post.id}
                  onClick={() => onPlayTrack(post.id)}
                  className="group relative aspect-[9/14] w-32 shrink-0 overflow-hidden rounded-2xl bg-neutral-800"
                >
                  <video
                    src={post.videoUrl}
                    playsInline
                    muted
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
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  {/* Rank badge */}
                  <div className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 font-display text-xs font-black text-neon backdrop-blur-sm">
                    {idx + 1}
                  </div>
                  {post.boostMultiplier > 1 && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-500/80 px-1.5 py-0.5 text-[8px] font-bold text-black backdrop-blur-sm">
                      <Rocket className="inline h-2.5 w-2.5" /> {post.boostMultiplier}x
                    </span>
                  )}
                  <div className="absolute bottom-1.5 left-1.5 right-1.5">
                    <p className="truncate text-[10px] font-bold text-white drop-shadow">
                      {post.trackTitle}
                    </p>
                    <p className="truncate text-[9px] text-white/60">
                      {post.artistHandle}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1 text-[8px] text-white/70">
                      <Eye className="h-2.5 w-2.5" />
                      {formatCount(post.views)}
                      <Heart className="ml-1 h-2.5 w-2.5" />
                      {formatCount(post.likes)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Hash className="h-4 w-4 text-neon" />
              <h3 className="font-display text-sm font-bold text-white">
                Popular Tags
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {TRENDING_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setQuery(tag)}
                  className="rounded-full bg-white/8 px-3 py-1.5 text-xs font-semibold text-neon transition-colors hover:bg-white/12"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
