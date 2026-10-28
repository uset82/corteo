// P4-3: the `variant.chosen` browser event and the chooseVariant command that
// fires it. The dialog itself only calls commands.chooseVariant.
// Run: npx tsx src/editor/variantChoice.verify.ts
import assert from 'node:assert/strict';
import { makeDraft } from './store';
import { docFromTimeline } from '../persist/projectStore';
import type { TimelineState } from './types';
import {
  VARIANT_CHOSEN_EVENT, announceVariantChosen, subscribeVariantChosen, type VariantChosenDetail,
} from './variantChoice';

assert.equal(VARIANT_CHOSEN_EVENT, 'variant.chosen');
const target = new EventTarget();
(globalThis as unknown as { window: EventTarget }).window = target;
const seen: VariantChosenDetail[] = [];
const unsubscribe = subscribeVariantChosen((detail) => seen.push(detail));
announceVariantChosen({ groupId: 'vg_1', timelineId: 'tl_a' });
unsubscribe();
announceVariantChosen({ groupId: 'vg_1', timelineId: 'tl_b' });
assert.deepEqual(seen, [{ groupId: 'vg_1', timelineId: 'tl_a' }], 'subscribe receives the detail until unsubscribed');

const state: TimelineState = { fps: 30, width: 1920, height: 1080, selectedId: null, items: [] };
const draft = makeDraft(docFromTimeline(state));
const source = draft.getDoc().timelines[0]!;
const created = draft.commands.createVariants(source.id, [{ label: 'A' }, { label: 'B' }]);
const commandEvents: VariantChosenDetail[] = [];
const commandTarget = new EventTarget();
(globalThis as unknown as { window: EventTarget }).window = commandTarget;
commandTarget.addEventListener(VARIANT_CHOSEN_EVENT, (event) => {
  commandEvents.push((event as CustomEvent<VariantChosenDetail>).detail);
});
const chosen = draft.commands.chooseVariant(created.ids[1]!);
assert.equal(chosen.ok, true);
assert.deepEqual(commandEvents, [{ groupId: created.groupId, timelineId: created.ids[1] }],
  'chooseVariant fires variant.chosen');
const unchanged = draft.commands.chooseVariant(created.ids[1]!) as { changed: boolean };
assert.equal(unchanged.changed, false, 'choosing the same version again is a no-op');
delete (globalThis as unknown as { window?: EventTarget }).window;
console.log('variant-choice.verify: variant.chosen and chooseVariant event OK');
