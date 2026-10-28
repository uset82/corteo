import type { MediaAsset } from '../editor/types';
import { sniffKind } from '../agent/tools/stock-url-utils';
import { platformTarget } from '../../shared/platform-import';

export type ImportLinkTarget =
  | { kind: 'platform'; url: string; host: string }
  | { kind: 'direct'; url: string; host: string };

/** Platform page vs. direct file URL; the dialog and the route share the allowlist. */
export function classifyImportLink(raw: string): ImportLinkTarget {
  const value = raw.trim();
  if (!value) throw new Error('Pega un enlace primero.');
  try {
    const target = platformTarget(value);
    return { kind: 'platform', ...target };
  } catch (error) {
    if (error instanceof Error && error.message === 'url is required') throw error;
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('El enlace no es una URL válida.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('El enlace debe empezar por http:// o https://.');
  }
  if (parsed.username || parsed.password) throw new Error('El enlace no puede llevar credenciales.');
  return { kind: 'direct', url: parsed.toString(), host: parsed.hostname.toLowerCase() };
}

export interface ImportUrlResponse {
  ok?: boolean;
  path?: string;
  filename?: string;
  contentHash?: string;
  error?: string;
  probe?: {
    durationSeconds?: number;
    width?: number;
    height?: number;
  };
}

/** Build a pool asset from /api/import-url's response (direct file URL). */
export function directImportAsset(response: ImportUrlResponse, requestedUrl: string, fps: number): MediaAsset {
  if (!response.ok || typeof response.path !== 'string' || !response.path.startsWith('/media/')) {
    throw new Error(response.error ?? 'La descarga no devolvió un archivo de medios.');
  }
  const sourceFilename = response.filename?.trim() || new URL(requestedUrl).pathname.split('/').pop() || 'media';
  const kind = sniffKind(sourceFilename) ?? sniffKind(requestedUrl);
  if (!kind || kind === 'motion-graphic') throw new Error('El archivo descargado no es un medio compatible.');
  const seconds = response.probe?.durationSeconds;
  const durationInFrames = Math.max(1, Math.round((typeof seconds === 'number' && seconds > 0
    ? seconds
    : kind === 'image' ? 5 : 30) * fps));
  return {
    id: `asset_${crypto.randomUUID()}`,
    name: sourceFilename,
    sourceFilename,
    kind,
    src: response.path,
    durationInFrames,
    ...(response.contentHash ? { sourceContentHash: response.contentHash } : {}),
    ...(typeof response.probe?.width === 'number' && response.probe.width > 0 ? { width: response.probe.width } : {}),
    ...(typeof response.probe?.height === 'number' && response.probe.height > 0 ? { height: response.probe.height } : {}),
  };
}
