import assert from 'node:assert/strict';
import {
  applyAgentModelStatus, applyClaudeCodeAgentStatus, applyDshModels, getAgentModelSnapshot,
  getDshHarnessState, isAgentModelReady, selectAgentModel, type AgentModelSnapshot,
} from './model-selection';
import { MODEL, PROVIDER } from './providerConfig';
import {
  parseModelCapabilityOverrides,
  resolveModelCapabilities,
  serializeModelCapabilityOverrides,
} from '../../shared/model-capabilities';

const unknownCapabilities = resolveModelCapabilities({
  backend: 'api', provider: 'openai', modelId: 'custom/model:v2',
});
const configured: AgentModelSnapshot = {
  loaded: true,
  activeId: 'openai:gpt-test',
  choices: [{
    id: 'openai:gpt-test',
    backend: 'api',
    provider: 'openai',
    providerLabel: 'OpenAI',
    model: 'gpt-test',
    capabilities: unknownCapabilities,
  }],
};

assert.equal(isAgentModelReady(configured), true);
assert.equal(isAgentModelReady({ ...configured, loaded: false }), false, 'startup hydration blocks first send');
assert.equal(isAgentModelReady({ ...configured, activeId: '' }), false, 'missing active model blocks send');
assert.equal(isAgentModelReady({ ...configured, activeId: 'openai:missing' }), false, 'stale selection blocks send');
assert.equal(isAgentModelReady({ ...configured, choices: [] }), false, 'unconfigured providers block send');

const known = resolveModelCapabilities({ backend: 'api', provider: 'openai', modelId: 'gpt-5' });
assert.deepEqual(known.contextWindowTokens, { value: 400_000, estimated: false, source: 'catalog' });
assert.deepEqual(known.maxInputTokens, { value: 272_000, estimated: false, source: 'catalog' });
assert.deepEqual(known.maxOutputTokens, { value: 128_000, estimated: false, source: 'catalog' });
assert.deepEqual(known.supportsTools, { value: true, estimated: false, source: 'catalog' });
assert.deepEqual(known.supportsImages, { value: true, estimated: false, source: 'catalog' });
const gpt56 = resolveModelCapabilities({ backend: 'api', provider: 'openai', modelId: 'gpt-5.6-sol' });
assert.deepEqual(gpt56.contextWindowTokens, { value: 1_050_000, estimated: false, source: 'catalog' });
assert.deepEqual(gpt56.maxInputTokens, { value: 922_000, estimated: false, source: 'catalog' });
assert.deepEqual(gpt56.maxOutputTokens, { value: 128_000, estimated: false, source: 'catalog' });

assert.deepEqual(unknownCapabilities.contextWindowTokens, {
  value: 409_600, estimated: true, source: 'provider-fallback',
});
assert.deepEqual(unknownCapabilities.maxInputTokens, {
  value: 344_064, estimated: true, source: 'provider-fallback',
});
assert.deepEqual(unknownCapabilities.maxOutputTokens, {
  value: 65_536, estimated: true, source: 'provider-fallback',
});
assert.deepEqual(unknownCapabilities.supportsImages, {
  value: false, estimated: true, source: 'provider-fallback',
});
assert.deepEqual(unknownCapabilities.supportsTools, {
  value: false, estimated: true, source: 'provider-fallback',
});

const overrides = parseModelCapabilityOverrides(JSON.stringify([{
  backend: 'api',
  provider: 'openai',
  modelId: ' custom/model:v2 ',
  contextWindowTokens: 65_536,
  maxInputTokens: 60_000,
  maxOutputTokens: 4_096,
  supportsTools: false,
  supportsImages: true,
}]));
const overridden = resolveModelCapabilities(
  { backend: 'api', provider: 'openai', modelId: 'custom/model:v2' },
  overrides,
);
assert.deepEqual(overridden.contextWindowTokens, {
  value: 65_536, estimated: false, source: 'settings-override',
});
assert.deepEqual(overridden.maxInputTokens, {
  value: 60_000, estimated: false, source: 'settings-override',
});
assert.deepEqual(overridden.maxOutputTokens, {
  value: 4_096, estimated: false, source: 'settings-override',
});
assert.equal(overridden.supportsTools.value, false);
assert.equal(overridden.supportsImages.value, true);
assert.equal(serializeModelCapabilityOverrides(overrides).includes(' custom/model:v2 '), false);

assert.throws(() => parseModelCapabilityOverrides('[{"backend":"api","provider":"openai","modelId":"x","apiKey":"secret"}]'), /Unknown/);
assert.throws(() => parseModelCapabilityOverrides(JSON.stringify([
  { backend: 'api', provider: 'openai', modelId: 'x', supportsTools: true },
  { backend: 'api', provider: 'openai', modelId: 'x', supportsImages: true },
])), /Duplicate/);
assert.throws(() => parseModelCapabilityOverrides(JSON.stringify([{
  backend: 'api', provider: 'openai', modelId: 'x', supportsReasoning: false, reasoningEfforts: ['high'],
}])), /Disabled reasoning/);
assert.throws(() => parseModelCapabilityOverrides(JSON.stringify([{
  backend: 'api', provider: 'openai', modelId: 'x', contextWindowTokens: 8_192, maxInputTokens: 8_193,
}])), /input limit exceeds/);

