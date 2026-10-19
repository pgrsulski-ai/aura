import { useState } from 'react';
import { X, Pencil, Save } from 'lucide-react';
import type { Post } from '@/types';

interface EditTrackModalProps {
  post: Post;
  onClose: () => void;
  onSave: (postId: string, trackTitle: string, caption: string) => void;
}

export function EditTrackModal({ post, onClose, onSave }: EditTrackModalProps) {
  const [trackTitle, setTrackTitle] = useState(post.trackTitle);
  const [caption, setCaption] = useState(post.caption);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!trackTitle.trim()) return;
    setSaving(true);
    setTimeout(() => {
      onSave(post.id, trackTitle.trim(), caption.trim());
      setSaving(false);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/80 animate-fade-in" onClick={onClose} />
      <div className="relative mt-auto flex max-h-[70%] flex-col rounded-t-3xl border-t border-neon/20 bg-neutral-900 animate-slide-up">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neon/40" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <button onClick={onClose} className="text-white/60">
            <X className="h-5 w-5" />
          </button>
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-white">
            <Pencil className="h-4 w-4 text-neon" /> EDIT TRACK
          </h3>
          <div className="w-5" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
              Track Title
            </label>
            <input
              value={trackTitle}
              onChange={(e) => setTrackTitle(e.target.value)}
              className="w-full rounded-xl bg-neutral-950 border border-neutral-700 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-neon/50"
              placeholder="Track title"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
              Caption
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              maxLength={200}
              className="w-full resize-none rounded-xl bg-neutral-950 border border-neutral-700 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-neon/50"
              placeholder="Describe your track..."
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!trackTitle.trim() || saving}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all ${
              trackTitle.trim() && !saving
                ? 'bg-neon text-neutral-950 neon-glow'
                : 'bg-white/10 text-white/30'
            }`}
          >
            {saving ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
