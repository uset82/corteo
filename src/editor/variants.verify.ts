// P4-1: a version group is `timeline.variant` on the persisted project, so the
// compare dialog, get_variant_choice and choose_variant all read one document.
// Run: npx tsx src/editor/variants.verify.ts
import assert from 'node:assert/strict';
import { docFromTimeline } from '../persist/projectStore';
import { projectReduce } from './reduce';
import { makeDraft } from './store';
import type { ProjectDoc, TimelineVariant } from './types';
import {
  chosenVariant,
  cleanVariantLabel,
  cleanVariantNote,
  describeVariant,
  isVariantStatus,
  nextVariantLabel,
  variantGroups,
  variantMembers,
} from './variants';

function baseDoc(): ProjectDoc {
  return docFromTimeline({
    fps: 30,
    width: 1920,
    height: 1080,
    selectedId: null,
    items: [
      { id: 'a', track: 'V1', kind: 'video', name: 'a', startFrame: 0, durationInFrames: 30, src: '/a.mp4' },
      { id: 'b', track: 'V1', kind: 'video', name: 'b', startFrame: 30, durationInFrames: 20, src: '/b.mp4' },
    ],
  });
}

const tag = (label: string, status: TimelineVariant['status'] = 'candidate', groupId = 'g1'): TimelineVariant => ({
  groupId, label, status,
});

// ── helpers ────────────────────────────────────────────────────────────────────────
assert.equal(nextVariantLabel([]), 'A');
const ten = 'ABCDEFGHIJ'.split('').map((label) => ({ variant: tag(label) }));
assert.equal(nextVariantLabel(ten), 'A2', 'labels roll over to A2 once A..J are taken');
assert.equal(nextVariantLabel([{ variant: tag('A') }, { variant: tag('B') }]), 'C');
ten.push({ variant: tag('A2') });
assert.equal(nextVariantLabel(ten), 'B2', 'a taken round-two label is skipped too');
assert.equal(nextVariantLabel([{ variant: undefined }]), 'A', 'untagged timelines do not consume a label');

assert.equal(cleanVariantLabel('  ritmo   con\ncorte  ', 'A'), 'ritmo con corte');
assert.equal(cleanVariantLabel('x'.repeat(40), 'A').length, 24, 'labels stay short enough for a tab');
assert.equal(cleanVariantLabel('   ', 'A'), 'A', 'an empty label falls back');
assert.equal(cleanVariantNote('  uno   dos \n tres '), 'uno dos tres');
assert.equal(cleanVariantNote('   '), undefined);
assert.equal(cleanVariantNote(undefined), undefined);
assert.equal(cleanVariantNote('n'.repeat(400))?.length, 160, 'notes stay one bounded line');
assert.equal(isVariantStatus('chosen'), true);
assert.equal(isVariantStatus('elegida'), false);
assert.equal(isVariantStatus(undefined), false);

