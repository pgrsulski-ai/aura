import { useState } from 'react';
import { Flag, X, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

interface ReportModalProps {
  postId: string;
  onClose: () => void;
  onSubmitted: (postId: string, hidden: boolean) => void;
  onAlreadyReported: () => void;
}

const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'copyright', label: 'Copyright / Rights Infringement' },
  { value: 'illegal', label: 'Illegal or Dangerous Content' },
  { value: 'nsfw', label: 'Adult Content (NSFW)' },
  { value: 'harassment', label: 'Hate Speech / Harassment' },
  { value: 'spam', label: 'Spam or Scam' },
];

export function ReportModal({ postId, onClose, onSubmitted, onAlreadyReported }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    setError(null);
    try {
      const { submitReport } = await import('@/postsApi');
      const result = await submitReport(postId, selectedReason, details.trim() || undefined);
      if (!result.ok) {
        setError('Failed to submit report. Please try again.');
        return;
      }
      if (result.alreadyReported) {
        onAlreadyReported();
      } else {
        onSubmitted(postId, result.hidden);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col">
      <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={onClose} />

      <div className="relative mt-auto flex max-h-[80%] flex-col rounded-t-3xl border-t border-red-500/20 bg-neutral-900 animate-slide-up">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-red-400" />
            <span className="text-sm font-semibold text-white">Report Content</span>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-xs text-white/50">
            Select a reason for your report. Our team will review the content and take appropriate action.
          </p>

          <div className="space-y-2">
            {REPORT_REASONS.map((reason) => (
              <button
                key={reason.value}
                onClick={() => setSelectedReason(reason.value)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                  selectedReason === reason.value
                    ? 'border-red-500/50 bg-red-500/10 text-white'
                    : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                    selectedReason === reason.value
                      ? 'border-red-400 bg-red-400'
                      : 'border-white/30'
                  }`}
                >
                  {selectedReason === reason.value && (
                    <span className="h-2 w-2 rounded-full bg-neutral-900" />
                  )}
                </span>
                <span className="flex-1">{reason.label}</span>
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
              Additional Details (Optional)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-red-500/30"
              placeholder="Add details that may help with the review..."
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-5 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedReason || submitting}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all ${
              selectedReason && !submitting
                ? 'border border-red-500/50 bg-red-500/15 text-red-400 hover:bg-red-500/25'
                : 'border border-white/10 bg-white/5 text-white/30'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Flag className="h-4 w-4" />
                Submit Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReportSuccessToast({ message }: { message: string }) {
  return (
    <div className="fixed top-6 left-1/2 z-[101] -translate-x-1/2 animate-fade-in">
      <div className="flex items-center gap-2.5 rounded-xl border border-neon/40 bg-neutral-900 px-4 py-3 shadow-2xl shadow-neon/20">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-neon" />
        <p className="text-sm font-bold text-white">
          {message}
        </p>
      </div>
    </div>
  );
}
