import { useRef, useState } from 'react';
import { X, Camera, Check, Loader2, AlertCircle } from 'lucide-react';
import type { CurrentUser } from '@/types';
import { uploadAvatar } from '@/postsApi';

interface EditProfileModalProps {
  user: CurrentUser;
  userId?: string;
  onSave: (user: CurrentUser) => void;
  onClose: () => void;
}

export function EditProfileModal({ user, userId, onSave, onClose }: EditProfileModalProps) {
  const [handle, setHandle] = useState(user.handle);
  const [bio, setBio] = useState(user.bio);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [avatarLetter, setAvatarLetter] = useState(user.avatar);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarUrl(url);
      setAvatarLetter('');
      setAvatarFile(file);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      let finalAvatarUrl = avatarUrl;
      if (avatarFile && userId) {
        finalAvatarUrl = await uploadAvatar(avatarFile, userId);
      }
      const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
      onSave({
        handle: cleanHandle,
        bio,
        avatar: avatarLetter || cleanHandle.charAt(1)?.toUpperCase() || 'A',
        avatarUrl: finalAvatarUrl,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile.';
      setError(msg);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={onClose} />
      <div className="relative mt-auto flex max-h-[85%] flex-col rounded-t-3xl border-t border-white/10 bg-neutral-900 animate-slide-up">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={onClose} className="text-white/60">
            <X className="h-5 w-5" />
          </button>
          <h3 className="font-display text-base font-bold text-white">Edit Profile</h3>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 rounded-full bg-neon px-3 py-1.5 text-xs font-bold text-neutral-950 neon-glow disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving
              </>
            ) : (
              <>
                <Check className="h-4 w-4" /> Save
              </>
            )}
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="group relative h-24 w-24 rounded-full bg-gradient-to-br from-neon to-emerald-700 p-[3px]"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-neutral-900 text-3xl font-bold text-white">
                  {avatarLetter}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-6 w-6 text-white" />
              </div>
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xs font-semibold text-neon"
            >
              Change Avatar
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
            />
          </div>

          {/* Handle */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
              Handle
            </label>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-400 outline-none focus:border-neon/60 focus:ring-2 focus:ring-neon/50"
              placeholder="@yourhandle"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={160}
              className="w-full resize-none rounded-md border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-400 outline-none focus:border-neon/60 focus:ring-2 focus:ring-neon/50"
              placeholder="Tell the world about your sound..."
            />
            <p className="mt-1 text-right text-[10px] text-white/40">{bio.length}/160</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
