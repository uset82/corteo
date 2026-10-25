import { providersOff as providersOffNow } from '../../agent/providers-off';
import {
  SETTINGS_CATEGORIES,
  type SettingsCategory,
  type SettingsGroup,
} from './settingsSchema';

const HIDDEN_CATEGORIES = new Set(['generation']);
const HIDDEN_GROUPS = new Set(['stock', 'sandbox', 'web', 'publish']);

function visibleGroup(group: SettingsGroup, providersOff: boolean): SettingsGroup | null {
  if (!providersOff) return group;
  if (HIDDEN_GROUPS.has(group.key)) return null;
  if (group.key !== 'transcription') return group;
  return {
    ...group,
    route: undefined,
    vendors: group.vendors.filter((page) => page.key === 'transcription/local'),
  };
}

/** Settings tree the dialog shows. Paid generation, stock and cloud transcription
 * disappear when the deployment forces free and local models only. */
export function visibleSettingsCategories(providersOff = providersOffNow()): readonly SettingsCategory[] {
  if (!providersOff) return SETTINGS_CATEGORIES;
  return SETTINGS_CATEGORIES.flatMap((category) => {
    if (HIDDEN_CATEGORIES.has(category.key)) return [];
    const groups = category.groups
      .map((group) => visibleGroup(group, true))
      .filter((group): group is SettingsGroup => group !== null);
    return groups.length > 0 ? [{ ...category, groups }] : [];
  });
}

export function findVisibleGroup(key: string, providersOff = providersOffNow()): SettingsGroup {
  const categories = visibleSettingsCategories(providersOff);
  return categories.flatMap((category) => category.groups).find((group) => group.key === key)
    ?? categories[0].groups[0];
}
