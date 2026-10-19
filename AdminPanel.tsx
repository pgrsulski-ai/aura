import { useCallback, useEffect, useState } from 'react';
import { Shield, Trash2, RotateCcw, Flag, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import {
  fetchReportedPosts,
  adminDeletePost,
  adminRestorePost,
  type ReportedPost,
} from '@/postsApi';
import { parseVideoLink } from '@/lib/videoLink';

const REASON_LABELS: Record<string, string> = {
  copyright: 'Copyright',
  illegal: 'Illegal Content',
  nsfw: 'NSFW',
  harassment: 'Harassment',
  spam: 'Spam',
};

export function AdminPanel() {
  const [reportedPosts, setReportedPosts] = useState<ReportedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPostId, setActionPostId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const posts = await fetchReportedPosts();
      setReportedPosts(posts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (postId: string) => {
    setActionPostId(postId);
    try {
      const ok = await adminDeletePost(postId);
      if (ok) {
        setReportedPosts((prev) => prev.filter((p) => p.post_id !== postId));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete post.');
    } finally {
      setActionPostId(null);
    }
  };

  const handleRestore = async (postId: string) => {
    setActionPostId(postId);
    try {
      const ok = await adminRestorePost(postId);
      if (ok) {
        setReportedPosts((prev) => prev.filter((p) => p.post_id !== postId));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to restore post.');
    } finally {
      setActionPostId(null);
    }
  };

  return (
    <div className="px-5 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15">
          <Shield className="h-5 w-5 text-red-400" />
        </div>
        <div>
          <h2 className="font-display text-base font-bold text-white">Moderation</h2>
          <p className="text-[11px] text-white/40">
            {reportedPosts.length > 0
              ? `${reportedPosts.length} ${reportedPosts.length === 1 ? 'reported post' : 'reported posts'}`
              : 'No reports to review'}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-red-400" />
          <p className="mt-3 text-xs text-white/40">Loading reports...</p>
        </div>
      ) : reportedPosts.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="mb-3 rounded-full bg-white/5 p-5">
            <Shield className="h-7 w-7 text-white/30" />
          </div>
          <p className="text-sm font-semibold text-white/60">All clear</p>
          <p className="mt-1 text-xs text-white/40">No reported or hidden posts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reportedPosts.map((rp) => {
            const embedUrl = rp.media_url
              ? parseVideoLink(rp.media_url)?.embedUrl ?? null
              : null;
            return (
              <div
                key={rp.post_id}
                className={`rounded-2xl border p-3.5 ${
                  rp.is_hidden
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex gap-3">
                  {/* Video preview */}
                  <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
                    {embedUrl ? (
                      <iframe
                        src={embedUrl}
                        title={rp.track_title}
                        className="h-full w-full object-cover"
                        frameBorder={0}
                      />
                    ) : (
                      <video
                        src={rp.media_url}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    )}
                    {rp.is_hidden && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <EyeOff className="h-5 w-5 text-red-400" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-white">
                        {rp.track_title || 'Untitled'}
                      </p>
                      {rp.is_hidden && (
                        <span className="shrink-0 rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-red-400">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-white/50">
                      Author: <span className="font-semibold text-white/70">@{rp.handle}</span>
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Flag className="h-3 w-3 text-red-400" />
                      <span className="text-[11px] font-semibold text-red-400">
                        {rp.reports_count} {rp.reports_count === 1 ? 'report' : 'reports'}
                      </span>
                    </div>
                    {rp.report_reasons.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {rp.report_reasons.map((reason) => (
                          <span
                            key={reason}
                            className="rounded-full bg-white/8 px-2 py-0.5 text-[9px] font-medium text-white/60"
                          >
                            {REASON_LABELS[reason] ?? reason}
                          </span>
                        ))}
                      </div>
                    )}
                    {rp.caption && (
                      <p className="mt-1.5 line-clamp-2 text-[11px] text-white/40">{rp.caption}</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleRestore(rp.post_id)}
                    disabled={actionPostId === rp.post_id}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
Dismiss / Restore
                  </button>
                  <button
                    onClick={() => handleDelete(rp.post_id)}
                    disabled={actionPostId === rp.post_id}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 py-2.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {actionPostId === rp.post_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
Confirm / Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
