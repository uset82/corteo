import assert from 'node:assert/strict';
import { SETTINGS_CATEGORIES } from './settingsSchema.ts';
import { findVisibleGroup, visibleSettingsCategories } from './settingsVisibility.ts';

const full = visibleSettingsCategories(false);
assert.equal(full.length, SETTINGS_CATEGORIES.length, 'the switch off keeps every settings category');
assert.ok(full.some((category) => category.key === 'generation'));

const limited = visibleSettingsCategories(true);
assert.equal(limited.some((category) => category.key === 'generation'), false, 'AI generation panes are hidden');
assert.ok(limited.some((category) => category.key === 'agent'), 'the chat model settings stay');
const assets = limited.find((category) => category.key === 'assets');
assert.ok(assets);
assert.equal(assets.groups.some((group) => group.key === 'stock'), false);
const transcription = assets.groups.find((group) => group.key === 'transcription');
assert.ok(transcription);
assert.deepEqual(transcription.vendors.map((page) => page.key), ['transcription/local']);
assert.equal(transcription.route, undefined, 'the cloud transcription route selector is hidden');
assert.equal(limited.some((category) => category.key === 'tools'), false,
  'paid sandbox, web and publish panes are hidden');
assert.notEqual(findVisibleGroup('stock', true).key, 'stock');
assert.equal(findVisibleGroup('llm', true).key, 'llm');

console.log('settingsVisibility.verify: paid panes hide and the chat settings stay');
