import { X, Settings as SettingsIcon, Trash2, Music2, PlayCircle } from 'lucide-react';
import type { Settings } from '@/types';

interface SettingsModalProps {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
  onClearData: () => void;
}

export function SettingsModal({ settings, onChange, onClose, onClearData }: SettingsModalProps) {
  const Toggle = ({
    label,
    description,
    icon,
    value,
    onToggle,
  }: {
    label: string;
    description: string;
    icon: React.ReactNode;
    value: boolean;
    onToggle: () => void;
  }) => (
    <div className="flex items-center justify-between rounded-2xl bg-white/5 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-neon/10 p-2.5 text-neon">{icon}</div>
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-[11px] text-white/50">{description}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`relative h-7 w-12 rounded-full transition-colors ${
          value ? 'bg-neon' : 'bg-white/15'
        }`}
        aria-pressed={value}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
            value ? 'left-6' : 'left-1'
          }`}
        />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={onClose} />
      <div className="relative mt-auto flex max-h-[80%] flex-col rounded-t-3xl border-t border-white/10 bg-neutral-900 animate-slide-up">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <button onClick={onClose} className="text-white/60">
            <X className="h-5 w-5" />
          </button>
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-white">
            <SettingsIcon className="h-4 w-4 text-neon" /> Settings
          </h3>
          <div className="w-5" />
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Audio</p>
          <Toggle
            label="Lossless Audio"
            description="Stream at full quality (uses more data)"
            icon={<Music2 className="h-5 w-5" />}
            value={settings.losslessAudio}
            onToggle={() => onChange({ ...settings, losslessAudio: !settings.losslessAudio })}
          />
          <Toggle
            label="Background Play"
            description="Keep audio playing when app is backgrounded"
            icon={<PlayCircle className="h-5 w-5" />}
            value={settings.backgroundPlay}
            onToggle={() => onChange({ ...settings, backgroundPlay: !settings.backgroundPlay })}
          />

          <div className="pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Danger Zone</p>
            <button
              onClick={onClearData}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 py-3.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4" /> Clear App Data
            </button>
            <p className="mt-2 text-center text-[10px] text-white/40">
              Removes all cached data and resets the app to defaults.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
