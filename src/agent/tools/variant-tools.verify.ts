// P4-1: create_variants / get_variant_choice / choose_variant drive the version
// group on the draft. The three schemas are registered, the policy classes are
// explicit, and the executor only touches tl.* commands.
// Run: npx tsx src/agent/tools/variant-tools.verify.ts
import assert from 'node:assert/strict';
import { makeDraft } from '../../editor/store';
import { docFromTimeline } from '../../persist/projectStore';
import type { ProjectDoc } from '../../editor/types';
import { variantMembers, chosenVariant } from '../../editor/variants';
import type { AgentContext } from '../context';
import {
  isExternalDraftTool,
  isExternalReadTool,
  isExternalRealTool,
  isExternalServerDirectTool,
} from '../external-tool-policy';
import { TOOL_SCHEMAS } from '../tools';
import { execVariantTool } from './variant-tools';
import { VARIANT_TOOL_NAMES, VARIANT_TOOL_SCHEMAS } from './schemas/variant-tools';

// ── schemas and registration ──────────────────────────────────────────────────────
assert.deepEqual([...VARIANT_TOOL_NAMES], ['create_variants', 'get_variant_choice', 'choose_variant']);
const byName = new Map(VARIANT_TOOL_SCHEMAS.map((schema) => [schema.name, schema]));
assert.deepEqual([...byName.keys()], [...VARIANT_TOOL_NAMES], 'schemas are in name order');
const registered = new Set(TOOL_SCHEMAS.map((schema) => schema.name));
for (const name of VARIANT_TOOL_NAMES) assert.equal(registered.has(name), true, `${name} is in TOOL_SCHEMAS`);

const create = byName.get('create_variants')!.input_schema;
const count = create.properties?.count as { minimum?: number; maximum?: number; default?: number } | undefined;
assert.equal(count?.minimum, 2);
assert.equal(count?.maximum, 4);
assert.equal(count?.default, 2);
assert.match(byName.get('create_variants')!.description ?? '', /2-4/);
const wait = (byName.get('get_variant_choice')!.input_schema.properties?.timeoutSeconds) as
  { minimum?: number; maximum?: number } | undefined;
assert.equal(wait?.minimum, 1);
assert.equal(wait?.maximum, 20);
const pick = byName.get('choose_variant')!.input_schema.properties ?? {};
assert.deepEqual(Object.keys(pick).sort(), ['groupId', 'label', 'note', 'timelineId'], 'a version is named by id or label');

// ── policy: waiting is a read; creating and picking are draft edits ───────────────
for (const name of ['create_variants', 'choose_variant']) {
  assert.equal(isExternalReadTool(name), false, `${name} writes the draft`);
  assert.equal(isExternalDraftTool(name), true);
  assert.equal(isExternalRealTool(name), false, `${name} only touches the draft`);
  assert.equal(isExternalServerDirectTool(name), true, `${name} runs headless`);
}
assert.equal(isExternalReadTool('get_variant_choice'), true);
assert.equal(isExternalDraftTool('get_variant_choice'), true);
assert.equal(isExternalRealTool('get_variant_choice'), false);
assert.equal(
  isExternalServerDirectTool('get_variant_choice'),
  false,
  'nobody can answer in a headless run, so waiting is browser-only',
);

// ── fixtures ─────────────────────────────────────────────────────────────────────
function baseDoc(): ProjectDoc {
  return docFromTimeline({
    fps: 30,
    width: 1920,
    height: 1080,
    selectedId: null,
    items: [{ id: 'v', track: 'V1', kind: 'video', name: 'v', startFrame: 0, durationInFrames: 60, src: '/v.mp4' }],
  });
}

function engine() {
  const draft = makeDraft(baseDoc());
  const ctx = {
    commands: draft.commands,
    getState: draft.getState,
    getDoc: draft.getDoc,
    getCreativeMode: () => null,
    templates: [],
    audio: [],
  } as AgentContext;
  return { draft, ctx, baseId: draft.getDoc().activeTimelineId };
}

interface Created {
  ok?: boolean; error?: string; groupId?: string;
  base?: { timelineId: string; name: string };
  variants?: Array<{ timelineId: string; name: string; label: string; note?: string; status: string; clips: number; durationInFrames: number }>;
  next?: string;
}

// ── create_variants: 2-4 copies, tagged, active sequence untouched ────────────────
{
  const { draft, ctx, baseId } = engine();
  const baseName = draft.getDoc().timelines.find((timeline) => timeline.id === baseId)!.name;
  const created = await execVariantTool('create_variants', {}, ctx) as Created;
  assert.equal(created.ok, true, JSON.stringify(created));
  assert.match(created.groupId!, /^vg_/);
  assert.deepEqual(created.base, { timelineId: baseId, name: baseName });
  assert.deepEqual(created.variants!.map((variant) => variant.label), ['A', 'B'], 'count defaults to 2');
  assert.deepEqual(created.variants!.map((variant) => variant.status), ['candidate', 'candidate']);
  assert.deepEqual(created.variants!.map((variant) => variant.name), [`${baseName} · A`, `${baseName} · B`]);
  for (const variant of created.variants!) {
    assert.equal(variant.clips, 1, 'a copy clones the clips');
    assert.equal(variant.durationInFrames, 60);
  }
  assert.equal(draft.getDoc().activeTimelineId, baseId, 'the user stays on their sequence');
  assert.equal(draft.getDoc().timelines.length, 3);
  assert.equal(variantMembers(draft.getDoc(), created.groupId!).length, 2);
  assert.match(created.next ?? '', /Comparar versiones/);
}

