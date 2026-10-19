// Client-side video optimization for Supabase Free tier (50MB storage limit).
// Downscles large/high-bitrate videos to a mobile-optimized vertical 1080p
// format using a canvas + MediaRecorder pipeline. Falls back to the original
// file if compression fails or the file is already small enough.

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // strict ceiling for compressed uploads
const COMPRESS_THRESHOLD = 12 * 1024 * 1024; // compress files larger than this
const SKIP_COMPRESS_CEILING = 14 * 1024 * 1024; // if already under this, send as-is
const TARGET_MAX_HEIGHT = 1280;
const TARGET_MAX_WIDTH = 720;

export interface CompressionResult {
  file: File;
  compressed: boolean;
}

export type ProgressCallback = (pct: number, label: string) => void;

function pickMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return 'video/webm';
}

function extForMime(mime: string): string {
  return mime.includes('mp4') ? 'mp4' : 'webm';
}

export function shouldCompress(file: File): boolean {
  return file.size > COMPRESS_THRESHOLD;
}

export async function maybeCompressVideo(
  file: File,
  onProgress?: ProgressCallback
): Promise<CompressionResult> {
  // Already small enough — send directly.
  if (file.size <= SKIP_COMPRESS_CEILING) {
    return { file, compressed: false };
  }
  if (!shouldCompress(file)) {
    return { file, compressed: false };
  }

  try {
    const result = await compressWithCanvas(file, onProgress);
    if (result && result.size <= MAX_UPLOAD_BYTES) {
      return {
        file: new File([result], `optimized.${extForMime(result.type)}`, { type: result.type }),
        compressed: true,
      };
    }
    // Compression didn't get small enough — retry once at lower bitrate.
    if (result) {
      const retry = await compressWithCanvas(file, onProgress, 800_000);
      if (retry && retry.size <= MAX_UPLOAD_BYTES) {
        return {
          file: new File([retry], `optimized.${extForMime(retry.type)}`, { type: retry.type }),
          compressed: true,
        };
      }
    }
    // Compression failed to produce a small-enough file. Send original —
    // Supabase will reject if over limit, which surfaces a clear error.
    return { file, compressed: false };
  } catch {
    return { file, compressed: false };
  }
}

async function compressWithCanvas(
  file: File,
  onProgress?: ProgressCallback,
  targetBitrate = 1_500_000
): Promise<Blob | null> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const url = URL.createObjectURL(file);
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Could not read video metadata'));
  });

  // Compute target dimensions, preserving aspect ratio, capped at vertical 1080p.
  const srcW = video.videoWidth;
  const srcH = video.videoHeight;
  if (!srcW || !srcH) {
    URL.revokeObjectURL(url);
    return null;
  }
  const scale = Math.min(TARGET_MAX_WIDTH / srcW, TARGET_MAX_HEIGHT / srcH, 1);
  const outW = Math.round(srcW * scale);
  const outH = Math.round(srcH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(url);
    return null;
  }

  const mimeType = pickMimeType();
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: targetBitrate,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const durationMs = (video.duration || 0) * 1000;

  return new Promise<Blob | null>((resolve) => {
    recorder.onstop = () => {
      URL.revokeObjectURL(url);
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob.size > 0 ? blob : null);
    };

    recorder.start();

    let raf = 0;
    const draw = () => {
      ctx.drawImage(video, 0, 0, outW, outH);
      if (durationMs > 0 && onProgress) {
        const pct = Math.min(99, Math.round((video.currentTime / video.duration) * 100));
        onProgress(pct, 'Optymalizacja...');
      }
      if (!video.ended && !video.paused) {
        raf = requestAnimationFrame(draw);
      }
    };

    video.onplay = () => { raf = requestAnimationFrame(draw); };
    video.onended = () => {
      cancelAnimationFrame(raf);
      if (onProgress) onProgress(100, 'Optymalizacja...');
      // Give the recorder a beat to flush final frames.
      setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 150);
    };
    video.onerror = () => {
      cancelAnimationFrame(raf);
      URL.revokeObjectURL(url);
      if (recorder.state !== 'inactive') recorder.stop();
      resolve(null);
    };

    video.play().catch(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    });

    // Safety: if the video has no duration or stalls, stop after 90s.
    setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, 90_000);
  });
}
