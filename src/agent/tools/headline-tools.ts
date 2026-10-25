export { HEADLINE_TOOL_SCHEMAS, HEADLINE_TOOL_NAMES } from './schemas/headline-tools';
import type { AgentContext } from '../context';
import { msToFrame } from '../../transcript/types';
import { generateHeadline, setHeadlineScorer } from '../shorts/headline';
import { pickTranscribedItem } from '../shorts/transcript-item';

// write_clip_title — OpusClip's auto headline, as one title clip.
//
// `addTextClip` is a single command, so this tool is one undo step by construction: no batch,
// no gesture. The wording comes from the model when one answers, from the clip's own opening
// sentence otherwise. Placement is the text track's default (centred); moving it into the
// caption safe zone needs the geometry placement pass, which is a separate tool's job.

export { setHeadlineScorer };

type Args = Record<string, unknown>;

export async function execHeadlineTool(name: string, args: Args, ctx: AgentContext): Promise<unknown> {
  if (name !== 'write_clip_title') return { error: `unknown tool ${name}` };

  const state = ctx.getState();
  const item = pickTranscribedItem(state.items, typeof args.itemId === 'string' ? args.itemId : undefined);
  if (!item || !item.transcript?.length) {
    return {
      error: 'No hay ningún clip transcrito en esta secuencia. Transcribe primero con transcribe_track '
        + 'o escribe el titular a mano.',
    };
  }

  const words = item.transcript;
  const hasRange = Number.isInteger(args.startWord) && Number.isInteger(args.endWord);
  const from = hasRange ? Math.max(0, Math.min(words.length - 1, Number(args.startWord))) : 0;
  const to = hasRange ? Math.max(from, Math.min(words.length - 1, Number(args.endWord))) : words.length - 1;
  const text = words.slice(from, to + 1).map((word) => word.text.trim()).join(' ');

  const maxWords = Number.isInteger(args.maxWords) ? Math.max(2, Math.min(10, Number(args.maxWords))) : 6;
  const fontSize = Number.isFinite(Number(args.fontSize)) ? Math.max(24, Math.min(200, Number(args.fontSize))) : 72;
  const seconds = Number.isFinite(Number(args.seconds)) ? Math.max(1, Math.min(15, Number(args.seconds))) : 4;

  const { headline, modelUsed } = await generateHeadline(text, { maxWords });
  if (!headline) {
    return { ok: false, error: 'El momento no tiene texto suficiente para un titular.', modelUsed };
  }

  if (args.apply === false) {
    return { ok: true, applied: false, headline, modelUsed, note: 'Titular propuesto. Repite sin apply:false para crearlo.' };
  }

  const startFrame = item.startFrame + msToFrame(Math.max(0, words[from].start), state.fps);
  const durationInFrames = Math.max(1, Math.round(seconds * state.fps));
  const id = ctx.commands.addTextClip({
    startFrame,
    durationInFrames,
    text: headline,
    fontSize,
    fontWeight: 800,
    align: 'center',
    color: '#ffffff',
    name: 'Titular',
  });

  return {
    ok: true,
    applied: true,
    itemId: id,
    headline,
    modelUsed,
    startFrame,
    durationInFrames,
    note: modelUsed
      ? 'Titular creado. Un solo paso de deshacer lo quita.'
      : 'Sin modelo: se usó la primera frase del clip. Revísala antes de publicar.',
  };
}
