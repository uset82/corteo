// Plan 1 Phase 4 variant commands. Kept out of storeCommandBuilder so the
// command surface stays under the 500-line source limit.
import type { EditorCommands } from './storeCommands';
import type { ProjectDoc } from './projectTypes';
import type { AtomicAction, ProjectDispatch } from './reducerActions';
import { announceVariantChosen } from './variantChoice';

const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

type VariantCommands = Pick<EditorCommands, 'createVariants' | 'chooseVariant'>;

export function createVariantCommands(dispatch: ProjectDispatch, getDoc: () => ProjectDoc): VariantCommands {
  return {
    createVariants: (id, variants) => {
      const doc = getDoc();
      if (!doc.timelines.some((timeline) => timeline.id === id)) return { groupId: '', ids: [] };
      const groupId = uid('vg');
      const actions: AtomicAction[] = [];
      for (const variant of variants) {
        actions.push({
          type: 'tl.duplicate', id, newId: uid('tl'), name: variant.label, activate: false,
          variant: { groupId, label: variant.label, note: variant.note ?? '', status: 'borrador' as const },
        });
      }
      dispatch({ type: 'batch', actions, label: 'Crear versiones' });
      return {
        groupId,
        ids: actions.map((action) => action.type === 'tl.duplicate' ? action.newId : ''),
      };
    },
    chooseVariant: (id) => {
      const doc = getDoc();
      const chosen = doc.timelines.find((timeline) => timeline.id === id);
      if (!chosen?.variant) return { ok: false, changed: false, error: 'not a variant timeline' };
      const groupId = chosen.variant.groupId;
      const actions: AtomicAction[] = [];
      for (const timeline of doc.timelines) {
        if (timeline.variant?.groupId !== groupId) continue;
        const status = timeline.id === id ? 'elegida' as const : 'descartada' as const;
        if (timeline.variant.status !== status) {
          actions.push({ type: 'tl.setVariant', id: timeline.id, variant: { ...timeline.variant, status } });
        }
      }
      if (doc.activeTimelineId !== id) actions.push({ type: 'tl.switch', id });
      if (!actions.length) return { ok: true, changed: false, groupId };
      dispatch({ type: 'batch', actions, label: 'Elegir versión' });
      announceVariantChosen({ groupId, timelineId: id });
      return { ok: true, changed: true, groupId };
    },
  };
}
