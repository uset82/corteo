import type { AgentContext } from '../context';
import { captionsOnTrack, defaultTrackId, resolveTrackId } from '../../editor/types';
import { importSubtitleCues, newManualCaptions } from '../../captions/manualCaptions';
import { parseSubtitleFile } from '../../captions/subtitleImport';
import { CAPTION_STYLE_BY_ID } from '../../captions/styles';
import type { CaptionsData, CaptionTemplate } from '../../captions/types';

type Args = Record<string, unknown>;

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// import_subtitles: parse an SRT/ASS/SSA/VTT file into a manual caption lane.
// Imported cues are absolute timeline ms — the same contract manual lanes use —
// so they survive preview/export exactly like hand-placed captions and never
// touch the transcript.
export function importSubtitles(args: Args, ctx: AgentContext): Record<string, unknown> {
  const content = typeof args.content === 'string' ? args.content : '';
  if (!content.trim()) {
    return { error: 'import_subtitles needs content: the subtitle file text (SRT/ASS/SSA/VTT)' };
  }
  const filename = str(args.filename) || `subtitles.${str(args.format) || 'srt'}`;
  let parsed;
  try {
    parsed = parseSubtitleFile(filename, content);
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : String(cause) };
  }

  const s = ctx.getState();
  const requested = str(args.captionTrackId) || str(args.captionsItemId);
  const target = requested ? resolveTrackId(s, requested, 'caption') : defaultTrackId(s, 'caption');
  if (requested && !target) return { error: `no caption track ${requested}` };
  if (!target) return { error: 'no caption track; add one from the timeline first' };

  const existing = captionsOnTrack(s, target);
  const requestedTemplate = str(args.templatePreset);
  const template: CaptionTemplate = requestedTemplate in CAPTION_STYLE_BY_ID
    ? requestedTemplate as CaptionTemplate
    : existing?.template ?? 'black-bar';
  const base: CaptionsData = existing ?? { ...newManualCaptions(), template };
  const mode = str(args.mode) === 'append' ? 'append' as const : 'replace' as const;
  const label = str(args.label) || filename.replace(/\.[a-z0-9]+$/i, '');
  const next: CaptionsData = {
    ...base,
    ...importSubtitleCues(base, s.items, parsed.words, { mode, label }),
    enabled: true,
    ...(requestedTemplate ? { template } : {}),
  };

  const commands = {
    ...ctx.commands,
    setCaptions: (captions: CaptionsData | null) => ctx.commands.setCaptions(captions, target),
    updateCaptions: (patch: Partial<CaptionsData>) => ctx.commands.updateCaptions(patch, target),
  };
  if (existing) commands.updateCaptions(next);
  else commands.setCaptions(next);

  return {
    ok: true,
    format: parsed.format,
    cues: parsed.words.length,
    mode,
    captionTrackId: target,
    template: next.template,
    label,
    firstCueMs: parsed.words[0]!.start,
    lastCueMs: parsed.words[parsed.words.length - 1]!.end,
  };
}
