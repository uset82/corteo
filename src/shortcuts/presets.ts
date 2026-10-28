// Keyboard presets (P2-6). A preset is nothing but a set of key overrides laid
// UNDER the user's own rebindings, so the editor keeps one catalog and one
// matcher: switching preset never discards a manual binding, and "default" is
// simply "no overrides at all". keymap.ts applies them; ShortcutsDialog.tsx is
// the only place that picks them.
export interface ShortcutPreset {
  id: string;
  /** Chinese dictionary key for t(); the dialog is the only renderer. */
  labelKey: string;
  /** Chinese dictionary key for t(); shown beside the picker while active. */
  descriptionKey?: string;
  /**
   * actionId → binding, for the actions that differ from the default catalog.
   * An empty string unbinds that action inside this preset.
   */
  bindings: Record<string, string>;
}

export const DEFAULT_PRESET_ID = 'default';

export const SHORTCUT_PRESETS: ShortcutPreset[] = [
  { id: DEFAULT_PRESET_ID, labelKey: '默认', bindings: {} },
  {
    id: 'premiere',
    labelKey: 'Premiere Pro 预设',
    descriptionKey: 'C 刀片、Y 滑移、R 变速、T 修剪；编辑器没有波纹编辑和滚动编辑，B 和 N 未绑定。',
    bindings: {
      // C is Premiere's razor tool, so the click-to-cut blade moves onto it. The
      // playhead cut that shared C goes to Premiere's Add Edit (Mod + K) instead of
      // becoming unreachable.
      'interaction-mode-blade': 'C',
      'split': 'Mod + K',
      // Y is Premiere's slip tool, so "select clips forward" steps aside to Shift + Y.
      'interaction-mode-slip': 'Y',
      'select-after': 'Shift + Y',
      // R is Premiere's rate stretch tool; the 1-frame nudge keeps Shift + R.
      'interaction-mode-rate-stretch': 'R',
      'nudge-right': 'Shift + R',
      // T is Premiere's trim tool. Trim used to live on N, and N belongs to rolling
      // edit, which corteo does not have — so B and N end up unbound, as the card asks.
      'interaction-mode-trim': 'T',
    },
  },
];

export const PRESET_BY_ID: Record<string, ShortcutPreset> = Object.fromEntries(
  SHORTCUT_PRESETS.map((preset) => [preset.id, preset]),
);
