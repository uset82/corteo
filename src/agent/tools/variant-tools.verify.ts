// P4-1: sibling versions. Three copies with the same clips and tags, a choice
// that becomes active in one undo batch, read/wait behaviour (45 s cap exercised
// with an injected clock), and clear 2-to-4 validation.
// Run: npx tsx src/agent/tools/variant-tools.verify.ts
import assert from 'node:assert/strict';
import { makeDraft } from '../../editor/store';
import type { TimelineState } from '../../editor/types';
import { docFromTimeline } from '../../persist/projectStore';
import type { AgentContext } from '../context';
import {
  isExternalDraftTool,
  isExternalReadTool,
  isExternalRealTool,
  isExternalServerDirectTool,
} from '../external-tool-policy';
import {
  execVariantTool,
  VARIANT_CHOICE_TIMEOUT_MS,
  waitForVariantChoice,
  type VariantChoiceReport,
  type VariantView,
} from './variant-tools';
import { VARIANT_TOOL_NAMES, VARIANT_TOOL_SCHEMAS } from './schemas/variant-tools';

const sourceState: TimelineState = {
  fps: 30,
  width: 1920,
  height: 1080,
  selectedId: null,
  items: [
    { id: 'clip-a', track: 'V1', startFrame: 0, durationInFrames: 90, name: 'clip a', kind: 'video', src: '/media/uploads/a.mp4' },
    { id: 'clip-b', track: 'V1', startFrame: 90, durationInFrames: 60, name: 'clip b', kind: 'video', src: '/media/uploads/b.mp4' },
  ],
};
const draft = makeDraft(docFromTimeline(sourceState));
const ctx: AgentContext = {
  commands: draft.commands,
  getState: draft.getState,
  getDoc: draft.getDoc,
  getCreativeMode: () => null,
  templates: [],
  audio: [],
};
const source = draft.getDoc().timelines[0]!;
const sourceItems = source.items;

interface CreateResult {
  ok?: boolean;
  error?: string;
  groupId: string;
  variants: VariantView[];
  source: { id: string; name: string };
}
interface ChooseResult extends VariantChoiceReport { changed: boolean }

// ── Schema and policy ────────────────────────────────────────────────────────
assert.deepEqual([...VARIANT_TOOL_NAMES].sort(), ['choose_variant', 'create_variants', 'get_variant_choice']);
const byName = new Map(VARIANT_TOOL_SCHEMAS.map((schema) => [schema.name, schema]));
assert.match(byName.get('create_variants')!.description ?? '', /2 to 4/);
assert.match(byName.get('get_variant_choice')!.description ?? '', /45 seconds/);
assert.match(byName.get('get_variant_choice')!.description ?? '', /Read-only/);
for (const name of ['create_variants', 'choose_variant']) {
  assert.equal(isExternalDraftTool(name), true, `${name} is a draft edit`);
  assert.equal(isExternalServerDirectTool(name), true, `${name} runs headless`);
  assert.equal(isExternalRealTool(name), false, `${name} does not touch the live project`);
}
assert.equal(isExternalReadTool('get_variant_choice'), true);
assert.equal(isExternalServerDirectTool('get_variant_choice'), true);
assert.equal(isExternalRealTool('get_variant_choice'), false);

// ── create_variants: 3 copies, same clips, one batch ─────────────────────────
const created = await execVariantTool('create_variants', {
  labels: ['Rápida', 'Lenta', 'Color'],
  notes: ['Cortes rápidos', 'Planos largos'],
}, ctx) as CreateResult;
assert.equal(created.ok, true);
assert.equal(created.groupId.startsWith('vg_'), true);
assert.equal(created.source.id, source.id);
assert.equal(created.variants.length, 3);
const docAfterCreate = draft.getDoc();
assert.equal(docAfterCreate.timelines.length, 4, 'three new sibling sequences');
assert.equal(docAfterCreate.activeTimelineId, source.id, 'creating versions does not hijack the active sequence');
assert.deepEqual(created.variants.map((variant) => variant.label), ['Rápida', 'Lenta', 'Color']);
assert.deepEqual(created.variants.map((variant) => variant.note), ['Cortes rápidos', 'Planos largos', '']);
for (const variant of created.variants) {
  const timeline = docAfterCreate.timelines.find((row) => row.id === variant.id)!;
  assert.equal(timeline.variant?.groupId, created.groupId);
  assert.equal(timeline.variant?.status, 'borrador');
  assert.equal(timeline.name, variant.label);
  assert.deepEqual(timeline.items, sourceItems, 'every version starts with the source clips');
  assert.equal(variant.active, false);
  assert.equal(timeline.variant?.label, variant.label);
}
const createActions = draft.takeActions();
assert.equal(createActions.length, 1, 'create_variants is one undo step');
assert.equal(createActions[0]!.type, 'batch');
assert.equal((createActions[0] as { label?: string }).label, 'Crear versiones');
assert.equal((createActions[0] as { actions: unknown[] }).actions.length, 3);
assert.equal(draft.getDoc().timelines.filter((timeline) => timeline.id === source.id)[0]!.variant, undefined, 'the source is not a version');

