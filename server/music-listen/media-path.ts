// Resolve a headless session's clip src to a local file. Mirrors
// server/external-agent/jianying-export.ts:resolveMediaPath without pulling the
// capcut-cli command layer into the music runner's import graph.
import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { uploadNameOfSource, uploadReadDirs } from '../media-dir.ts';
import { resolveMediaReference } from '../media-references.ts';

/** Dev / worktree upload root; isolated profiles read only their own store but
 * dev media commonly lives here too. */
const WORKTREE_UPLOAD_DIR = join(process.cwd(), 'public', 'media', 'uploads');

export function resolveMusicMediaPath(
  src: string,
  options: { mediaDir?: string } = {},
): string | undefined {
  const clean = String(src || '').trim();
  if (!clean) return undefined;
  const name = uploadNameOfSource(clean);
  if (name) {
    const roots = [...new Set([...uploadReadDirs(undefined, options.mediaDir), WORKTREE_UPLOAD_DIR])];
    for (const dir of roots) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
      // Path imports keep the master on disk and store a pointer here.
      const referenced = resolveMediaReference(dir, name);
      if (referenced) return referenced;
    }
    return undefined;
  }
  if (isAbsolute(clean) && existsSync(clean)) return clean;
  return undefined;
}
