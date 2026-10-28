import { existsSync, statSync } from 'node:fs';
import { basename, extname, isAbsolute } from 'node:path';
import { flagText, rejectUnknownFlags, type CommandLine } from '../args.ts';
import { UsageError } from '../errors.ts';
import { loadHostProfile } from '../host-profile.ts';
import { printJson, writeStdout } from '../output.ts';
import { placeSongFilm } from '../song-film/run.ts';
import { parseFrames, parseSize, positiveInteger } from './common.ts';

export async function runSongFilmCommand(line: CommandLine, json: boolean): Promise<void> {
  rejectUnknownFlags(line, ['audio', 'lyrics-text', 'stills', 'size', 'fps', 'from', 'to', 'name', 'host', 'json', 'help', 'data-dir']);
  const audio = flagText(line, 'audio');
  if (!audio || !isAbsolute(audio) || !existsSync(audio) || !statSync(audio).isFile()) {
    throw new UsageError('song-film needs an absolute --audio path that exists');
  }
  const stills = (flagText(line, 'stills') ?? '').split(',').filter(Boolean);
  for (const path of stills) {
    if (!isAbsolute(path) || !existsSync(path) || !statSync(path).isFile()) throw new UsageError(`--stills must be absolute paths that exist: ${path}`);
  }
  const host = flagText(line, 'host');
  const profile = host ? loadHostProfile(host) : undefined;
  const [width, height] = flagText(line, 'size') ? parseSize(flagText(line, 'size')!) : [profile?.defaultShort.width ?? 1080, profile?.defaultShort.height ?? 1920];
  const fps = flagText(line, 'fps') ? positiveInteger(flagText(line, 'fps')!, 'fps') : profile?.defaultShort.fps ?? 30;
  const result = await placeSongFilm({
    audio, stills, width, height, fps, lyricsText: flagText(line, 'lyrics-text'),
    name: flagText(line, 'name') ?? basename(audio, extname(audio)),
    fromFrame: parseFrames(flagText(line, 'from') ?? '0', fps, 'from'),
    toFrame: parseFrames(flagText(line, 'to') ?? '30s', fps, 'to'),
  });
  if (json) printJson(result); else writeStdout(JSON.stringify(result, null, 2));
}
