// Runnable contract check for apply_brand_kit (Plan 5, OP-10 step 3b): the kit reaches every
// target sequence through the captions tool, the project keeps it when save:true, and the
// active sequence is restored.
import assert from 'node:assert';
import { makeDraft } from '../../editor/store';
import type { TimelineState } from '../../editor/types';
import { docFromTimeline } from '../../persist/projectStore';
import type { AgentContext } from '../context';
import { brandKitOf } from '../../brand/kit';
import { execBrandTool } from './brand-tools';

function state(timelineId: string): TimelineState {
  return {
    fps: 30, width: 1080, height: 1920, selectedId: null,
    items: [{ id: 'v', track: 'V1', startFrame: 0, durationInFrames: 30, name: 'v', kind: 'video', src: `/${timelineId}.mp4` }],
  };
}

const draft = makeDraft(docFromTimeline(state('tl1')));
// A second sequence, so scope can be observed.
draft.commands.duplicateTimeline(draft.getDoc().activeTimelineId, { name: 'copia', activate: false });
const ctx: AgentContext = {
  commands: draft.commands, getState: draft.getState, getDoc: draft.getDoc,
  getCreativeMode: () => null, templates: [], audio: [],
};
const originalId = draft.getDoc().activeTimelineId;
assert.strictEqual(draft.getDoc().timelines.length, 2, 'the fixture has two sequences');

interface Result {
  ok?: boolean; error?: string; saved?: boolean; scope?: string;
  applied: { timelineId: string; captions: string; motion: string }[];
  kit: { captionPreset: string; name: string };
  note?: string; notApplied?: string[]; notAppliedNote?: string;
}

// ── 1) Inline kit, saved, applied to every sequence ─────────────────────────────────────
const result = await execBrandTool('apply_brand_kit', {
  kit: { name: 'Canal', captionPreset: 'tiktok', captionMotion: 'pop' },
  scope: 'all',
  save: true,
}, ctx) as Result;

assert.strictEqual(result.ok, true);
assert.strictEqual(result.saved, true, 'save:true stores the kit');
assert.strictEqual(result.scope, 'all');
assert.strictEqual(result.applied.length, 2, 'every sequence is targeted');
for (const entry of result.applied) {
  assert.ok(['applied', 'failed'].includes(entry.captions), `captions status reported, got ${entry.captions}`);
  assert.ok(['applied', 'skipped', 'failed'].includes(entry.motion), `motion status reported, got ${entry.motion}`);
}
assert.deepStrictEqual(result.applied.map((e) => e.timelineId).sort(), draft.getDoc().timelines.map((t) => t.id).sort(), 'the ids are the project sequences');
assert.strictEqual(draft.getDoc().activeTimelineId, originalId, 'the user view returns to the sequence they were on');
assert.strictEqual(brandKitOf(draft.getDoc()).name, 'Canal', 'the project now carries the kit');
assert.deepStrictEqual(result.notApplied, ['watermark', 'palette'], 'what it did not apply is stated, not hidden');
assert.ok(/logo|paleta/i.test(result.notAppliedNote ?? ''), 'and there is a sentence telling the user where those live');

// ── 2) No inline kit: the project's own kit is used ───────────────────────────────────
const reused = await execBrandTool('apply_brand_kit', { scope: 'active' }, ctx) as Result;
assert.strictEqual(reused.scope, 'active');
assert.strictEqual(reused.applied.length, 1, 'scope:active touches one sequence');
assert.strictEqual(reused.kit.captionPreset, 'tiktok', 'the stored kit is what gets applied');
assert.strictEqual(reused.saved, false, 'without save:true nothing is written');

// ── 3) Garbage inline kit is normalized, not trusted ─────────────────────────────────
const garbage = await execBrandTool('apply_brand_kit', { kit: { palette: 'rojo', safeMargin: 9 } }, ctx) as Result;
assert.strictEqual(garbage.kit.captionPreset, 'tiktok', 'an unusable kit falls back to the defaults');

// ── 4) Unknown tool name ────────────────────────────────────────────────────────────
const unknown = await execBrandTool('brand_everything', {}, ctx) as Result;
assert.ok(unknown.error, 'unknown tool name errors');

console.log('brand-tools.verify: ok');
