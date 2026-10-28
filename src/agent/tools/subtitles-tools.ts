// import_subtitles: a subtitle file on disk → a manual caption track. SRT, ASS
// and VTT all parse through captions/subtitles.ts, and ASS karaoke lines keep
// their word timings, so the overlay lights up word by word. The host reads the
// file — the editor server in-process for the offline MCP/occ paths, or the
// same-origin local-media route for a browser tab — so nothing here touches fs
// from the renderer. The schema is in schemas/subtitles-tools.ts.
import type { AgentContext } from '../context';
import { captionsOnTrack, resolveTrackId } from '../../editor/types';
import { parseSubtitles, subtitleFormatFromName, type SubtitleFormat } from '../../captions/subtitles';
import { subtitleTrackName, withSubtitleLane } from '../../captions/subtitleImport';
import { readLocalTextFileOverHttp } from '../../media/localMediaServerApi';

export { SUBTITLES_TOOL_NAMES, SUBTITLES_TOOL_SCHEMAS } from './schemas/subtitles-tools';

type Args = Record<string, unknown>;

/** What the host has to provide: the bytes of a local file, as text. */
export interface SubtitleTextSource {
  readTextFile(path: string): Promise<string>;
}

/** Browser host: the route a plain tab can reach, gated by AGENT_IMPORT_ROOTS
 *  exactly like the media import tools. Non-browser hosts (offline MCP, occ)
 *  pass their own reader and never reach this. */
function hostSource(): SubtitleTextSource | null {
  if (typeof window === 'undefined') return null;
  return { readTextFile: async (path) => (await readLocalTextFileOverHttp(path)).text };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function subtitleFormat(value: unknown): SubtitleFormat | undefined | null {
  if (value === undefined) return undefined;
  return value === 'srt' || value === 'ass' || value === 'vtt' ? value : null;
}

export async function execImportSubtitlesTool(
  name: string,
  args: Args,
  ctx: AgentContext,
  source: SubtitleTextSource | null = hostSource(),
): Promise<Record<string, unknown>> {
  if (name !== 'import_subtitles') return { error: `unknown tool ${name}` };
  const path = typeof args.path === 'string' ? args.path.trim() : '';
  if (!path) return { error: 'path is required: the absolute path of the subtitle file' };
  const format = subtitleFormat(args.format);
  if (format === null) return { error: 'format must be srt, ass or vtt' };
  if (!source) {
    return { error: 'import_subtitles needs a host that can read a local file; run it with the editor server' };
  }
  let text: string;
  try {
    text = await source.readTextFile(path);
  } catch (error) {
    return { error: message(error) };
  }
  let words;
  try {
    words = parseSubtitles(path, text, format);
  } catch (error) {
    return { error: message(error) };
  }
  const state = ctx.getState();
  const requested = typeof args.captionTrackId === 'string' ? args.captionTrackId.trim() : '';
  const target = requested ? resolveTrackId(state, requested, 'caption') : null;
  if (requested && !target) return { error: `no caption track ${requested}` };
  const trackName = subtitleTrackName(fileName(path));
  const plan = withSubtitleLane(
    target ? captionsOnTrack(state, target) ?? null : null,
    state.items,
    trackName,
    words,
  );
  // One command each, so the import is a single undo step either way.
  const captionTrackId = target ?? ctx.commands.createCaptionTrack(plan.captions, { name: trackName });
  if (target) ctx.commands.setCaptions(plan.captions, target);
  return {
    ok: true,
    captionTrackId,
    name: trackName,
    format: format ?? subtitleFormatFromName(path),
    laneId: plan.laneId,
    wordCount: words.length,
    startMs: words[0]!.start,
    endMs: words[words.length - 1]!.end,
    ...(target ? { addedTo: target } : { createdTrack: true }),
  };
}
