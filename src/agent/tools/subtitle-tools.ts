import type { AgentContext } from '../context';
import { parseSubtitles } from '../../captions/import';
import { newManualCaptions } from '../../captions/manualCaptions';

type Args = Record<string, unknown>;

const MAX_CONTENT = 2 * 1024 * 1024;

/** import_subtitles: pure parsing plus one caption-track command batch. */
export async function execSubtitleTool(name: string, args: Args, ctx: AgentContext): Promise<unknown> {
  if (name !== 'import_subtitles') return { error: `unknown tool ${name}` };
  const content = typeof args.content === 'string' ? args.content : '';
  if (!content.trim()) return { error: 'content is required (the subtitle file text)' };
  if (content.length > MAX_CONTENT) return { error: 'subtitle content is too large (2 MB max)' };
  let parsed;
  try {
    parsed = parseSubtitles(content, args.format);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  const label = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : 'Subtítulos';
  const entryId = `sub_${crypto.randomUUID()}`;
  const trackId = ctx.commands.createCaptionTrack({
    ...newManualCaptions(),
    ...(parsed.format === 'ass' ? { template: 'verso' as const, pacing: 'word' as const } : {}),
    sourceEntries: [{ id: entryId, itemId: `manual:${entryId}`, label, words: parsed.words }],
  }, { name: label });
  return {
    ok: true,
    trackId,
    format: parsed.format,
    name: label,
    words: parsed.words.length,
    durationMs: parsed.words[parsed.words.length - 1]?.end ?? 0,
  };
}
