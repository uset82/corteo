export { EMPHASIS_TOOL_SCHEMAS, EMPHASIS_TOOL_NAMES } from './schemas/emphasis-tools';
import type { AgentContext } from '../context';
import { resolveCaptionProjection } from '../../captions/resolve';
import { emphasisOverrides, keywordCandidates } from '../../captions/keywordEmphasis';
import type { CaptionsData } from '../../captions/types';

// emphasize_keywords — Plan 5, OP-08.
//
// The channel (TranscriptWord.emphasis → CaptionsLayer) and the judgement
// (keywordCandidates) already exist and are tested separately. This tool is the join: it reads
// the caption projection of the active timeline, picks the words, and writes the overrides in
// ONE updateCaptions call, so the whole thing is one undo step.

type Args = Record<string, unknown>;

export async function execEmphasisTool(name: string, args: Args, ctx: AgentContext): Promise<unknown> {
  if (name !== 'emphasize_keywords') return { error: `unknown tool ${name}` };

  const state = ctx.getState();
  const captions: CaptionsData | null | undefined = state.captions;
  if (!captions || captions.enabled === false) {
    return {
      error: 'Los subtítulos están desactivados en esta secuencia. Actívalos con edit_captions action=enable '
        + 'y vuelve a pedir el énfasis.',
    };
  }

  const projection = resolveCaptionProjection(captions, state.items, state.fps);
  const max = Number.isInteger(args.max) ? Math.max(1, Math.min(30, Number(args.max))) : 8;
  const candidates = keywordCandidates(projection.words, max);

  if (args.apply === false) {
    return {
      ok: true,
      applied: false,
      candidates,
      note: candidates.length
        ? `${candidates.length} palabra(s) se marcarían. Muéstrale la lista al usuario y repite sin apply:false para aplicarla.`
        : 'No hay cifras, nombres ni mayúsculas que enfatizar en estos subtítulos.',
    };
  }

  if (!candidates.length) {
    return { ok: true, applied: false, candidates: [], note: 'No hay cifras, nombres ni mayúsculas que enfatizar.' };
  }

  const merged = emphasisOverrides(
    captions.wordOverrides as unknown as Record<string, unknown> | undefined,
    candidates,
  );
  ctx.commands.updateCaptions({ wordOverrides: merged as unknown as CaptionsData['wordOverrides'] });

  return {
    ok: true,
    applied: true,
    count: candidates.length,
    candidates,
    note: `Enfatizadas ${candidates.length} palabra(s) en un solo paso de deshacer.`,
  };
}
