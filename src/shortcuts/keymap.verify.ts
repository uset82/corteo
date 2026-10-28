// Pure-logic regression for the user keymap overlay. localStorage/navigator are absent
// under node — the module guards them (falls back to defaults / non-mac).
// Wired into verify:shortcuts (npm pretest).
import assert from 'node:assert';
import { SHORTCUT_CATALOG } from './catalog';
import {
  effectiveCatalog, setBinding, resetBinding, resetAllBindings, isCustomized, customizedCount,
  chordFromEvent, findConflicts, activePresetId, setPreset,
} from './keymap';
import { parseBindingAlts } from './match';
import { SHORTCUT_PRESETS } from './presets';

const keysOf = (id: string): string => effectiveCatalog().find((a) => a.id === id)!.keys;

resetAllBindings();

// ── default overlay == catalog ──
assert.equal(customizedCount(), 0, 'no overrides initially');
assert.equal(keysOf('undo'), SHORTCUT_CATALOG.find((a) => a.id === 'undo')!.keys, 'undo default');

// ── override + persistence-shape + reset ──
setBinding('undo', 'Mod + Y');
assert.equal(keysOf('undo'), 'Mod + Y', 'override applied');
assert.equal(isCustomized('undo'), true, 'marked customized');
assert.equal(customizedCount(), 1, 'one override');
// unrelated action untouched
assert.equal(keysOf('play-pause'), 'Space', 'others unchanged');
resetBinding('undo');
assert.equal(keysOf('undo'), SHORTCUT_CATALOG.find((a) => a.id === 'undo')!.keys, 'reset restores default');
assert.equal(customizedCount(), 0, 'override cleared');

// ── chordFromEvent — inject the platform so the same contracts run on every CI host. ──
const ev = (o: Partial<KeyboardEvent>) => ({ key: 'a', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...o }) as KeyboardEvent;
const macChord = (o: Partial<KeyboardEvent>) => chordFromEvent(ev(o), true);
assert.equal(macChord({ key: 'z', metaKey: true }), 'Mod + Z', 'mac: cmd+z → Mod + Z');
assert.equal(macChord({ key: 'z', metaKey: true, shiftKey: true }), 'Mod + Shift + Z', 'mac: cmd+shift+z');
assert.equal(macChord({ key: 'z', ctrlKey: true }), 'Ctrl + Z', 'mac: ctrl is distinct from Mod');
assert.equal(chordFromEvent(ev({ key: 'z', ctrlKey: true }), false), 'Mod + Z', 'non-mac: ctrl+z → Mod + Z');
assert.equal(chordFromEvent(ev({ key: 'z', metaKey: true }), false), 'Z', 'non-mac: meta is not Mod');
assert.equal(macChord({ key: 'k', altKey: true }), 'Alt + K', 'alt+k');
assert.equal(macChord({ key: ' ' }), 'Space', 'space');
assert.equal(macChord({ key: 'ArrowLeft' }), '←', 'arrow');
assert.equal(macChord({ key: 'Shift', shiftKey: true }), null, 'bare modifier → null');
assert.equal(macChord({ key: 'Escape' }), null, 'escape → null');

// ── conflict detection: another action bound to undo's chord conflicts with undo ──
const conflicts = findConflicts(SHORTCUT_CATALOG, 'play-pause', SHORTCUT_CATALOG.find((a) => a.id === 'undo')!.keys);
assert.ok(conflicts.some((c) => c.id === 'undo'), 'Mod+Z conflicts with undo');
// self is never a conflict
assert.ok(!findConflicts(SHORTCUT_CATALOG, 'undo', 'Mod + Z').some((c) => c.id === 'undo'), 'self excluded');
// a free chord has no conflicts
assert.equal(findConflicts(SHORTCUT_CATALOG, 'undo', 'Mod + Alt + Shift + Y').length, 0, 'free chord clean');

resetAllBindings();

