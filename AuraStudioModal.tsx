import { useMemo, useRef, useState } from 'react';
import { X, Upload, Music2, Film, Zap, Check, Type, Sliders, AlertCircle, Loader2, Link2, Smartphone } from 'lucide-react';
import type { Post, VideoFilter, VideoTypeFilter } from '@/types';
import { FILTERS, getFilterCss } from '@/filters';
import { uploadMedia, createPost, type UploadRewardResult } from '@/postsApi';
import { maybeCompressVideo, shouldCompress } from '@/lib/videoCompression';
import { parseVideoLink, type ParsedVideoLink } from '@/lib/videoLink';

const MAX_FILE_SIZE = 100 * 1024 * 1024;

type PublishPhase = 'idle' | 'optimizing' | 'uploading' | 'done';
type SourceMode = 'link' | 'file';

interface AuraStudioModalProps {
  currentUserHandle: string;
  currentUserAvatar: string;
  prefillTrackTitle?: string;
  prefillCaption?: string;
  prefillGenre?: string;
  onPublish: (post: Post, uploadReward?: UploadRewardResult | null) => void;
  onClose: () => void;
}

type Step = 'details' | 'edit';

export function AuraStudioModal({
  currentUserHandle,
  currentUserAvatar,
  prefillTrackTitle,
  prefillCaption,
  prefillGenre,
  onPublish,
  onClose,
}: AuraStudioModalProps) {
  const [step, setStep] = useState<Step>('details');
  const [sourceMode, setSourceMode] = useState<SourceMode>('link');
  const [trackTitle, setTrackTitle] = useState(prefillTrackTitle || '');
  const [caption, setCaption] = useState(prefillCaption || '');
  const [genre, setGenre] = useState(prefillGenre || '');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiEngine, setAiEngine] = useState('Suno v3.5');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [parsedLink, setParsedLink] = useState<ParsedVideoLink | null>(null);
  const [overlayText, setOverlayText] = useState('');
  const [overlayFilter, setOverlayFilter] = useState<VideoFilter>('normal');
  const [videoType, setVideoType] = useState<VideoTypeFilter>('short');
  const [bpm, setBpm] = useState<string>('');
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<PublishPhase>('idle');
  const [progressPct, setProgressPct] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const isExternal = sourceMode === 'link' && parsedLink !== null;
  const hasMedia = isExternal || !!videoPreviewUrl;

  const handleVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError(`File is ${(file.size / 1024 / 1024).toFixed(1)}MB. Max file size is 100MB.`);
      return;
    }
    setError(null);
    setParsedLink(null);
    setLinkInput('');
    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
  };

  const handleLinkChange = (value: string) => {
    setLinkInput(value);
    if (!value.trim()) {
      setParsedLink(null);
      setError(null);
      return;
    }
    const parsed = parseVideoLink(value);
    if (parsed) {
      setParsedLink(parsed);
      setVideoFile(null);
      setVideoPreviewUrl(null);
      setError(null);
    } else {
      setParsedLink(null);
      setError('Please paste a valid YouTube or TikTok link.');
    }
  };

  const previewUrl = videoPreviewUrl || '';
  const activeFilterCss = getFilterCss(overlayFilter);

  const switchMode = (mode: SourceMode) => {
    setSourceMode(mode);
    setError(null);
    if (mode === 'link') {
      setVideoFile(null);
      setVideoPreviewUrl(null);
    } else {
      setParsedLink(null);
      setLinkInput('');
    }
  };

  const handlePublish = async () => {
    if (!trackTitle.trim()) return;
    if (sourceMode === 'link' && !parsedLink) return;
    if (sourceMode === 'file' && !videoFile) return;

    setPublishing(true);
    setError(null);
    setProgressPct(0);

    try {
      let mediaUrl: string;
      let external = false;

      if (sourceMode === 'link' && parsedLink) {
        // External link — zero storage bytes.
        mediaUrl = parsedLink.originalUrl;
        external = true;
        setPhase('uploading');
        setProgressPct(100);
      } else if (videoFile) {
        // Step 1: Optimize (if needed)
        let fileToUpload = videoFile;
        if (shouldCompress(videoFile)) {
          setPhase('optimizing');
          const result = await maybeCompressVideo(videoFile, (pct) => setProgressPct(pct));
          fileToUpload = result.file;
        }
        // Step 2: Upload
        setPhase('uploading');
        setProgressPct(0);
        mediaUrl = await uploadMedia(fileToUpload, (pct) => setProgressPct(pct));
        external = false;
      } else {
        throw new Error('No media selected.');
      }

      const result = await createPost({
        mediaUrl,
        isExternal: external,
        trackTitle: trackTitle.trim(),
        caption: caption.trim() || 'New drop from the studio.',
        genre,
        aiPrompt,
        aiEngine,
        overlayText: overlayText.trim(),
        overlayFilter,
        videoType,
        bpm: bpm.trim() ? Math.min(260, Math.max(40, Number(bpm))) : null,
      });
      if (!result.post) throw new Error('Failed to create post.');
      const publishedPost = result.post;
      setPhase('done');
      setPublished(true);
      setTimeout(() => {
        onPublish(publishedPost, result.uploadReward);
      }, 600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      setError(msg);
      setPublishing(false);
      setPhase('idle');
      setProgressPct(0);
    }
  };

  const phaseLabel =
    phase === 'optimizing' ? 'Optimizing...' : phase === 'uploading' ? 'Uploading to Aura...' : '';

  const canPublish = !!trackTitle.trim() && hasMedia && !publishing;

  const renderProgressBar = () => {
    if (!publishing || (phase !== 'optimizing' && phase !== 'uploading')) return null;
    return (
      <div className="rounded-2xl border border-neon/20 bg-neon/5 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-neon">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{phaseLabel} {progressPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-neon transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-[11px] text-white/40">
          {phase === 'optimizing'
            ? 'Compressing for fast playback'
            : 'Your video is heading to Aura Studio...'}
        </p>
      </div>
    );
  };

  const renderError = () => {
    if (!error) return null;
    return (
      <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
        <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
        <p className="text-xs text-red-400">{error}</p>
      </div>
    );
  };

  const renderPublishButton = () => (
    <button
      onClick={handlePublish}
      disabled={!canPublish}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all ${
        canPublish ? 'bg-neon text-neutral-950 neon-glow' : 'bg-white/10 text-white/30'
      }`}
    >
      {publishing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> {phaseLabel || 'Publishing...'} {progressPct}%
        </>
      ) : (
        <>
          <Upload className="h-4 w-4" /> Publish Track
        </>
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/80 animate-fade-in" onClick={onClose} />
      <div className="relative mt-auto flex max-h-[90%] flex-col rounded-t-3xl border-t border-neon/20 bg-neutral-900 animate-slide-up">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neon/40" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          {step === 'edit' && !published ? (
            <button
              onClick={() => setStep('details')}
              className="text-white/60 text-sm font-semibold"
            >
              Back
            </button>
          ) : (
            <button onClick={onClose} className="text-white/60">
              <X className="h-5 w-5" />
            </button>
          )}
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-white">
            <Zap className="h-4 w-4 fill-neon text-neon" />
            {step === 'edit' && !published ? 'EDIT VIDEO' : 'AURA STUDIO'}
          </h3>
          <div className="w-12" />
        </div>

        {published ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pop">
            <div className="mb-4 rounded-full bg-neon/20 p-6">
              <Check className="h-10 w-10 text-neon" strokeWidth={3} />
            </div>
            <p className="font-display text-lg font-bold text-white">Track Published!</p>
            <p className="mt-1 text-sm text-white/50">Your drop is live in the feed.</p>
          </div>
        ) : step === 'details' ? (
          <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Source mode tabs */}
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-neutral-800/60 p-1">
              <button
                type="button"
                onClick={() => switchMode('link')}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                  sourceMode === 'link'
                    ? 'bg-neon text-neutral-950'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Link2 className="h-4 w-4" /> Paste link
                <span className="ml-1 rounded-full bg-black/15 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                  Recommended
                </span>
              </button>
              <button
                type="button"
                onClick={() => switchMode('file')}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                  sourceMode === 'file'
                    ? 'bg-neon text-neutral-950'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Smartphone className="h-4 w-4" /> Upload file
              </button>
            </div>

            {/* Video source area */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                Video
              </label>

              {sourceMode === 'link' ? (
                <div className="space-y-3">
                  <input
                    value={linkInput}
                    onChange={(e) => handleLinkChange(e.target.value)}
                    className="w-full rounded-xl bg-neutral-900 border border-neutral-700 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-neon/50"
                    placeholder="Paste a YouTube or TikTok link..."
                  />
                  <p className="text-[11px] text-white/40">
                    Supported: YouTube Shorts, YouTube, TikTok. Video plays directly from the original source — no storage space used in Aura Studio.
                  </p>
                  {parsedLink && (
                    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-800">
                      <iframe
                        src={parsedLink.embedUrl}
                        title="Video preview"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="h-full w-full"
                        frameBorder={0}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-800">
                  {previewUrl ? (
                    <video
                      src={previewUrl}
                      playsInline
                      loop
                      muted
                      autoPlay
                      className="h-full w-full object-cover"
                      style={{ filter: getFilterCss(overlayFilter) }}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/40">
                      <Film className="h-8 w-8" />
                      <p className="text-xs">Upload a video</p>
                      <p className="text-[10px] text-white/30">Max file size: 100MB (automatically optimized for mobile streaming)</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  {previewUrl && overlayText && (
                    <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                      <p className="text-center text-xl font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] uppercase tracking-wide">
                        {overlayText}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-neon px-3 py-1.5 text-xs font-bold text-neutral-950"
                  >
                    <Film className="h-3.5 w-3.5" /> Upload
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoFile}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {/* Track title */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
                Track Title
              </label>
              <input
                value={trackTitle}
                onChange={(e) => setTrackTitle(e.target.value)}
                className="w-full rounded-xl bg-neutral-900 border border-neutral-700 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-neon/50"
                placeholder="e.g. Artist — Awakening"
              />
            </div>

            {/* Caption */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
                Caption
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                maxLength={200}
                className="w-full resize-none rounded-xl bg-neutral-900 border border-neutral-700 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-neon/50"
                placeholder="Describe your track..."
              />
            </div>

            {/* Genre */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
                Genre
              </label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="Enter genre (e.g., Dark Folk)"
                className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-xl p-3 outline-none focus:ring-2 focus:ring-neon/50"
              />
            </div>

            {/* Tempo / BPM */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
                Tempo (BPM) (Optional)
              </label>
              <input
                type="number"
                min={40}
                max={260}
                value={bpm}
                onChange={(e) => setBpm(e.target.value)}
                placeholder="e.g. 128"
                className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-xl p-3 outline-none focus:ring-2 focus:ring-neon/50"
              />
            </div>

            {/* AI Prompt */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                AI Prompt Used
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Enter the exact prompt used to generate this track..."
                className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-xl p-3 h-24 mb-4 resize-none outline-none focus:ring-2 focus:ring-neon/50"
              />
            </div>

            {/* AI Engine */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                AI Engine & Version
              </label>
              <select
                value={aiEngine}
                onChange={(e) => setAiEngine(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-xl p-3 mb-6 outline-none focus:ring-2 focus:ring-neon/50"
              >
                <option>Original (Non-AI)</option>
                <option>Suno v3.5</option>
                <option>Suno v4.0</option>
                <option>Udio</option>
                <option>Udio v1.5</option>
                <option>Other</option>
              </select>
            </div>

            {/* Video type selector */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
                Video Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVideoType('short')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                    videoType === 'short'
                      ? 'border-neon bg-neon/10 text-neon'
                      : 'border-neutral-700 bg-neutral-900 text-white/50 hover:text-white'
                  }`}
                >
                  <Zap className="h-4 w-4" /> Short
                </button>
                <button
                  type="button"
                  onClick={() => setVideoType('track')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                    videoType === 'track'
                      ? 'border-neon bg-neon/10 text-neon'
                      : 'border-neutral-700 bg-neutral-900 text-white/50 hover:text-white'
                  }`}
                >
                  <Music2 className="h-4 w-4" /> Full Track
                </button>
              </div>
            </div>

            {/* Continue to edit step */}
            <button
              onClick={() => setStep('edit')}
              disabled={!trackTitle.trim() || !hasMedia}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all ${
                trackTitle.trim() && hasMedia
                  ? 'bg-white/10 text-white border border-white/15 hover:bg-white/15'
                  : 'bg-white/5 text-white/30'
              }`}
            >
              <Sliders className="h-4 w-4" /> Edit Video
            </button>

            {renderPublishButton()}
            {renderProgressBar()}
            {renderError()}
          </div>
        ) : (
          /* EDIT STEP */
          <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Video preview with live overlay + filter */}
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-800">
              {isExternal && parsedLink ? (
                <iframe
                  src={parsedLink.embedUrl}
                  title="Video preview"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                  frameBorder={0}
                />
              ) : (
                <video
                  src={previewUrl || undefined}
                  playsInline
                  loop
                  muted
                  autoPlay
                  className="h-full w-full object-cover"
                  style={{ filter: activeFilterCss }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
              {overlayText && (
                <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                  <p className="text-center text-2xl font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] uppercase tracking-wide">
                    {overlayText}
                  </p>
                </div>
              )}
            </div>

            {/* Text overlay input (native files only — iframe filters don't apply) */}
            {!isExternal && (
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                  <Type className="h-3.5 w-3.5" /> Text Overlay
                </label>
                <input
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                  maxLength={60}
                  className="w-full rounded-xl bg-neutral-900 border border-neutral-700 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-neon/50"
                  placeholder="Type text to overlay on video..."
                />
                {overlayText && (
                  <button
                    onClick={() => setOverlayText('')}
                    className="mt-1.5 text-[11px] font-semibold text-white/40 hover:text-white/70"
                  >
                    Clear text
                  </button>
                )}
              </div>
            )}

            {/* Filter selector (native files only) */}
            {!isExternal && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                  Filter
                </label>
                <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 pb-2">
                  {FILTERS.map((f) => {
                    const isActive = overlayFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setOverlayFilter(f.id)}
                        className={`shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                          isActive
                            ? 'border-neon ring-2 ring-neon/30'
                            : 'border-transparent opacity-70'
                        }`}
                      >
                        <div className="relative h-16 w-20 overflow-hidden bg-neutral-800">
                          <video
                            src={previewUrl || undefined}
                            playsInline
                            muted
                            loop
                            autoPlay
                            className="h-full w-full object-cover"
                            style={{ filter: f.css }}
                          />
                        </div>
                        <p
                          className={`py-1 text-center text-[10px] font-bold ${
                            isActive ? 'text-neon' : 'text-white/60'
                          }`}
                        >
                          {f.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {isExternal && (
              <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-white/50">
                Text overlays and filters are only available for files uploaded from your phone. Linked videos play directly from YouTube / TikTok.
              </p>
            )}

            {renderProgressBar()}
            {renderError()}
            {renderPublishButton()}
          </div>
        )}
      </div>
    </div>
  );
}