// ── Claude Code backend: provider/backend pairing is enforced ────────────────
assert.throws(
  () => parseModelCapabilityOverrides(JSON.stringify([
    { backend: 'claude-code', provider: 'openai', modelId: 'sonnet', supportsTools: true },
  ])),
  /Anthropic provider/,
  'claude-code capabilities are rejected for a non-Anthropic provider',
);
assert.doesNotThrow(
  () => parseModelCapabilityOverrides(JSON.stringify([
    { backend: 'claude-code', provider: 'anthropic', modelId: 'sonnet', supportsTools: true },
  ])),
  'claude-code + anthropic is a valid capability identity',
);

// ── Claude Code choices only appear installed + signed in ────────────────────
applyClaudeCodeAgentStatus({ installed: false, version: null, account: null });
assert.equal(
  getAgentModelSnapshot().choices.some((choice) => choice.backend === 'claude-code'),
  false,
  'not installed yields no claude-code choices',
);

applyClaudeCodeAgentStatus({
  installed: true,
  version: '2.1.260',
  account: { loggedIn: false, email: null, subscriptionType: null, authMethod: null },
});
assert.equal(
  getAgentModelSnapshot().choices.some((choice) => choice.backend === 'claude-code'),
  false,
  'installed but signed out yields no claude-code choices',
);

applyClaudeCodeAgentStatus(
  {
    installed: true,
    version: '2.1.260',
    account: { loggedIn: true, email: 'user@example.com', subscriptionType: 'max', authMethod: 'claude.ai' },
  },
  '',
  [{ id: 'sonnet', label: 'Claude Sonnet', isDefault: true }],
);
const claudeCodeSnapshot = getAgentModelSnapshot();
const claudeCodeChoice = claudeCodeSnapshot.choices.find((choice) => choice.backend === 'claude-code');
assert.ok(claudeCodeChoice, 'installed + signed in with a discovered model yields a claude-code choice');
assert.equal(claudeCodeChoice!.id, 'claude-code:sonnet');
assert.equal(claudeCodeChoice!.provider, 'anthropic');
assert.equal(claudeCodeChoice!.model, 'sonnet');
assert.equal(claudeCodeSnapshot.activeId, 'claude-code:sonnet',
  'the sole claude-code choice becomes active when nothing else is configured');

// ── DeepSeek Harness: one choice per discovered model, with fallbacks ───────
const prefStore = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => prefStore.get(key) ?? null,
    setItem: (key: string, value: string) => { prefStore.set(key, value); },
    removeItem: (key: string) => { prefStore.delete(key); },
  },
});
const dshChoices = () => getAgentModelSnapshot().choices.filter((choice) => choice.provider === 'dsh');

applyAgentModelStatus({}, {});
assert.equal(dshChoices().length, 0, 'an unconfigured harness adds no entries');

applyAgentModelStatus({ LLM_DSH_API_KEY: { configured: true } }, {});
assert.deepEqual(dshChoices().map((choice) => choice.id), ['dsh:combo:recommended-free'],
  'a configured harness lists its default model before discovery runs');

applyDshModels(['combo:recommended-free', 'deepseek-v3', 'qwen3-free'], false);
assert.deepEqual(
  dshChoices().map((choice) => choice.id),
  ['dsh:combo:recommended-free', 'dsh:deepseek-v3', 'dsh:qwen3-free'],
  'discovery replaces the single row with one entry per model (ids keep their colons)',
);
assert.equal(getDshHarnessState().down, false);
const secondDsh = dshChoices()[1]!;
assert.equal(secondDsh.model, 'deepseek-v3');
assert.equal(secondDsh.capabilities.contextWindowTokens.value, 131_072);
assert.equal(secondDsh.capabilities.maxOutputTokens.value, 16_384);
assert.equal(secondDsh.capabilities.supportsTools.value, true,
  'unknown harness models must keep tool calling enabled');
selectAgentModel(secondDsh.id);
assert.equal(getAgentModelSnapshot().activeId, 'dsh:deepseek-v3');
assert.equal(PROVIDER, 'dsh', 'picking a harness choice switches the runtime provider');
assert.equal(MODEL, 'deepseek-v3', 'the picked model is what /llm runs will request');

applyDshModels([], true);
assert.equal(getDshHarnessState().down, true);
assert.ok(dshChoices().some((choice) => choice.id === 'dsh:deepseek-v3'),
  'a failed discovery keeps the last pick selectable');
assert.equal(getAgentModelSnapshot().activeId, 'dsh:deepseek-v3');

applyAgentModelStatus({ LLM_DSH_API_KEY: { configured: true } }, { LLM_DSH_MODEL: 'saved-model' });
assert.ok(dshChoices().some((choice) => choice.id === 'dsh:saved-model'),
  'a failed discovery also keeps the saved LLM_DSH_MODEL');
assert.ok(dshChoices().some((choice) => choice.id === 'dsh:deepseek-v3'));

applyDshModels(['alpha', 'beta'], false);
assert.deepEqual(dshChoices().map((choice) => choice.id), ['dsh:alpha', 'dsh:beta'],
  'refresh replaces the list with the newly discovered models');

console.log('model-selection.verify: ok');
