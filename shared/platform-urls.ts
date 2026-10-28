// Platforms yt-dlp may download from. Shared by the browser (the tool and the
// dialog decide between /api/import-platform and /api/import-url) and by the
// server route, so both sides agree on what "a platform link" is.

export const PLATFORM_HOSTS = ['youtube.com', 'youtu.be', 'vimeo.com', 'bilibili.com', 'b23.tv'] as const;

export type PlatformHost = (typeof PLATFORM_HOSTS)[number];

/** The allowlisted domain a URL belongs to, or null. `www.` subdomains match;
 * lookalikes (`notyoutube.com`, `youtube.com.evil.test`) do not. */
export function platformHostOf(raw: string): PlatformHost | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  for (const allowed of PLATFORM_HOSTS) {
    if (host === allowed || host.endsWith(`.${allowed}`)) return allowed;
  }
  return null;
}

export function isPlatformUrl(raw: string): boolean {
  return platformHostOf(raw) !== null;
}
