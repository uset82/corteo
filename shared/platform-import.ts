/** P3-2/P3-4: the platform hosts shared by the server route and the dialog. */
export const PLATFORM_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be',
  'vimeo.com', 'www.vimeo.com',
  'bilibili.com', 'www.bilibili.com', 'b23.tv', 'www.b23.tv',
]);

export interface PlatformTarget {
  readonly url: string;
  readonly host: string;
}

/** Parse and allowlist a platform page before anything is downloaded. */
export function platformTarget(raw: unknown): PlatformTarget {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('url is required');
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error('url must be an absolute http(s) URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('url must be an absolute http(s) URL');
  }
  if (parsed.username || parsed.password) throw new Error('url must not carry credentials');
  const host = parsed.hostname.toLowerCase();
  if (!PLATFORM_HOSTS.has(host)) {
    throw new Error(`unsupported platform host ${host}; use YouTube, Vimeo or Bilibili`);
  }
  return { url: parsed.toString(), host };
}
