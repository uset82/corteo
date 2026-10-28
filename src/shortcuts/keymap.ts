// User keymap overlay for the shortcut system: the default preset (SHORTCUT_CATALOG)
// with per-action user rebindings applied, persisted to localStorage. The dispatcher matches
// against effectiveCatalog(); the settings dialog rebinds via setBinding/resetBinding. Kept
// pure of React so both can share it (a tiny listener store drives re-renders).
import { SHORTCUT_CATALOG, type ShortcutAction } from './catalog';
import { parseBindingAlts, normalizeKey, type ParsedChord } from './match';
import { DEFAULT_PRESET_ID, PRESET_BY_ID } from './presets';

const LS_KEY = 'cc.keymap.v1';
const LS_PRESET_KEY = 'cc.keymap.preset.v1';
type UserKeymap = Record<string, string>; // actionId → override binding string

function readLS(): UserKeymap {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
    if (!raw) return {};
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== 'object') return {};
    // keep only known action ids with string bindings
    const known = new Set(SHORTCUT_CATALOG.map((a) => a.id));
    const out: UserKeymap = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (known.has(k) && typeof v === 'string' && v.trim()) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeLS(m: UserKeymap): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, JSON.stringify(m)); } catch { /* private mode / quota */ }
}

function readPresetLS(): string {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_PRESET_KEY) : null;
    return raw && PRESET_BY_ID[raw] ? raw : DEFAULT_PRESET_ID;
  } catch {
    return DEFAULT_PRESET_ID;
  }
}

let userKeymap: UserKeymap = readLS();
let activePreset: string = readPresetLS();
let cache: ShortcutAction[] | null = null;
const listeners = new Set<() => void>();

function invalidate(): void {
  cache = null;
  for (const fn of listeners) fn();
}

/** Subscribe to keymap changes (returns an unsubscribe). Used by the settings dialog. */
export function subscribeKeymap(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** The preset chosen in the shortcuts dialog; survives reloads. */
export function activePresetId(): string { return activePreset; }

/** Switch preset. Manual rebindings are kept and still win over the preset. */
export function setPreset(id: string): void {
  if (!PRESET_BY_ID[id] || id === activePreset) return;
  activePreset = id;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(LS_PRESET_KEY, id); } catch { /* private mode / quota */ }
  invalidate();
}

/** The catalog with the active preset and then the user overrides applied (memoized
 *  until either changes). The preset is the baseline, so a manual rebinding still
 *  wins and resetBinding falls back to the preset's key, not the factory one. */
export function effectiveCatalog(): ShortcutAction[] {
  if (!cache) {
    const preset = PRESET_BY_ID[activePreset]?.bindings ?? {};
    cache = SHORTCUT_CATALOG.map((a) => {
      const keys = a.id in userKeymap
        ? userKeymap[a.id]!
        : (a.id in preset ? preset[a.id]! : a.keys);
      return keys === a.keys ? a : { ...a, keys };
    });
  }
  return cache;
}

export function isCustomized(id: string): boolean { return id in userKeymap; }
export function customizedCount(): number { return Object.keys(userKeymap).length; }

export function setBinding(id: string, keys: string): void {
  const trimmed = keys.trim();
  if (!trimmed) return;
  userKeymap = { ...userKeymap, [id]: trimmed };
  writeLS(userKeymap);
  invalidate();
}

export function resetBinding(id: string): void {
  if (!(id in userKeymap)) return;
  const next = { ...userKeymap };
  delete next[id];
  userKeymap = next;
  writeLS(userKeymap);
  invalidate();
}

export function resetAllBindings(): void {
  if (!Object.keys(userKeymap).length) return;
  userKeymap = {};
  writeLS(userKeymap);
  invalidate();
}

const DISPLAY: Record<string, string> = {
  space: 'Space', arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓',
  backspace: 'Backspace', delete: 'Delete', enter: 'Enter', tab: 'Tab',
};

function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
}

/** Serialize a captured keydown → a canonical binding string ("Mod + Shift + Z"), or null
 *  for a bare modifier / Escape (not a usable single-key binding). Uses the same "Mod"
 *  convention the catalog + matcher use (⌘ on Mac, Ctrl elsewhere). `isMac` is injectable so
 *  verifies stay deterministic regardless of the host platform (navigator is absent under
 *  CI/node); callers that omit it keep the runtime platform probe. */
export function chordFromEvent(e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>, isMac?: boolean): string | null {
  const key = normalizeKey(e.key);
  if (['shift', 'control', 'alt', 'meta', 'escape', 'unidentified'].includes(key)) return null;
  const mac = isMac ?? isMacPlatform();
  const parts: string[] = [];
  if (mac ? e.metaKey : e.ctrlKey) parts.push('Mod');
  if (mac && e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(key in DISPLAY ? DISPLAY[key]! : (key.length === 1 ? key.toUpperCase() : key));
  return parts.join(' + ');
}

// Signature that uniquely identifies a chord regardless of formatting, for conflict checks.
function chordSig(c: ParsedChord): string {
  return `${c.mod ? 'M' : ''}${c.ctrl ? 'C' : ''}${c.alt ? 'A' : ''}${c.shift ? 'S' : ''}:${c.key}${c.withKey ? '+' + c.withKey : ''}`;
}

/** Other actions in `catalog` whose binding collides with `keys` (any shared chord). */
export function findConflicts(catalog: ShortcutAction[], id: string, keys: string): ShortcutAction[] {
  const target = new Set(parseBindingAlts(keys).map(chordSig));
  if (!target.size) return [];
  return catalog.filter((a) => a.id !== id && parseBindingAlts(a.keys).some((c) => target.has(chordSig(c))));
}
