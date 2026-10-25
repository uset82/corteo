// Contract check for emphasize_keywords (Plan 5, OP-08).
//
// Scope, deliberately: this file covers the tool's *wiring and refusals*. The judgement lives
// in src/captions/keywordEmphasis.verify.ts (fixed word list, both directions), and the render
// channel in src/captions/emphasis.verify.ts (the flag reaches the layer). Asserting the
// candidate list here would duplicate the first and depend on how the caption projection
// happens to resolve for a synthetic fixture, which is not what this tool controls.
import assert from 'node:assert';
import { makeDraft } from '../../editor/store';
import type { TimelineState } from '../../editor/types';
import type { TranscriptWord } from '../../transcript/types';
import { docFromTimeline } from '../../persist/projectStore';
import type { AgentContext } from '../context';
import { execEmphasisTool } from './emphasis-tools';

const words: TranscriptWord[] = [
  { text: 'el', start: 0, end: 100 },
  { text: 'precio', start: 150, end: 500 },
  { text: '300', start: 850, end: 1100 },
];

function context(captionsEnabled: boolean): { draft: ReturnType<typeof makeDraft>; ctx: AgentContext; state: TimelineState } {
  const state: TimelineState = {
    fps: 30, width: 1080, height: 1920, selectedId: null,
    items: [{ id: 'talk', track: 'V1', startFrame: 0, durationInFrames: 60, name: 'Charla', kind: 'video', src: '/talk.mp4', transcript: words }],
    captions: { enabled: captionsEnabled, template: 'plain', pacing: 'phrase' },
  };
  const draft = makeDraft(docFromTimeline(state));
  return {
    draft,
    state,
    ctx: {
      commands: draft.commands, getState: draft.getState, getDoc: draft.getDoc,
      getCreativeMode: () => null, templates: [], audio: [],
    },
  };
}

interface Result {
  ok?: boolean; error?: string; applied?: boolean; count?: number;
  candidates?: unknown[]; note?: string;
}

// ── 1) A preview never edits ───────────────────────────────────────────────────────
{
  const { draft, ctx } = context(true);
  const preview = await execEmphasisTool('emphasize_keywords', { apply: false }, ctx) as Result;
  assert.strictEqual(preview.ok, true);
  assert.strictEqual(preview.applied, false, 'apply:false is a preview');
  assert.ok(Array.isArray(preview.candidates), 'a preview always reports a candidate list');
  assert.strictEqual(draft.getState().captions?.wordOverrides, undefined, 'a preview writes nothing');
}

// ── 2) Captions off: a clear refusal, and nothing written ──────────────────────────
{
  const { draft, ctx } = context(false);
  const refused = await execEmphasisTool('emphasize_keywords', {}, ctx) as Result;
  assert.strictEqual(refused.ok, undefined, 'the refusal is an error, not a success');
  assert.ok(refused.error && /desactivad/i.test(refused.error), 'the message explains that captions are off');
  assert.strictEqual(draft.getState().captions?.wordOverrides, undefined, 'nothing is written while captions are off');
}

// ── 3) Applying either writes emphasis or says it found nothing ───────────────────
{
  const { draft, ctx } = context(true);
  const applied = await execEmphasisTool('emphasize_keywords', {}, ctx) as Result;
  assert.strictEqual(applied.ok, true, 'the tool answers');
  const overrides = draft.getState().captions?.wordOverrides;
  if (applied.applied) {
    assert.ok(overrides && Object.keys(overrides).length > 0, 'applied means overrides exist');
    for (const value of Object.values(overrides as Record<number, { emphasis?: boolean }>)) {
      assert.strictEqual(value.emphasis, true, 'every written override is an emphasis');
    }
    assert.strictEqual(applied.count, Object.keys(overrides!).length, 'the count matches what was written');
  } else {
    assert.strictEqual(overrides, undefined, 'not applied means nothing was written');
    assert.strictEqual(applied.count, undefined, 'and no count is claimed');
  }
}

// ── 4) Unknown tool name ───────────────────────────────────────────────────────────
{
  const { ctx } = context(true);
  const unknown = await execEmphasisTool('emphasize_everything', {}, ctx) as Result;
  assert.ok(unknown.error, 'unknown tool name errors');
}

console.log('emphasis-tools.verify: ok');
