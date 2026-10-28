// Offline host: read the subtitle file in-process. The same path gate the media
// import uses (AGENT_IMPORT_ROOTS when it is set), plus a size cap so a huge
// file cannot be pulled into a tool result.
import { readFile, stat } from 'node:fs/promises';
import { resolveAgentMediaPath } from '../local-path-import.ts';

const MAX_SUBTITLE_BYTES = 2 * 1024 * 1024;

export async function readLocalSubtitleFile(path: string): Promise<string> {
  const resolved = await resolveAgentMediaPath(path);
  const info = await stat(resolved);
  if (!info.isFile()) throw new Error('path is not a file');
  if (info.size > MAX_SUBTITLE_BYTES) {
    throw new Error(`subtitle file is larger than ${MAX_SUBTITLE_BYTES} bytes`);
  }
  return readFile(resolved, 'utf8');
}
