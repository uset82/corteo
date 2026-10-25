export { KEN_BURNS_TOOL_SCHEMAS, KEN_BURNS_TOOL_NAMES } from './schemas/ken-burns-tools';
import type { AgentContext } from '../context';
import {
  KEN_BURNS_DIRECTIONS,
  kenBurnsActions,
  type KenBurnsDirection,
} from '../../editor/kenBurns';
import type { TimelineItem } from '../../editor/types';

// apply_ken_burns — Plan 1, Phase 2 (P2-1).
//
// The generator (src/editor/kenBurns.ts) is pure and tested on its own; this module
// is the join with the editor: resolve the clip, refuse what Ken Burns cannot move,
// and commit every keyframe in one batch so the whole move is one undo step.

type Args = Record<string, unknown>;

const DIRECTIONS = new Set<string>(KEN_BURNS_DIRECTIONS);

function targetItem(ctx: AgentContext, requested: unknown): TimelineItem | undefined {
  const state = ctx.getState();
  const id = typeof requested === 'string' && requested.trim() ? requested.trim() : state.selectedId;
  return id ? state.items.find((item) => item.id === id) : undefined;
}

export async function execKenBurnsTool(name: string, args: Args, ctx: AgentContext): Promise<unknown> {
  if (name !== 'apply_ken_burns') return { error: `unknown tool ${name}` };

  const item = targetItem(ctx, args.itemId);
  if (!item) {
    return {
      error: 'No encuentro el clip. Pásame itemId (read_timeline) o selecciona la foto en la línea de tiempo.',
    };
  }
  if (item.kind !== 'image') {
    return {
      error: `Ken Burns mueve fotos; "${item.name}" es ${item.kind}. Para vídeo, escribe keyframes con edit_item.`,
    };
  }
  if (ctx.getState().tracks?.[item.track]?.locked) {
    return { error: `La pista de "${item.name}" está bloqueada. Desbloquéala y vuelve a intentarlo.` };
  }

  const rawDirection = typeof args.direction === 'string' ? args.direction.trim() : '';
  if (rawDirection && !DIRECTIONS.has(rawDirection)) {
    return { error: `Dirección desconocida "${rawDirection}". Usa ${[...DIRECTIONS].join(', ')}.` };
  }
  const strength = typeof args.strength === 'number' && Number.isFinite(args.strength)
    ? args.strength
    : undefined;
  const seed = typeof args.seed === 'number' && Number.isFinite(args.seed) ? args.seed : undefined;

  const plan = kenBurnsActions({
    itemId: item.id,
    durationInFrames: item.durationInFrames,
    direction: (rawDirection || undefined) as KenBurnsDirection | undefined,
    strength,
    seed,
    baseX: item.transform?.x ?? 0,
    baseY: item.transform?.y ?? 0,
  });
  if (!plan) {
    return { error: `"${item.name}" dura ${item.durationInFrames} frame(s): no hay recorrido posible. Alarga el clip y reinténtalo.` };
  }

  ctx.commands.batch(plan.actions, 'Ken Burns');
  return {
    ok: true,
    itemId: item.id,
    direction: plan.direction,
    scaleFrom: plan.scaleFrom,
    scaleTo: plan.scaleTo,
    keyframes: plan.actions.filter((action) => action.type === 'setKeyframe').length,
    note: `Ken Burns (${plan.direction}) aplicado a "${item.name}" en un solo paso de deshacer.`,
  };
}
