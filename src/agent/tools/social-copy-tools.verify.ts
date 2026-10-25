// Runnable contract check for write_social_copy (Plan 5, OP-12): per-platform clamping from
// a real transcript range, the fallback, and the two error paths. The model is stubbed.
import assert from 'node:assert';
import { makeDraft } from '../../editor/store';
import type { TimelineState } from '../../editor/types';
import type { TranscriptWord } from '../../transcript/types';
import { docFromTimeline } from '../../persist/projectStore';
import type { AgentContext } from '../context';
import { execSocialCopyTool, setSocialCopyScorer } from './social-copy-tools';

const words: TranscriptWord[] = [
  { text: 'Nadie', start: 0, end: 300 },
  { text: 'te', start: 350, end: 500 },
  { text: 'cuenta', start: 550, end: 900 },
  { text: 'esto', start: 950, end: 1200 },
  { text: 'del', start: 1250, end: 1400 },
  { text: 'precio.', start: 1450, end: 1800 },
  { text: 'Sube', start: 1900, end: 2200 },
  { text: 'siempre.', start: 2250, end: 2600 },
];

const state: TimelineState = {
  fps: 30, width: 1920, height: 1080, selectedId: null,
  items: [{ id: 'talk', track: 'V1', startFrame: 0, durationInFrames: 90, name: 'Charla', kind: 'video', src: '/talk.mp4', transcript: words }],
};

const draft = makeDraft(docFromTimeline(state));
const ctx: AgentContext = {
  commands: draft.commands, getState: draft.getState, getDoc: draft.getDoc,
  getCreativeMode: () => null, templates: [], audio: [],
};

interface CopyOut { platform: string; title: string; description: string; hashtags: string[]; titleLength: number; descriptionLength: number }
interface Result { ok?: boolean; error?: string; copy: CopyOut[]; modelUsed: boolean; wordRange?: { startWord: number; endWord: number } | null; note?: string }

setSocialCopyScorer(async (input) => ({
  copy: [{ platform: 'x', title: `Clip sobre ${input.text.slice(0, 12)}`, description: 'Dos frases.', hashtags: ['#precio'] }],
}));

// ── 1) Happy path: one entry per platform, each inside its limits ─────────────────────
const res = await execSocialCopyTool('write_social_copy', { platforms: ['x', 'youtube'], direction: 'tono cercano' }, ctx) as Result;
assert.strictEqual(res.ok, true);
assert.strictEqual(res.modelUsed, true);
assert.strictEqual(res.copy.length, 2, 'one entry per requested platform');
assert.strictEqual(res.copy[0].platform, 'x');
assert.ok(res.copy[0].title.length <= 280, 'x title within its limit');
assert.ok(res.copy[1].title.length <= 100, 'youtube title within its limit');
assert.deepStrictEqual(res.copy[0].hashtags, ['precio'], 'hashtags lose the # and stay short');
assert.strictEqual(res.wordRange, null, 'no range given → whole clip');

// ── 2) A word range focuses the copy on the moment ───────────────────────────────────
const ranged = await execSocialCopyTool('write_social_copy', { platforms: ['x'], startWord: 0, endWord: 5 }, ctx) as Result;
assert.deepStrictEqual(ranged.wordRange, { startWord: 0, endWord: 5 }, 'the range is echoed back');

const outOfRange = await execSocialCopyTool('write_social_copy', { platforms: ['x'], startWord: 99, endWord: 200 }, ctx) as Result;
assert.strictEqual(outOfRange.ok, true, 'an out-of-range window is clamped, not fatal');
assert.ok(outOfRange.wordRange!.startWord <= words.length - 1, 'the range is clamped to the transcript');

// ── 3) Default platforms; an invalid list is a clear error ───────────────────────────
const defaults = await execSocialCopyTool('write_social_copy', {}, ctx) as Result;
assert.deepStrictEqual(defaults.copy.map((c) => c.platform), ['tiktok', 'instagram', 'youtube'], 'the default platform set');

const invalid = await execSocialCopyTool('write_social_copy', { platforms: ['myspace'] }, ctx) as Result;
assert.ok(invalid.error && /plataforma/i.test(invalid.error), 'an unknown platform is rejected with the valid list');

// ── 4) Model offline: still postable copy, honestly flagged ──────────────────────────
setSocialCopyScorer(async () => { throw new Error('offline'); });
const offline = await execSocialCopyTool('write_social_copy', { platforms: ['x'] }, ctx) as Result;
assert.strictEqual(offline.ok, true);
assert.strictEqual(offline.modelUsed, false);
assert.strictEqual(offline.copy[0].title, 'Nadie te cuenta esto del precio.', 'the clip opens the fallback title');

// ── 5) No transcript: clear error ────────────────────────────────────────────────────
const bare = makeDraft(docFromTimeline({
  fps: 30, width: 1920, height: 1080, selectedId: null,
  items: [{ id: 'v', track: 'V1', startFrame: 0, durationInFrames: 90, name: 'v', kind: 'video', src: '/v.mp4' }],
}));
const bareCtx: AgentContext = {
  commands: bare.commands, getState: bare.getState, getDoc: bare.getDoc,
  getCreativeMode: () => null, templates: [], audio: [],
};
const missing = await execSocialCopyTool('write_social_copy', {}, bareCtx) as Result;
assert.ok(missing.error && /transcri/i.test(missing.error), 'missing transcript is a clear Spanish error');

setSocialCopyScorer(null);
console.log('social-copy-tools.verify: ok');