// ── labels, notes and the 2..4 clamp ─────────────────────────────────────────────
{
  const { ctx } = engine();
  const first = await execVariantTool('create_variants', { count: 2 }, ctx) as Created;
  const clamped = await execVariantTool('create_variants', { count: 9, groupId: first.groupId }, ctx) as Created;
  assert.equal(clamped.ok, true);
  assert.equal(clamped.variants!.length, 4, 'at most four versions per call');
  assert.deepEqual(clamped.variants!.map((variant) => variant.label), ['C', 'D', 'E', 'F'], 'labels continue the group');

  const mismatch = await execVariantTool('create_variants', {
    count: 9, labels: ['  ritmo   alto ', 'cierre'], notes: ['  con   más aire ', ''],
  }, ctx) as Created;
  assert.match(mismatch.error ?? '', /labels has 2 entries but count is 4/);

  assert.match((await execVariantTool('create_variants', { labels: ['X', 'X'] }, ctx) as Created).error ?? '', /unique/);
  assert.match((await execVariantTool('create_variants', { groupId: 'nope' }, ctx) as Created).error ?? '', /no variant group/);
  assert.match((await execVariantTool('create_variants', { timelineId: 'missing' }, ctx) as Created).error ?? '', /no timeline/);
}

// ── labels and notes given by the model ──────────────────────────────────────────
{
  const { draft, ctx } = engine();
  const named = await execVariantTool('create_variants', {
    labels: ['  ritmo   alto ', 'cierre'], notes: ['  con   más aire ', ''],
  }, ctx) as Created;
  assert.deepEqual(named.variants!.map((variant) => variant.label), ['ritmo alto', 'cierre']);
  assert.equal(named.variants![0]!.note, 'con más aire', 'the note is cleaned before it lands');
  assert.equal(named.variants![1]!.note, undefined, 'an empty note is dropped');
  assert.match(named.variants![0]!.name, / · ritmo alto$/);
  assert.equal(variantMembers(draft.getDoc(), named.groupId!).length, 2);
}

// ── create_variants into an existing group ───────────────────────────────────────
{
  const { ctx } = engine();
  const first = await execVariantTool('create_variants', { count: 2 }, ctx) as Created;
  const more = await execVariantTool('create_variants', { count: 2, groupId: first.groupId }, ctx) as Created;
  assert.equal(more.groupId, first.groupId);
  assert.deepEqual(more.variants!.map((variant) => variant.label), ['C', 'D'], 'new members do not reuse A or B');
}

// ── get_variant_choice and choose_variant ────────────────────────────────────────
{
  const { draft, ctx } = engine();
  assert.match(
    (await execVariantTool('get_variant_choice', { timeoutSeconds: 1 }, ctx) as { error?: string }).error ?? '',
    /no variant group yet/,
  );

  const created = await execVariantTool('create_variants', { count: 3, notes: ['', 'la más rápida', ''] }, ctx) as Created;
  const groupId = created.groupId!;

  const pending = await execVariantTool('get_variant_choice', { groupId, timeoutSeconds: 1 }, ctx) as
    { pending?: boolean; chosen?: unknown; waitedSeconds?: number; variants?: unknown[]; hint?: string };
  assert.equal(pending.pending, true, 'nobody has picked yet');
  assert.equal(pending.chosen, null);
  assert.ok((pending.waitedSeconds ?? 0) >= 1, 'it actually waited');
  assert.equal(pending.variants!.length, 3);
  assert.match(pending.hint ?? '', /Comparar versiones/);

  const byLabel = await execVariantTool('choose_variant', { groupId, label: 'B' }, ctx) as
    { ok?: boolean; chosen?: { label: string; status: string; note?: string }; discarded?: Array<{ label: string }>; error?: string };
  assert.equal(byLabel.ok, true, JSON.stringify(byLabel));
  assert.equal(byLabel.chosen!.label, 'B');
  assert.equal(byLabel.chosen!.status, 'chosen');
  assert.deepEqual(byLabel.discarded!.map((variant) => variant.label), ['A', 'C']);
  assert.equal(chosenVariant(draft.getDoc(), groupId)?.variant?.label, 'B');
  assert.equal(draft.getDoc().activeTimelineId, created.variants![1]!.timelineId, 'the pick is what the editor shows');

  const resolved = await execVariantTool('get_variant_choice', { groupId, timeoutSeconds: 1 }, ctx) as
    { pending?: boolean; chosen?: { label: string; note?: string } };
  assert.equal(resolved.pending, false);
  assert.equal(resolved.chosen!.label, 'B', 'the pick is visible to the waiting call');
  assert.equal(resolved.chosen!.note, 'la más rápida', 'the note travels with the version');

  const byId = await execVariantTool('choose_variant', { timelineId: created.variants![2]!.timelineId.slice(0, 8), note: '  cierre   limpio ' }, ctx) as
    { ok?: boolean; chosen?: { label: string; note?: string } };
  assert.equal(byId.ok, true, 'the newest group is used when groupId is omitted');
  assert.equal(byId.chosen!.label, 'C');
  assert.equal(byId.chosen!.note, 'cierre limpio');

  const missing = await execVariantTool('choose_variant', { groupId, label: 'ZZ' }, ctx) as
    { error?: string; available?: Array<{ label: string }> };
  assert.match(missing.error ?? '', /no version ZZ/);
  assert.deepEqual(missing.available!.map((variant) => variant.label), ['A', 'B', 'C']);

  const plainCopy = draft.commands.duplicateTimeline(created.base!.timelineId, { name: 'plain', activate: false });
  assert.match(
    (await execVariantTool('choose_variant', { groupId, timelineId: plainCopy }, ctx) as { error?: string }).error ?? '',
    /no version/,
    'an untagged copy cannot be chosen',
  );

  assert.deepEqual(await execVariantTool('rename_everything', {}, ctx), { error: 'unknown tool rename_everything' });
}

console.log('variant-tools.verify: create/wait/choose version groups OK');
