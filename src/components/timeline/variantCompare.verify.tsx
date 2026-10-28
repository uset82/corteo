// P4-3: the compare grid caps at four versions, syncs to one clock and picks
// through the document (never a store of its own).
// Run: npx tsx --tsconfig tsconfig.app.json src/components/timeline/variantCompare.verify.tsx
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Timeline } from '../../editor/types';
import { CompareVersionsView, type CompareCellModel } from './CompareVersionsDialog';
import { compareMembers, formatCompareSeconds, needsSync, seekTarget, variantStatusLabelKey } from './variantCompare';

const translate = (key: string, params?: Record<string, string | number>) => (
  params ? key.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match)) : key
);
const noop = () => undefined;

// ── Pure pieces ──
const members = Array.from({ length: 6 }, (_, index) => ({
  id: `tl-${index}`,
  name: `Sequence ${index}`,
  variant: { groupId: 'g', label: String.fromCharCode(65 + index), status: 'candidate' },
})) as unknown as Timeline[];
assert.deepEqual(compareMembers(members).map((member) => member.id), ['tl-0', 'tl-1', 'tl-2', 'tl-3'],
  'the 2x2 grid shows at most four versions');

assert.equal(needsSync(10, 10.19), false, 'small drift is left alone');
assert.equal(needsSync(10, 10.21), true, 'a fifth of a second is corrected');
assert.equal(needsSync(2, 1.7), true, 'drift is absolute in both directions');
assert.equal(seekTarget(9, 4), 4, 'a shorter version clamps to its own length');
assert.equal(seekTarget(-1, 4), 0);
assert.equal(seekTarget(3, Number.NaN), 3, 'metadata that has not loaded does not clamp');

assert.equal(formatCompareSeconds(0), '0:00');
assert.equal(formatCompareSeconds(75.9), '1:15');
assert.equal(formatCompareSeconds(-4), '0:00');

assert.equal(variantStatusLabelKey('candidate'), '候选');
assert.equal(variantStatusLabelKey('chosen'), '已选用');
assert.equal(variantStatusLabelKey('discarded'), '已淘汰');

// ── Rendered grid ──
const cells: CompareCellModel[] = [
  { timelineId: 'a', name: 'Corte A', label: 'A', note: 'Más aire en el coro', status: 'candidate', preview: { phase: 'ready', url: '/media/uploads/a.mp4' } },
  { timelineId: 'b', name: 'Corte B', label: 'B', note: 'Cierre limpio', status: 'chosen', preview: { phase: 'rendering', progress: 42 } },
  { timelineId: 'c', name: 'Corte C', label: 'C', status: 'discarded', preview: { phase: 'failed', error: 'export_media_not_ready' } },
  { timelineId: 'd', name: 'Corte D', label: 'D', status: 'candidate', preview: { phase: 'ready', url: '/media/uploads/d.mp4' } },
];
const view = (overrides: Partial<Parameters<typeof CompareVersionsView>[0]> = {}) => renderToStaticMarkup(
  <CompareVersionsView
    cells={cells}
    totalMembers={6}
    playing={false}
    timeSeconds={3}
    durationSeconds={12}
    translate={translate}
    onTogglePlay={noop}
    onSeek={noop}
    onChoose={noop}
    onRetry={noop}
    onClose={noop}
    {...overrides}
  />,
);

const html = view();
assert.match(html, /role="dialog"/);
assert.match(html, /aria-label="比较版本"/);
assert.match(html, /<video[^>]*src="\/media\/uploads\/a\.mp4"/, 'a finished version plays its 480p render');
assert.equal((html.match(/<video/g) ?? []).length, 2, 'only finished versions mount a player');
assert.match(html, /Más aire en el coro/, 'version notes travel with the card');
assert.match(html, /42%/, 'a rendering version shows its progress');
assert.match(html, /export_media_not_ready/, 'a failed render says why');
assert.match(html, /data-timeline="b" data-status="chosen"/);
assert.match(html, /data-status="discarded"/);
assert.match(html, /只显示前 4 个版本/, 'a larger group says only four are shown');
assert.match(html, /0:03 \/ 0:12/, 'one clock is shown for every player');
assert.match(html, /<button[^>]*disabled=""[^>]*>已选用<\/button>/, 'the chosen version cannot be chosen again');
assert.equal((html.match(/选用此版本/g) ?? []).length, 3, 'every other version offers the pick');
assert.match(html, /<button[^>]*>重试<\/button>/, 'a failed preview can be retried');

const playing = view({ playing: true });
assert.match(playing, /暂停所有/);
assert.match(playing, /选用此版本/);

const empty = view({ cells: [], totalMembers: 0 });
assert.match(empty, /没有可比较的版本/);

// ── Wiring ──
const tabs = readFileSync(new URL('./TimelineTabs.tsx', import.meta.url), 'utf8');
assert.match(tabs, /variantGroups\(doc\)/, 'the tab bar only offers the dialog when a group exists');
assert.match(tabs, /<CompareVersionsDialog\b/);
assert.match(tabs, /groupId=\{compareGroup\}/);

const dialog = readFileSync(new URL('./CompareVersionsDialog.tsx', import.meta.url), 'utf8');
assert.match(dialog, /commands\.chooseVariant\(groupId, timelineId\)/, 'the pick goes through the document command');
assert.match(dialog, /submitVariantPreviewJob\(docRef\.current, member\)/, 'previews use the shared 480p submitter');
assert.match(dialog, /cancelRenderJob\(renderId\)/, 'closing cancels unfinished previews');
assert.match(dialog, /needsSync\(now, video\.currentTime\)/, 'followers are corrected against the master clock');

const tool = readFileSync(new URL('../../agent/tools/export-tools.ts', import.meta.url), 'utf8');
assert.match(tool, /submitVariantPreviewJob/, 'the agent tool and the dialog share one preview contract');

console.log('variantCompare.verify: grid cap, sync clock, statuses and wiring OK');