// ── P2-6: the Premiere Pro preset ──
assert.ok(SHORTCUT_PRESETS.some((p) => p.id === 'premiere'), 'the premiere preset exists');
assert.ok(SHORTCUT_PRESETS.some((p) => p.id === 'default'), 'the default preset exists');
assert.equal(activePresetId(), 'default', 'default preset is active out of the box');

// The default preset is the catalog: nothing the Premiere preset touches leaks into it.
assert.equal(keysOf('split'), 'C / Enter', 'default C splits');
assert.equal(keysOf('interaction-mode-blade'), 'B', 'default B is the blade');
assert.equal(keysOf('interaction-mode-slip'), 'U', 'default slip is U');
assert.equal(keysOf('interaction-mode-trim'), 'N', 'default N is trim');
assert.equal(keysOf('select-after'), 'Y', 'default Y selects forward');
assert.equal(keysOf('nudge-right'), 'R / Shift + R', 'default R nudges');
assert.equal(keysOf('interaction-mode-rate-stretch'), '', 'rate stretch is unbound by default');

setPreset('premiere');
assert.equal(activePresetId(), 'premiere', 'preset switched');
// Every Premiere key the editor can honour reaches its tool.
assert.equal(keysOf('interaction-mode-blade'), 'C', 'C is the razor');
assert.equal(keysOf('interaction-mode-slip'), 'Y', 'Y slips');
assert.equal(keysOf('interaction-mode-rate-stretch'), 'R', 'R rate-stretches');
assert.equal(keysOf('interaction-mode-trim'), 'T', 'T trims');
assert.equal(keysOf('split'), 'Mod + K', 'the playhead cut moved to Add Edit');
assert.equal(keysOf('select-after'), 'Shift + Y', 'Y was taken, so select-forward moved');
assert.equal(keysOf('nudge-right'), 'Shift + R', 'R was taken, so nudge kept Shift + R');
// The keys the card says to keep.
assert.equal(keysOf('shuttle-back'), 'J');
assert.equal(keysOf('shuttle-pause'), 'K');
assert.equal(keysOf('shuttle-fwd'), 'L');
assert.equal(keysOf('zone-in'), 'I');
assert.equal(keysOf('zone-out'), 'O');
assert.equal(keysOf('trim-start'), 'Q');
assert.equal(keysOf('trim-end'), 'W');
assert.equal(keysOf('interaction-mode-selection'), 'V');
assert.equal(keysOf('interaction-mode-pen'), 'P');

// B (ripple edit) and N (rolling edit) are unbound: corteo has neither tool, so no
// action may claim those bare keys. Modified chords such as Mod + Shift + B are other
// actions entirely and do not count.
const bareKeys = new Set(effectiveCatalog().flatMap((a) => parseBindingAlts(a.keys)
  .filter((c) => !c.mod && !c.ctrl && !c.alt && !c.shift)
  .map((c) => c.key)));
for (const key of ['b', 'n']) {
  assert.equal(bareKeys.has(key), false, `${key.toUpperCase()} must stay unbound in the premiere preset`);
}

// No two actions may share a key inside the preset.
for (const action of effectiveCatalog()) {
  const clashes = findConflicts(effectiveCatalog(), action.id, action.keys);
  assert.deepEqual(
    clashes.map((c) => c.id),
    [],
    `premiere preset: ${action.id} (${action.keys}) shares a key with ${clashes.map((c) => c.id).join(', ')}`,
  );
}

// A manual rebinding still wins, and resetting it returns to the preset.
setBinding('interaction-mode-slip', 'Alt + Y');
assert.equal(keysOf('interaction-mode-slip'), 'Alt + Y', 'user override beats the preset');
resetBinding('interaction-mode-slip');
assert.equal(keysOf('interaction-mode-slip'), 'Y', 'reset falls back to the preset key');

setPreset('default');
assert.equal(keysOf('interaction-mode-slip'), 'U', 'back to the default preset');
resetAllBindings();
console.log('keymap.verify.ts OK');
