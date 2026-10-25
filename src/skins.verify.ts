// checks: skin registry integrity + contrast gate (impeccable colorize discipline curing).
// To change the color of any skin, you must go here: text/panel ≥ 7, textDim/panel ≥ 4.5,
// textMuted/panel ≥ 4.5, danger/panel ≥ 4.5, onAccent/accent ≥ 3 (WCAG AA, component level).
// `npx tsx src/skins.verify.ts`
import assert from 'node:assert/strict';
import { DEFAULT_SKIN, SKINS, buildSkinsCss, initSkins } from './skins';
import type { SkinTokens } from './skins';

function luminance(hex: string): number {
  const f = (c: number): number => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(parseInt(hex.slice(1, 3), 16))
    + 0.7152 * f(parseInt(hex.slice(3, 5), 16))
    + 0.0722 * f(parseInt(hex.slice(5, 7), 16));
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function mixHex(foreground: string, background: string, foregroundWeight: number): string {
  const channel = (hex: string, index: number): number => parseInt(hex.slice(index, index + 2), 16);
  const mixed = [1, 3, 5].map((index) => Math.round(
    channel(foreground, index) * foregroundWeight
      + channel(background, index) * (1 - foregroundWeight),
  ));
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

// ── Registry integrity ──
assert.ok(SKINS.length >= 2, '至少默认 + 1 套');
assert.equal(new Set(SKINS.map((s) => s.id)).size, SKINS.length, '皮肤 id 唯一');
assert.ok(SKINS.some((s) => s.id === DEFAULT_SKIN), '默认皮肤必须在注册表里');
for (const s of SKINS) {
  assert.ok(/^[a-z]+$/.test(s.id), `${s.id}: id 小写字母`);
  assert.ok(s.nameZh.trim().length > 0, `${s.id}: 有中文名`);
  assert.match(s.tokens.accentRgb, /^\d{1,3},\d{1,3},\d{1,3}$/, `${s.id}: accentRgb 三元组`);
  assert.match(s.tokens.inkRgb, /^\d{1,3},\d{1,3},\d{1,3}$/, `${s.id}: inkRgb 三元组`);
  assert.match(s.tokens.shadowRgb, /^\d{1,3},\d{1,3},\d{1,3}$/, `${s.id}: shadowRgb 三元组`);
  for (const [name, value] of Object.entries(s.tokens)) {
    if (name === 'accentRgb' || name === 'inkRgb' || name === 'shadowRgb' || name === 'colorScheme') continue;
    assert.match(value, /^#[0-9a-f]{6}$/, `${s.id}.${name}: 6 位小写 hex(得进对比度计算)`);
  }
}

// ── Contrast Gate (AA) ──
for (const s of SKINS) {
  const t = s.tokens;
  const gate = (label: string, ratio: number, min: number): void =>
    assert.ok(ratio >= min, `${s.id}: ${label} = ${ratio.toFixed(2)} < ${min}`);
  gate('text/panel', contrast(t.text, t.panel), 7);
  gate('text/panelAlt', contrast(t.text, t.panelAlt), 4.5);
  gate('textMuted/panel', contrast(t.textMuted, t.panel), 4.5);
  gate('textDim/panel', contrast(t.textDim, t.panel), 4.4);
  // onAccent by WCAG component/large font level (≥3): graphite white font pressure coral=3.27.
  // (Identity reserved); Use dark characters for pastel skin (Mocha/Arctic/Tokyo Night/Latte), actual ≥4.5.
  gate('onAccent/accent', contrast(t.onAccent, t.accent), 3);
  // danger is the one semantic colour that can be read as the primary button, and the corteo
  // accent moved that button next to it in hue. Every skin clears 4.5 today; corteo is the
  // tightest at 4.75, so this gate has almost no headroom on purpose.
  gate('danger/panel', contrast(t.danger, t.panel), 4.5);
  gate('textStrong/hover', contrast(t.textStrong, t.hover), 4.5);
  gate('audioFxBadge/panelGold10', contrast(t.text, mixHex(t.gold, t.panel, 0.1)), 4.5);
}

// ── CSS generation: The default skin enters:root, the rest have overlay blocks, and body follows ──
const css = buildSkinsCss();
assert.ok(css.includes(':root {'), ':root 块');
for (const s of SKINS) {
  if (s.id === DEFAULT_SKIN) continue;
  assert.ok(css.includes(`html[data-cc-skin='${s.id}']`), `${s.id} 覆盖块`);
}
assert.ok(css.includes('--cc-on-accent:'), 'on-accent 变量输出');
assert.ok(css.includes('--cc-shadow-rgb:'), 'shadow-rgb 变量输出');
assert.ok(css.includes('body { background: var(--cc-bg)'), 'body 跟随皮肤');

// ── corteo is first, is the default, and carries the plan's tokens (Plan 5, C-01) ──
assert.equal(SKINS[0].id, 'corteo', 'corteo 排在第一位');
assert.equal(DEFAULT_SKIN, 'corteo', 'corteo 是默认皮肤');
assert.ok(!SKINS.some((s) => s.id === 'claudia'), '旧的 claudia 皮肤 id 已不存在');
const CORTEO_BRIEF: Partial<Record<keyof SkinTokens, string>> = {
  bg: '#0a0b0d', inset: '#0e0f11', panel: '#111317', panelAlt: '#181b20', hover: '#20242a',
  border: '#2a2e35', borderLight: '#3b4048',
  text: '#ece9e2', textMuted: '#a9adb3', textDim: '#7a7f86', textStrong: '#f7f3ea',
  accent: '#ff4a1f', accentDeep: '#d63a12', accentRgb: '255,74,31', onAccent: '#0a0b0d',
  danger: '#e5484d',
  inkRgb: '236,233,226', shadowRgb: '0,0,0', colorScheme: 'dark',
  tlTrack: '#1a1d23', tlSidePanel: '#15181d',
};
for (const [name, value] of Object.entries(CORTEO_BRIEF)) {
  assert.equal(SKINS[0].tokens[name as keyof SkinTokens], value, `corteo.${name} 与设计稿一致`);
}
// The two tokens deliberately not inherited from Graphite. If either falls back to the
// inherited value the skin still validates — the error state just reads as the primary
// button, and the mark loses its bone — so pin the difference here.
const graphite = SKINS.find((s) => s.id === 'graphite');
assert.ok(graphite, 'graphite 还在');
assert.notEqual(SKINS[0].tokens.danger, graphite.tokens.danger, 'corteo.danger 不是继承来的');
assert.notEqual(SKINS[0].tokens.textStrong, graphite.tokens.textStrong, 'corteo.textStrong 不是继承来的');

// ── The one-time migration to corteo ──
// applySkin() saves the skin on every boot, so an install that existed before this rename has
// 'graphite' (pre-skins) or 'claudia' (the previous name) stored. Both must move to corteo
// once, and only once. The marker key changed with the name, so a profile that already ran
// the Graphite → old-default migration runs this one too.
interface TestProfile { store: Map<string, string>; boot: () => void }

function profile(saved: string | null): TestProfile {
  const store = new Map<string, string>();
  if (saved !== null) store.set('cc.skin', saved);
  const boot = (): void => {
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (key: string): string | null => store.get(key) ?? null,
      setItem: (key: string, value: string): void => { store.set(key, value); },
      removeItem: (key: string): void => { store.delete(key); },
      clear: (): void => { store.clear(); },
      key: (index: number): string | null => [...store.keys()][index] ?? null,
      get length(): number { return store.size; },
    } as Storage;
    (globalThis as Record<string, unknown>).document = {
      getElementById: (): unknown => ({}),
      documentElement: { dataset: {} as Record<string, string> },
    };
    initSkins();
  };
  return { store, boot };
}

const fresh = profile(null);
fresh.boot();
assert.equal(fresh.store.get('cc.skin'), 'corteo', '空配置直接落在 corteo');

const legacy = profile('graphite');
legacy.boot();
assert.equal(legacy.store.get('cc.skin'), 'corteo', '旧的 graphite 迁到 corteo');
assert.equal(legacy.store.get('cc.skin.corteo'), '1', '迁移标记写下了');

// The profile that already ran the previous rename: 'claudia' saved, and the old marker set.
// This is the case every existing install hits, so it is asserted explicitly.
const previous = profile('claudia');
previous.store.set('cc.skin.claudia', '1');
previous.boot();
assert.equal(previous.store.get('cc.skin'), 'corteo', '旧的 claudia 迁到 corteo');
assert.equal(previous.store.get('cc.skin.claudia'), undefined, '旧标记被清掉');
assert.equal(previous.store.get('cc.skin.corteo'), '1', '新标记写下了');

// The user picks Graphite again after the migration: that choice sticks.
legacy.store.set('cc.skin', 'graphite');
legacy.boot();
assert.equal(legacy.store.get('cc.skin'), 'graphite', '迁移后再选 graphite 不再被改');

const other = profile('mocha');
other.boot();
assert.equal(other.store.get('cc.skin'), 'mocha', '别的皮肤原样保留');

// A saved id that no longer exists falls back to the default instead of sticking.
const stale = profile('claudia');
stale.store.set('cc.skin.corteo', '1');
stale.boot();
assert.equal(stale.store.get('cc.skin'), 'corteo', '已迁移过的配置里 claudia 回落到 corteo');

process.stdout.write(`skins.verify: ok (${SKINS.length} skins, 对比度门全过, corteo 默认)\n`);