// ── Refuse anything outside 2-4 copies ───────────────────────────────────────
for (const [labels, expected] of [
  [['solo'], /2 to 4/],
  [['a', 'b', 'c', 'd', 'e'], /2 to 4/],
  [['', 'b'], /non-empty/],
  [['a', 'a'], /unique/],
] as const) {
  const refused = await execVariantTool('create_variants', { labels }, ctx) as { error?: string };
  assert.match(refused.error ?? '', expected);
}
assert.equal(draft.getDoc().timelines.length, 4, 'refused calls create no sequence');
const tooManyNotes = await execVariantTool('create_variants', { labels: ['a', 'b'], notes: ['1', '2', '3'] }, ctx) as { error?: string };
assert.match(tooManyNotes.error ?? '', /more entries than labels/);

// ── choose_variant: statuses + active, one undo step ─────────────────────────
draft.takeActions();
const chosenVariant = created.variants[1]!;
const chosen = await execVariantTool('choose_variant', { timelineId: chosenVariant.id }, ctx) as ChooseResult;
assert.equal(chosen.ok, true);
assert.equal(chosen.changed, true);
assert.equal(chosen.groupId, created.groupId);
assert.equal(chosen.chosen?.id, chosenVariant.id);
const docAfterChoice = draft.getDoc();
assert.equal(docAfterChoice.activeTimelineId, chosenVariant.id);
for (const variant of created.variants) {
  const timeline = docAfterChoice.timelines.find((row) => row.id === variant.id)!;
  assert.equal(timeline.variant?.status, variant.id === chosenVariant.id ? 'elegida' : 'descartada');
}
const chooseActions = draft.takeActions();
assert.equal(chooseActions.length, 1, 'choosing is one undo step');
assert.equal(chooseActions[0]!.type, 'batch');
assert.equal((chooseActions[0] as { label?: string }).label, 'Elegir versión');

// ── get_variant_choice: read by group or any timeline ────────────────────────
for (const selector of [{ groupId: created.groupId }, { timelineId: chosenVariant.id }, {}]) {
  const read = await execVariantTool('get_variant_choice', selector, ctx) as VariantChoiceReport;
  assert.equal(read.ok, true);
  assert.equal(read.groupId, created.groupId);
  assert.equal(read.chosen?.id, chosenVariant.id);
  assert.deepEqual(read.variants.map((variant) => variant.status), ['descartada', 'elegida', 'descartada']);
  assert.equal(read.timedOut, false);
  assert.equal(read.waitedMs, 0);
}

// ── wait: a choice made during the poll returns immediately ──────────────────
const second = await execVariantTool('create_variants', { labels: ['D', 'E'] }, ctx) as CreateResult;
const secondTarget = second.variants[0]!;
let clock = 0;
let choseDuringWait = false;
const waited = await waitForVariantChoice(ctx, { groupId: second.groupId }, true, {
  timeoutMs: 1000,
  intervalMs: 100,
  now: () => clock,
  sleep: async (ms) => {
    clock += ms;
    if (!choseDuringWait) {
      choseDuringWait = true;
      draft.commands.chooseVariant(secondTarget.id);
    }
  },
}) as VariantChoiceReport;
assert.equal(waited.timedOut, false);
assert.equal(waited.chosen?.id, secondTarget.id);
assert.equal(waited.waitedMs, 100, 'returns on the first poll after the choice');

// A group that is already chosen does not wait at all.
const immediate = await waitForVariantChoice(ctx, { groupId: created.groupId }, true, {
  timeoutMs: 99_999,
  sleep: async () => { throw new Error('must not poll a decided group'); },
}) as VariantChoiceReport;
assert.equal(immediate.chosen?.id, chosenVariant.id);
assert.equal(immediate.waitedMs, 0);

// ── wait: the real 45 s cap, and a shortened injected one ────────────────────
const third = await execVariantTool('create_variants', { labels: ['F', 'G'] }, ctx) as CreateResult;
let capClock = 0;
const capped = await waitForVariantChoice(ctx, { groupId: third.groupId }, true, {
  now: () => capClock,
  sleep: async (ms) => { capClock += ms; },
}) as VariantChoiceReport;
assert.equal(VARIANT_CHOICE_TIMEOUT_MS, 45_000);
assert.equal(capped.timedOut, true);
assert.equal(capped.chosen, null);
assert.equal(capped.waitedMs, 45_000, 'default wait stops at the 45 s cap');
let shortClock = 0;
const shortened = await waitForVariantChoice(ctx, { groupId: third.groupId }, true, {
  timeoutMs: 30,
  intervalMs: 10,
  now: () => shortClock,
  sleep: async (ms) => { shortClock += ms; },
}) as VariantChoiceReport;
assert.equal(shortened.timedOut, true);
assert.equal(shortened.waitedMs, 30);

// ── Errors ──────────────────────────────────────────────────────────────────
const unknownGroup = await execVariantTool('get_variant_choice', { groupId: 'vg_missing' }, ctx) as { error?: string };
assert.match(unknownGroup.error ?? '', /no version group/);
const notAVariant = await execVariantTool('choose_variant', { timelineId: source.id }, ctx) as { error?: string };
assert.match(notAVariant.error ?? '', /not a version/);
const missingTimeline = await execVariantTool('choose_variant', { timelineId: 'tl_missing' }, ctx) as { error?: string };
assert.match(missingTimeline.error ?? '', /no timeline/);
const unknownTool = await execVariantTool('variant_everything', {}, ctx) as { error?: string };
assert.match(unknownTool.error ?? '', /unknown tool/);

console.log('variant-tools.verify: create/choose/read versions, 45 s wait cap and 2-4 validation OK');
