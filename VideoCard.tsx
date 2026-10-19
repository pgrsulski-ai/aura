import { useEffect, useMemo, useRef, useState } from 'react';
import { Heart, MessageCircle, Plus, Check, Music2, Share2, VolumeX, Volume2, Trash2, Pencil, Eye, EyeOff, Bookmark, Rocket, MoreHorizontal, Star, Flag } from 'lucide-react';
import type { Post } from '@/types';
import { formatCount, timeAgo } from '@/hooks';
import { getFilterCss } from '@/filters';
import { supabase } from '@/supabaseClient';
import { parseVideoLink } from '@/lib/videoLink';
import { ReportModal } from './ReportModal';

interface VideoCardProps {
  post: Post;
  isActive: boolean;
  onToggleFollow: (postId: string) => void;
  onToggleLike: (postId: string) => void;
  onToggleSave: (postId: string) => void;
  onOpenComments: (postId: string) => void;
  onDelete: (postId: string) => void;
  onEdit: (postId: string) => void;
  onBoost: (postId: string) => void;
  onSuperLike: (postId: string) => Promise<boolean>;
  coinBalance: number;
  onOpenShop: () => void;
  onViewIncrement: (postId: string) => void;
  onReport: (postId: string, hidden: boolean, alreadyReported: boolean) => void;
  isAdmin: boolean;
  onAdminDelete: (postId: string) => void;
  onAdminHide: (postId: string) => void;
}

