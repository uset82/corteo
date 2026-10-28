import type { AgentContext } from '../context';
import { directoryFileToAsset } from '../../media/directoryImportAsset';
import type { DirectoryImportedFile } from '../../../shared/directory-import';

type Args = Record<string, unknown>;

interface PlatformDone {
  type: 'done';
  file: {
    name: string;
    src: string;
    storedName: string;
    contentHash: string;
    kind: DirectoryImportedFile['kind'];
    size: number;
    durationSeconds?: number;
    sourceModifiedAt: number;
    width?: number;
    height?: number;
    sourceFps?: number;
  };
  title: string;
  uploader?: string;
  license?: string;
  sourceUrl: string;
  platform: string;
}

/**
 * Browser executor: the route streams NDJSON progress from yt-dlp, then returns
 * the imported upload descriptor. The asset is added to the pool in one command.
 */
export async function execPlatformImportTool(name: string, args: Args, ctx: AgentContext): Promise<unknown> {
  if (name !== 'import_from_platform') return { error: `unknown tool ${name}` };
  const url = typeof args.url === 'string' ? args.url.trim() : '';
  if (!url) return { error: 'url is required' };
  const knownHashes = ctx.getDoc().assets
    .map((asset) => asset.sourceContentHash)
    .filter((hash): hash is string => typeof hash === 'string' && hash.length > 0);
  let response: Response;
  try {
    response = await fetch('/api/import-platform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        knownHashes,
        ...(typeof args.startSeconds === 'number' ? { startSeconds: args.startSeconds } : {}),
        ...(typeof args.endSeconds === 'number' ? { endSeconds: args.endSeconds } : {}),
        ...(typeof args.name === 'string' && args.name.trim() ? { name: args.name.trim() } : {}),
      }),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.includes('ndjson')) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    return { error: body?.error ?? `platform import failed (${response.status})` };
  }
  if (!response.body) return { error: 'platform import returned no progress stream' };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done: PlatformDone | null = null;
  try {
    for (;;) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let event: Record<string, unknown>;
        try { event = JSON.parse(line) as Record<string, unknown>; } catch { continue; }
        if (event.type === 'progress' && typeof event.percent === 'number') {
          ctx.onToolProgress?.(`Descargando de la plataforma… ${Math.round(event.percent)}%`);
        } else if (event.type === 'error') {
          return { error: typeof event.error === 'string' ? event.error : 'platform import failed' };
        } else if (event.type === 'done') {
          done = event as unknown as PlatformDone;
        }
      }
      if (chunk.done) break;
    }
  } finally {
    reader.releaseLock();
  }
  if (!done) return { error: 'platform import finished without a file' };
  const state = ctx.getState();
  const asset = await directoryFileToAsset({ ...done.file, importId: crypto.randomUUID() }, state.fps);
  asset.source = {
    title: done.title,
    ...(done.uploader ? { uploader: done.uploader } : {}),
    pageUrl: done.sourceUrl,
    ...(done.license ? { license: done.license } : {}),
  };
  ctx.commands.addAsset(asset);
  return {
    ok: true,
    asset: { id: asset.id, name: asset.name, kind: asset.kind, src: asset.src, sourceContentHash: asset.sourceContentHash },
    title: done.title,
    sourceUrl: done.sourceUrl,
    platform: done.platform,
    ...(done.uploader ? { uploader: done.uploader } : {}),
    ...(done.license ? { license: done.license } : {}),
  };
}
