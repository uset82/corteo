import type { KenBurnsDirection } from '../editor/kenBurns';

/** Chinese base keys (translated by t()) and display order shared by the inspector and clip menu. */
export const KEN_BURNS_LABEL_KEYS: Record<KenBurnsDirection, string> = {
  random: '自动',
  in: '推近',
  out: '拉远',
  left: '左移',
  right: '右移',
  up: '上移',
  down: '下移',
};

export const KEN_BURNS_MENU_ORDER: readonly KenBurnsDirection[] = ['random', 'in', 'out', 'left', 'right', 'up', 'down'];