export function VideoCard({
  post,
  isActive,
  onToggleFollow,
  onToggleLike,
  onToggleSave,
  onOpenComments,
  onDelete,
  onEdit,
  onBoost,
  onSuperLike,
  coinBalance,
  onOpenShop,
  onViewIncrement,
  onReport,
  isAdmin,
  onAdminDelete,
  onAdminHide,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showSuperBurst, setShowSuperBurst] = useState(false);
  const [showCoinPrompt, setShowCoinPrompt] = useState(false);
  const [localSuperlikeCount, setLocalSuperlikeCount] = useState(0);
  const [superBurstKey, setSuperBurstKey] = useState(0);
  const [coinFloats, setCoinFloats] = useState<number[]>([]);
  const [superliking, setSuperliking] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showAdminConfirm, setShowAdminConfirm] = useState(false);
  const [showAdminHideConfirm, setShowAdminHideConfirm] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [seekHoverX, setSeekHoverX] = useState<number | null>(null);
  const viewCountedRef = useRef(false);

  const isTrack = post.videoType === 'track';

  const SUPERLIKE_COST = 10;
  const displaySuperlikes = post.superlikesCount + localSuperlikeCount;

  const embedUrl = useMemo(
    () => (post.isExternal ? parseVideoLink(post.videoUrl)?.embedUrl ?? null : null),
    [post.isExternal, post.videoUrl]
  );

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      return `${h}:${String(mm).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.currentTime = 0;
      v.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      v.pause();
    }
  }, [isActive]);

  // Increment view count once when the video becomes active
  useEffect(() => {
    if (!isActive || viewCountedRef.current) return;
    viewCountedRef.current = true;
    onViewIncrement(post.id);
    supabase
      .rpc('increment_view_count', { row_id: post.id })
      .then(undefined, (err: unknown) => console.error('[VideoCard] view increment RPC failed:', err));
  }, [isActive, post.id, onViewIncrement]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = isMuted;
  }, [isMuted]);

  const handleVideoClick = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const handleDoubleClick = () => {
    if (!post.isLiked) onToggleLike(post.id);
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration || isScrubbing) return;
    setProgress((v.currentTime / v.duration) * 100);
    setCurrentTime(v.currentTime);
  };

  const seekFromClientX = (clientX: number) => {
    const v = videoRef.current;
    const bar = seekBarRef.current;
    if (!v || !bar || !v.duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const newTime = ratio * v.duration;
    v.currentTime = newTime;
    setProgress(ratio * 100);
    setCurrentTime(newTime);
  };

  const handleSeekStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsScrubbing(true);
    seekFromClientX(e.clientX);
  };

  useEffect(() => {
    if (!isScrubbing) return;
    const onMove = (e: PointerEvent) => seekFromClientX(e.clientX);
    const onUp = () => setIsScrubbing(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScrubbing]);

  const handleSeekHover = (e: React.PointerEvent) => {
    if (isScrubbing) return;
    const bar = seekBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    setSeekHoverX(Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1));
  };

  return (
    <div className="snap-item relative h-full w-full overflow-hidden bg-neutral-950 pb-28">
      {/* Video — strictly 9:16 vertical, object-cover ensures no black bars */}
      <div className="absolute inset-0 flex items-center justify-center">
        {embedUrl ? (
          <iframe
            src={isActive ? embedUrl : undefined}
            title={post.trackTitle}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full object-cover"
            frameBorder={0}
          />
        ) : (
          <video
            ref={videoRef}
            src={post.videoUrl}
            muted={isMuted}
            playsInline
            loop
            preload="auto"
            onClick={handleVideoClick}
            onDoubleClick={handleDoubleClick}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onLoadedData={() => {
              if (!isActive) return;
              const v = videoRef.current;
              if (!v) return;
              v.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
            }}
            className="h-full w-full object-cover"
            style={{ filter: getFilterCss(post.overlayFilter) }}
          />
        )}
      </div>

      {/* Creator text overlay */}
      {post.overlayText && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-8">
          <p className="text-center text-2xl font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] uppercase tracking-wide">
            {post.overlayText}
          </p>
        </div>
      )}

      {/* Gradient overlays */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />

      {/* Top track info — positioned below the feed tab bar to avoid overlap */}
      <div className="absolute top-24 left-4 right-20 z-20 animate-fade-in">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-neon/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neon backdrop-blur-sm">
            {post.genre}
          </span>
          {post.bpm != null && (
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur-sm">
              {post.bpm} BPM
            </span>
          )}
          {post.boostMultiplier > 1 && (
            <span className="flex items-center gap-0.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400 backdrop-blur-sm">
              <Rocket className="h-2.5 w-2.5" />
              Boosted
            </span>
          )}
        </div>
      </div>

      {/* Sound toggle (moved into right action column) */}

      {/* Double-tap heart burst */}
      {showHeart && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <Heart
            className="h-24 w-24 fill-neon text-neon animate-heart-burst"
            strokeWidth={1}
          />
        </div>
      )}

      {/* SuperLike burst animation (re-triggers on every tap via key) */}
      {showSuperBurst && (
        <div key={superBurstKey} className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <Star
            className="h-28 w-28 fill-amber-400 text-amber-400 animate-heart-burst drop-shadow-[0_0_30px_rgba(251,191,36,0.8)]"
            strokeWidth={1}
          />
          {/* Neon spark particles */}
          {[...Array(6)].map((_, i) => (
            <span
              key={i}
              className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-amber-300"
              style={{
                transform: `rotate(${i * 60}deg) translateY(-60px)`,
                animation: 'heart-burst 0.8s ease-out',
              }}
            />
          ))}
        </div>
      )}

      {/* Floating "-10 Coins" notifications */}
      {coinFloats.map((id) => (
        <div
          key={id}
          className="pointer-events-none absolute right-16 top-1/2 z-40 animate-fade-in select-none"
        >
          <span className="block text-sm font-black text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]">
            -{SUPERLIKE_COST} Coins ⚡
          </span>
        </div>
      ))}

      {/* Need more coins modal */}
      {showCoinPrompt && (
        <>
          <div className="fixed inset-0 bg-black/70 z-[60] backdrop-blur-sm" onClick={() => setShowCoinPrompt(false)} />
          <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[61] w-[min(22rem,calc(100%-2rem))] rounded-2xl border border-amber-400/20 bg-neutral-900 shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-5 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/15">
                <Star className="h-7 w-7 text-amber-400" />
              </div>
              <h3 className="font-display text-lg font-bold text-white">Need More Aura Coins</h3>
              <p className="mt-2 text-sm text-white/60">
                A SuperLike costs {SUPERLIKE_COST} coins and boosts the track up the trending feed. 80% goes directly to the artist as a tip.
              </p>
              <p className="mt-2 text-xs text-white/40">
                You can also earn +5 free coins with the daily login bonus.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowCoinPrompt(false)}
                  className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/15"
                >
                  Not now
                </button>
                <button
                  onClick={() => { setShowCoinPrompt(false); onOpenShop(); }}
                  className="flex-1 rounded-xl bg-neon py-3 text-sm font-bold text-neutral-950 transition-all hover:scale-105 neon-glow"
                >
                  Get Coins
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mute / play indicator */}
      {!isPlaying && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="rounded-full bg-black/50 p-4 backdrop-blur-sm">
            <svg className="h-8 w-8 text-white" fill="white" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Right-side action menu (clean primary column) */}
      <div className="absolute right-3 top-16 bottom-28 z-30 flex flex-col items-center justify-end gap-5">
        {/* Avatar */}
        <div className="w-11 h-11 rounded-full border-2 border-[#00FFA3] bg-neutral-800 flex items-center justify-center font-bold text-white text-sm">
          {post.artistAvatar}
        </div>

        {/* Likes */}
        <button
          onClick={() => onToggleLike(post.id)}
          className="flex flex-col items-center gap-0.5 active:scale-90 transition-transform"
        >
          <Heart
            className={`h-8 w-8 drop-shadow-lg transition-all ${
              post.isLiked ? 'fill-neon text-neon scale-110' : 'text-white'
            }`}
            strokeWidth={1.8}
          />
          <span className="text-[10px] font-semibold text-white drop-shadow">
            {formatCount(post.likes)}
          </span>
        </button>

        {/* SuperLike (10 coins — cumulative tip + boost, repeatable) */}
        <button
          onClick={async () => {
            if (superliking) return;
            if (coinBalance - localSuperlikeCount * SUPERLIKE_COST < SUPERLIKE_COST) {
              setShowCoinPrompt(true);
              return;
            }
            setSuperliking(true);
            setLocalSuperlikeCount((c) => c + 1);
            setSuperBurstKey((k) => k + 1);
            setShowSuperBurst(true);
            const floatId = Date.now();
            setCoinFloats((f) => [...f, floatId]);
            setTimeout(() => setShowSuperBurst(false), 1000);
            setTimeout(() => setCoinFloats((f) => f.filter((id) => id !== floatId)), 1500);
            try {
              const ok = await onSuperLike(post.id);
              if (!ok) {
                setLocalSuperlikeCount((c) => Math.max(0, c - 1));
              }
            } catch (e) {
              console.error('[VideoCard] SuperLike failed:', e);
              setLocalSuperlikeCount((c) => Math.max(0, c - 1));
              alert(e instanceof Error ? e.message : 'Could not send SuperLike');
            } finally {
              setSuperliking(false);
            }
          }}
          className="flex flex-col items-center gap-0.5 active:scale-90 transition-transform"
        >
          <Star
            className="h-8 w-8 drop-shadow-lg transition-all text-amber-400 hover:scale-110"
            strokeWidth={1.8}
          />
          <span className="text-[10px] font-semibold text-amber-400 drop-shadow">
            {displaySuperlikes > 0 ? formatCount(displaySuperlikes) : SUPERLIKE_COST}
          </span>
        </button>

        {/* Comments */}
        <button
          onClick={() => onOpenComments(post.id)}
          className="flex flex-col items-center gap-0.5 active:scale-90 transition-transform"
        >
          <MessageCircle className="h-8 w-8 text-white drop-shadow-lg" strokeWidth={1.8} />
          <span className="text-[10px] font-semibold text-white drop-shadow">
            {formatCount(post.comments.length)}
          </span>
        </button>

        {/* Share */}
        <button
          onClick={() => { if (navigator.share) { navigator.share({ title: 'Aura Track', url: window.location.href }).catch(() => alert('Link copied!')); } else { navigator.clipboard.writeText(window.location.href); alert('Link copied!'); } }}
          className="flex flex-col items-center gap-0.5 active:scale-90 transition-transform"
        >
          <Share2 className="h-8 w-8 text-white drop-shadow-lg" strokeWidth={1.8} />
          <span className="text-[10px] font-semibold text-white drop-shadow">Share</span>
        </button>

        {/* Save / Bookmark */}
        <button
          onClick={() => onToggleSave(post.id)}
          className="flex flex-col items-center gap-0.5 active:scale-90 transition-transform"
        >
          <Bookmark
            className={`h-8 w-8 drop-shadow-lg transition-all ${
              post.isSaved ? 'fill-neon text-neon scale-110' : 'text-white'
            }`}
            strokeWidth={1.8}
          />
          <span className="text-[10px] font-semibold text-white drop-shadow">
            {post.isSaved ? 'Saved' : 'Save'}
          </span>
        </button>

        {/* More (opens bottom sheet with secondary actions) */}
        <button
          onClick={() => setShowMore(true)}
          className="flex flex-col items-center gap-0.5 active:scale-90 transition-transform"
        >
          <MoreHorizontal className="h-8 w-8 text-white drop-shadow-lg" strokeWidth={1.8} />
          <span className="text-[10px] font-semibold text-white drop-shadow">More</span>
        </button>

        {/* Spinning disc */}
        <div className="h-9 w-9 rounded-full border-2 border-white/30 bg-gradient-to-br from-neutral-800 to-neutral-950 animate-spin-slow">
          <div className="mt-3 ml-3 h-1 w-1 rounded-full bg-neon" />
        </div>
      </div>

      {/* More Options bottom sheet */}
      {showMore && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[9998] backdrop-blur-sm" onClick={() => setShowMore(false)} />
          <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[9999] isolate w-[min(22rem,calc(100%-2rem))] rounded-2xl border border-white/10 bg-gray-900 shadow-2xl overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-sm font-semibold text-white">More options</span>
              <button
                onClick={() => setShowMore(false)}
                className="rounded-full p-1 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <Plus className="h-4 w-4 rotate-45" />
              </button>
            </div>
            <div className="p-2">
              {/* Mute / Unmute */}
              <button
                onClick={() => { setIsMuted((m) => !m); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white hover:bg-white/10 transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="h-5 w-5 text-white" />
                ) : (
                  <Volume2 className="h-5 w-5 text-neon" />
                )}
                <span className="flex-1">{isMuted ? 'Unmute sound' : 'Mute sound'}</span>
              </button>

              {/* Report post (not own posts) */}
              {!post.isOwn && (
                <button
                  onClick={() => { setShowMore(false); setShowReport(true); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  <Flag className="h-5 w-5" />
                  <span className="flex-1">Report post</span>
                </button>
              )}

              {/* Boost (own posts only) */}
              {post.isOwn && post.boostMultiplier <= 1 && (
                <button
                  onClick={() => { setShowMore(false); onBoost(post.id); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  <Rocket className="h-5 w-5" />
                  <span className="flex-1">Boost video (100 coins)</span>
                </button>
              )}
              {post.isOwn && post.boostMultiplier > 1 && (
                <div className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-amber-400">
                  <Rocket className="h-5 w-5 fill-amber-400 animate-pulse" />
                  <span className="flex-1">Already boosted</span>
                </div>
              )}

              {/* Edit (own posts only) */}
              {post.isOwn && (
                <button
                  onClick={() => { setShowMore(false); onEdit(post.id); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-blue-400 hover:bg-blue-500/10 transition-colors"
                >
                  <Pencil className="h-5 w-5" />
                  <span className="flex-1">Edit track</span>
                </button>
              )}

              {/* Delete (own posts only) */}
              {post.isOwn && (
                <button
                  onClick={() => { setShowMore(false); onDelete(post.id); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="h-5 w-5" />
                  <span className="flex-1">Delete track</span>
                </button>
              )}

              {/* Report (not own posts) */}
              {!post.isOwn && (
                <button
                  onClick={() => { setShowMore(false); setShowReport(true); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Flag className="h-5 w-5" />
                  <span className="flex-1">Report post</span>
                </button>
              )}

              {/* Admin: hide post immediately */}
              {isAdmin && !post.isOwn && (
                <button
                  onClick={() => { setShowMore(false); setShowAdminHideConfirm(true); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-orange-400 hover:bg-orange-500/10 transition-colors"
                >
                  <EyeOff className="h-5 w-5" />
                  <span className="flex-1">Moderation Panel: Hide video immediately</span>
                </button>
              )}

              {/* Admin delete (admins only, not own posts) */}
              {isAdmin && !post.isOwn && (
                <button
                  onClick={() => { setShowMore(false); setShowAdminConfirm(true); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/5 mt-1 pt-3"
                >
                  <Trash2 className="h-5 w-5" />
                  <span className="flex-1">Delete post (Admin)</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Bottom track info */}
      <div className="absolute bottom-32 left-4 right-20 z-10 flex flex-col gap-2 text-white">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-xl drop-shadow-md">{post.artistHandle || '@Msciborpl'}</h3>
          {!post.isOwn && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (typeof onToggleFollow === 'function') onToggleFollow(post.id);
              }}
              className={`px-4 py-1 rounded-full font-bold text-sm shadow-lg border transition-all ${
                post.isFollowing
                  ? 'bg-neutral-800 text-white border-neutral-500'
                  : 'bg-[#00FFA3] text-black border-black hover:scale-105'
              }`}
            >
              {post.isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
        <p className="text-sm drop-shadow-md w-3/4 truncate">{post.trackTitle || 'New drop from the studio'}</p>
        <p className="text-xs text-white/80 drop-shadow line-clamp-2">{post.caption}</p>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-white/70 drop-shadow">
          <span>{timeAgo(post.createdAt)}</span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {formatCount(post.views)} views
          </span>
        </div>
      </div>

      {/* Interactive progress bar / seeker (native videos only) */}
      {!embedUrl && (
      <div className={`absolute left-0 right-0 z-10 ${isTrack ? 'bottom-28' : 'bottom-28'} px-3`}>
        {isTrack && (
          <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-white/80 drop-shadow tabular-nums">
            <span>{formatTime(isScrubbing ? currentTime : (videoRef.current?.currentTime ?? currentTime))}</span>
            <span className="text-white/50">{formatTime(duration)}</span>
          </div>
        )}
        <div
          ref={seekBarRef}
          onPointerDown={handleSeekStart}
          onPointerMove={handleSeekHover}
          onPointerLeave={() => setSeekHoverX(null)}
          className={`group relative w-full cursor-pointer rounded-full bg-white/15 ${isTrack ? 'h-1.5' : 'h-1'}`}
        >
          {/* Hover preview position marker for tracks */}
          {isTrack && seekHoverX !== null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 rounded-full bg-white/50"
              style={{ left: `${seekHoverX * 100}%` }}
            />
          )}
          {/* Buffered/played fill */}
          <div
            className={`absolute left-0 top-0 h-full rounded-full bg-neon ${isScrubbing ? '' : 'transition-[width] duration-200 ease-linear'}`}
            style={{ width: `${progress}%` }}
          />
          {/* Draggable thumb for tracks */}
          {isTrack && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow-md transition-transform ${
                isScrubbing || seekHoverX !== null ? 'h-3.5 w-3.5 scale-110' : 'h-3 w-3 scale-90 opacity-0 group-hover:opacity-100'
              }`}
              style={{ left: `${progress}%` }}
            />
          )}
        </div>
      </div>
      )}

      {/* Report modal */}
      {showReport && (
        <ReportModal
          postId={post.id}
          onClose={() => setShowReport(false)}
          onSubmitted={(_postId, hidden) => {
            setShowReport(false);
            onReport(post.id, hidden, false);
          }}
          onAlreadyReported={() => {
            setShowReport(false);
            onReport(post.id, false, true);
          }}
        />
      )}

      {/* Admin delete confirmation */}
      {showAdminConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={() => setShowAdminConfirm(false)} />
          <div className="relative mx-4 w-[min(24rem,calc(100%-2rem))] rounded-2xl border border-red-500/30 bg-neutral-900 p-5 shadow-2xl animate-fade-in">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="font-display text-base font-bold text-white">Delete post as Admin</h3>
            </div>
            <p className="text-sm text-white/60">
              Are you sure you want to delete this video as Admin? This action cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowAdminConfirm(false)}
                className="flex-1 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowAdminConfirm(false);
                  onAdminDelete(post.id);
                }}
                className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-bold text-white transition-colors hover:bg-red-600"
              >
                Delete post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin hide confirmation */}
      {showAdminHideConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={() => setShowAdminHideConfirm(false)} />
          <div className="relative mx-4 w-[min(24rem,calc(100%-2rem))] rounded-2xl border border-orange-500/30 bg-neutral-900 p-5 shadow-2xl animate-fade-in">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/15">
                <EyeOff className="h-5 w-5 text-orange-400" />
              </div>
              <h3 className="font-display text-base font-bold text-white">Hide Video Immediately</h3>
            </div>
            <p className="text-sm text-white/60">
              This video will be immediately hidden from the feed and search. The author will not be notified. You can reverse this from the Moderation Panel.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowAdminHideConfirm(false)}
                className="flex-1 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowAdminHideConfirm(false);
                  onAdminHide(post.id);
                }}
                className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-600"
              >
                Hide video
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