// ── reducer: groups, statuses and the active sequence ──────────────────────────────
{
  const doc = baseDoc();
  const baseId = doc.activeTimelineId;
  const dup = (id: string, label: string): ProjectDoc => projectReduce(doc, {
    type: 'tl.duplicate', id, newId: `copy_${label}`, name: `copy ${label}`, activate: false,
  });

  let next = projectReduce(dup(baseId, 'A'), { type: 'tl.setVariant', id: 'copy_A', variant: tag('A') });
  next = projectReduce(next, { type: 'tl.duplicate', id: baseId, newId: 'copy_B', name: 'copy B', activate: false });
  next = projectReduce(next, { type: 'tl.setVariant', id: 'copy_B', variant: tag('B') });

  assert.deepEqual(variantMembers(next, 'g1').map((t) => t.id), ['copy_A', 'copy_B'], 'members come back in tab order');
  assert.equal(variantMembers(next, 'other').length, 0);
  assert.equal(chosenVariant(next, 'g1'), null, 'nothing is chosen before the user picks');
  assert.deepEqual(variantGroups(next), ['g1']);

  // A plain copy is never a comparison option, even from a tagged sequence.
  const untagged = projectReduce(next, { type: 'tl.duplicate', id: 'copy_A', newId: 'copy_plain', name: 'plain', activate: false });
  assert.equal(untagged.timelines.find((t) => t.id === 'copy_plain')?.variant, undefined, 'tl.duplicate clears the tag');
  assert.equal(variantMembers(untagged, 'g1').length, 2);

  const chose = projectReduce(next, { type: 'tl.chooseVariant', groupId: 'g1', id: 'copy_A', note: '  más   aire ' });
  assert.equal(chose.activeTimelineId, 'copy_A', 'the pick becomes the sequence the editor shows');
  assert.equal(variantMembers(chose, 'g1')[0]!.variant!.status, 'chosen');
  assert.equal(variantMembers(chose, 'g1')[1]!.variant!.status, 'discarded');
  assert.equal(variantMembers(chose, 'g1')[0]!.variant!.note, 'más   aire', 'the reducer stores what it was given');
  assert.equal(chosenVariant(chose, 'g1')?.id, 'copy_A');

  const rechose = projectReduce(chose, { type: 'tl.chooseVariant', groupId: 'g1', id: 'copy_B' });
  assert.equal(chosenVariant(rechose, 'g1')?.id, 'copy_B', 'picking another version moves the choice');
  assert.equal(variantMembers(rechose, 'g1')[0]!.variant!.status, 'discarded');
  assert.equal(variantMembers(rechose, 'g1')[0]!.variant!.note, 'más   aire', 'the other note survives the switch');
  assert.equal(rechose.activeTimelineId, 'copy_B');

  const stranger = projectReduce(rechose, { type: 'tl.chooseVariant', groupId: 'g1', id: 'copy_plain' });
  assert.equal(stranger, rechose, 'a timeline outside the group cannot be chosen');
  const unknownGroup = projectReduce(rechose, { type: 'tl.chooseVariant', groupId: 'nope', id: 'copy_A' });
  assert.equal(unknownGroup, rechose, 'an unknown group is a no-op');

  // A hidden sequence cannot become active (see tl.setHidden).
  const hidden = projectReduce(rechose, { type: 'tl.setHidden', id: 'copy_A', hidden: true });
  const hiddenPick = projectReduce(hidden, { type: 'tl.chooseVariant', groupId: 'g1', id: 'copy_A' });
  assert.equal(chosenVariant(hiddenPick, 'g1')?.id, 'copy_A', 'a hidden version can still win the comparison');
  assert.equal(hiddenPick.activeTimelineId, hidden.activeTimelineId, 'but the editor keeps showing a visible one');

  const cleared = projectReduce(next, { type: 'tl.setVariant', id: 'copy_B', variant: null });
  assert.equal(cleared.timelines.find((t) => t.id === 'copy_B')?.variant, undefined, 'a null variant untags the sequence');
  assert.equal(variantMembers(cleared, 'g1').length, 1);
  assert.equal(projectReduce(next, { type: 'tl.setVariant', id: 'missing', variant: tag('A') }), next);
}

// ── commands: creating a version is one undo step ─────────────────────────────────
{
  const draft = makeDraft(baseDoc());
  const baseId = draft.getDoc().activeTimelineId;
  const copyId = draft.commands.duplicateTimeline(baseId, { name: 'copy', activate: false, variant: tag('A') });
  const doc = draft.getDoc();
  assert.equal(doc.activeTimelineId, baseId, 'activate:false keeps the user on their sequence');
  assert.deepEqual(variantMembers(doc, 'g1').map((t) => t.id), [copyId]);
  assert.deepEqual(draft.takeActions().map((action) => action.type), ['batch'], 'copy + tag is one history step');

  draft.commands.duplicateTimeline(baseId, { name: 'plain', activate: false });
  assert.equal(draft.getDoc().timelines.at(-1)?.variant, undefined);
  assert.deepEqual(draft.takeActions().map((action) => action.type), ['tl.duplicate'], 'a plain copy is a plain action');

  draft.commands.chooseVariant('g1', copyId, 'nota');
  assert.equal(chosenVariant(draft.getDoc(), 'g1')?.variant?.note, 'nota');
  assert.deepEqual(draft.takeActions().map((action) => action.type), ['tl.chooseVariant']);

  assert.deepEqual(describeVariant(variantMembers(draft.getDoc(), 'g1')[0]!), {
    timelineId: copyId,
    name: variantMembers(draft.getDoc(), 'g1')[0]!.name,
    label: 'A',
    note: 'nota',
    status: 'chosen',
    clips: 2,
    durationInFrames: 50,
  });
}

console.log('variants.verify: groups, statuses, the active pick and one-step creation OK');
