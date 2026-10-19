// Parses pasted video URLs from YouTube (including Shorts) and TikTok.
// Returns a normalized embed URL plus the source platform, or null if the
// URL isn't recognized.

export interface ParsedVideoLink {
  embedUrl: string;
  platform: 'youtube' | 'tiktok';
  originalUrl: string;
}

export function parseVideoLink(raw: string): ParsedVideoLink | null {
  const url = normalizeUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, '');

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    if (id) return { embedUrl: youtubeEmbed(id), platform: 'youtube', originalUrl: raw.trim() };
  }

  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    // /shorts/<id> or /watch?v=<id> or /embed/<id>
    const shorts = url.pathname.match(/^\/shorts\/([^/?#]+)/);
    if (shorts) return { embedUrl: youtubeEmbed(shorts[1]), platform: 'youtube', originalUrl: raw.trim() };
    const embed = url.pathname.match(/^\/embed\/([^/?#]+)/);
    if (embed) return { embedUrl: youtubeEmbed(embed[1]), platform: 'youtube', originalUrl: raw.trim() };
    const v = url.searchParams.get('v');
    if (v) return { embedUrl: youtubeEmbed(v), platform: 'youtube', originalUrl: raw.trim() };
  }

  if (host.endsWith('tiktok.com')) {
    // TikTok doesn't offer a public iframe embed URL that works reliably
    // without their JS SDK, so we keep the original URL and render it in an
    // iframe pointed at the permalink. TikTok serves a mobile-friendly page.
    return { embedUrl: url.toString(), platform: 'tiktok', originalUrl: raw.trim() };
  }

  return null;
}

function normalizeUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
}

function youtubeEmbed(id: string): string {
  // Use privacy-enhanced domain; enable muted autoplay + loop via query params.
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    loop: '1',
    playlist: id,
    controls: '0',
    rel: '0',
    playsinline: '1',
    modestbranding: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}
