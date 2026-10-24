// BQ-3 gate: the chat panel's copy and presets, without rendering the panel.
// `npx tsx src/components/chat/ChatPanelView.verify.tsx`
//
// The panel needs a live controller to render, so this checks what can go wrong
// silently instead: a starter that lost its pair of strings, a preset that still
// carries an icon tile, the old product name creeping back, and a t() literal
// with no English or Spanish entry.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EN } from '../../i18n/dict/en';
import esDict from '../../i18n/dict/es';
import esBrand from '../../i18n/dict/es/brand';
import { EMPTY_PROJECT_STARTERS, QUICK_ACTIONS } from './chatPanelPresets';

// The dictionaries as the app sees them: EN already merges brand.ts, Spanish is
// es/index.ts with es/brand.ts spread over it (see dictRegistry.ts).
const en: Record<string, string> = EN;
const es: Record<string, string> = { ...esDict, ...esBrand };

// ── Four starters, four quick actions, and no icon field ──
assert.equal(EMPTY_PROJECT_STARTERS.length, 4, '空工程只有四个起点');
assert.equal(QUICK_ACTIONS.length, 4, '快捷操作只有四个');
for (const starter of EMPTY_PROJECT_STARTERS) {
  assert.deepEqual(Object.keys(starter).sort(), ['description', 'label', 'prompt'], '起点没有 icon 字段');
}
for (const action of QUICK_ACTIONS) {
  assert.deepEqual(Object.keys(action).sort(), ['label', 'prompt'], '快捷操作没有 icon 字段');
}

// ── Every preset string has English and Spanish copy ──
const presetStrings = [
  ...EMPTY_PROJECT_STARTERS.flatMap((starter) => [starter.label, starter.description, starter.prompt]),
  ...QUICK_ACTIONS.flatMap((action) => [action.label, action.prompt]),
];
const missingEn = presetStrings.filter((text) => !(text in en));
const missingEs = presetStrings.filter((text) => !(text in es));
assert.deepEqual(missingEn, [], `预设缺英文：${missingEn.join(' / ')}`);
assert.deepEqual(missingEs, [], `预设缺西语：${missingEs.join(' / ')}`);

// ── Every t() literal in the panel and its banner has both languages ──
const sources = ['ChatPanelView.tsx', 'CapabilityGapBanner.tsx'].map(
  (name) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8'),
);
const literals = sources.flatMap((source) => [...source.matchAll(/\bt\('([^']+)'/g)].map((match) => match[1]));
assert.ok(literals.length > 0, '面板里应当有 t() 调用');
const untranslated = [...new Set(literals)].filter((key) => !(key in en) || !(key in es));
assert.deepEqual(untranslated, [], `这些 t() 字面量缺翻译：${untranslated.join(' / ')}`);

// ── The old identity is out of the panel ──
for (const source of sources) {
  assert.doesNotMatch(source, /OpenChatCut/, '面板里不能再出现上游名');
  assert.doesNotMatch(source, /cc-chat-starter-arrow|→/, '起点行不加箭头');
  assert.doesNotMatch(source, /cc-chat-starter-icon/, '起点行不加图标块');
}

console.log(`ChatPanelView.verify: ok（4 起点 / 4 快捷操作，${new Set(literals).size} 条文案双语）`);
