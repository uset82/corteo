import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadInitialProjects, refreshDshModels, syncAgentBackends, type ProjectStartupSource } from './appShell';
import { getActiveAgentModelChoice, getAgentModelSnapshot, getDshHarnessState, selectAgentModel, subscribeAgentModels } from '../agent/model-selection';
import type { ProjectMeta } from '../persist/projectStoreCoordinators';
import { syncDesktopNativeInferenceEnabled } from '../transcript/desktop-inference-preference';
import { providersOff } from '../agent/providers-off';
import { agentVendorPagesWithVision } from '../components/settings/settingsAgentProviders';

const demo = { id: 'demo', name: '示例工程', updatedAt: 1 };

function source(options: {
  projects?: ProjectMeta[];
  hasHistory?: boolean;
  canSeedDemo: boolean;
  onCreate?: () => void;
}): ProjectStartupSource {
  return {
    list: async () => options.projects ?? [],
    hasHistory: async () => options.hasHistory ?? false,
    canSeedDemo: () => options.canSeedDemo,
    createDemo: async () => {
      options.onCreate?.();
      return demo;
    },
  };
}

let readOnlyCreates = 0;
const readOnlyProjects = await loadInitialProjects(source({
  canSeedDemo: false,
  onCreate: () => { readOnlyCreates += 1; },
}));
assert.deepEqual(readOnlyProjects, [], 'sessionless empty remote listing resolves to an empty terminal state');
assert.equal(readOnlyCreates, 0, 'read-only startup never attempts the rejected demo write');

for (const mode of ['authorized remote', 'local/offline']) {
  let creates = 0;
  const projects = await loadInitialProjects(source({
    canSeedDemo: true,
    onCreate: () => { creates += 1; },
  }));
  assert.deepEqual(projects, [demo], `${mode} first-run still seeds the demo`);
  assert.equal(creates, 1, `${mode} first-run creates exactly one demo`);
}

let historyCreates = 0;
assert.deepEqual(
  await loadInitialProjects(source({
    hasHistory: true,
    canSeedDemo: true,
    onCreate: () => { historyCreates += 1; },
  })),
  [],
  'an intentionally emptied project history stays empty',
);
assert.equal(historyCreates, 0, 'project history still suppresses demo recreation');

const existing = [{ id: 'existing', name: 'Existing', updatedAt: 2 }];
assert.deepEqual(
  await loadInitialProjects(source({ projects: existing, canSeedDemo: false })),
  existing,
  'existing projects remain readable without write authority',
);

const appSource = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
assert.match(appSource, /useInferenceWarmup\(route\.name === 'editor' && window\.isSecureContext\)/, 'App wires unified inference warmup only while editing in a secure context');
assert.doesNotMatch(appSource, /useLocalAsrWarmup/, 'App no longer wires the ASR-only warmup path');

const descriptors = {
  window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
  localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
};
const applied: boolean[] = [];
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: () => '1', setItem: () => undefined },
});
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { openChatCutDesktop: { inference: { setEnabled: async (enabled: boolean) => { applied.push(enabled); } } } },
});
try {
  assert.equal(await syncDesktopNativeInferenceEnabled(), true, 'restart reads the persisted native inference preference');
  assert.deepEqual(applied, [true], 'restart sync applies the preference to the desktop bridge');
} finally {
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
}

const originalFetch = globalThis.fetch;
const pendingCopilot = Promise.withResolvers<Response>();
const requestedPaths: string[] = [];
let copilotSaved = '';
let startupTimeout: ReturnType<typeof setTimeout> | undefined;
try {
  globalThis.fetch = async (input) => {
    const path = String(input);
    requestedPaths.push(path);
    if (path === '/api/copilot/status') return pendingCopilot.promise;
    if (path.startsWith('/api/claude-code/')) return Response.json({ installed: false, version: null, account: null });
    return Response.json(path === '/api/codex/status' ? { installed: false } : {
      keys: { LLM_OPENAI_API_KEY: { configured: true } },
      models: { LLM_PROVIDER: 'openai', LLM_OPENAI_MODEL: 'gpt-5.5', COPILOT_MODEL: copilotSaved },
    });
  };
  await syncAgentBackends(() => true);
  assert.equal(requestedPaths.includes('/api/copilot/status'), false,
    'an unconfigured optional backend must not start on app launch');
  copilotSaved = 'auto';
  await Promise.race([
    syncAgentBackends(() => true),
    new Promise<never>((_, reject) => {
      startupTimeout = setTimeout(() => reject(new Error('API startup waited for Copilot')), 500);
    }),
  ]);
  assert.equal(requestedPaths.includes('/api/copilot/status'), true);
  assert.equal(getActiveAgentModelChoice()?.backend, 'api',
    'configured API models are usable while a Copilot status request remains unresolved');
} finally {
  clearTimeout(startupTimeout);
  pendingCopilot.resolve(Response.json({ installed: false }));
  globalThis.fetch = originalFetch;
}

// Claude Code is discovered on app launch, not on the first Settings mount.
// Regression guard: the Anthropic entries used to reach the model picker only
// after the user opened Settings and re-detected the CLI by hand, because
// useClaudeCodeSettings was the sole caller of applyClaudeCodeAgentStatus.
function awaitClaudeCodeChoice(timeoutMs = 1_000): Promise<boolean> {
  const claudeCodeReady = (): boolean =>
    getAgentModelSnapshot().choices.some((choice) => choice.backend === 'claude-code');
  if (claudeCodeReady()) return Promise.resolve(true);
  const { promise, resolve } = Promise.withResolvers<boolean>();
  const timer = setTimeout(() => { unsubscribe(); resolve(false); }, timeoutMs);
  const unsubscribe = subscribeAgentModels(() => {
    if (!claudeCodeReady()) return;
    clearTimeout(timer);
    unsubscribe();
    resolve(true);
  });
  return promise;
}

const startupFetch = globalThis.fetch;
const claudeCodePaths: string[] = [];
try {
  globalThis.fetch = async (input) => {
    const path = String(input);
    claudeCodePaths.push(path);
    if (path === '/api/claude-code/status') {
      return Response.json({
        installed: true,
        version: '2.1.260',
        account: { loggedIn: true, email: 'user@example.com', subscriptionType: 'max', authMethod: 'oauth' },
      });
    }
    if (path === '/api/claude-code/models') {
      return Response.json({ models: [{ id: 'claude-sonnet-5', label: 'Claude Sonnet 5', isDefault: true }] });
    }
    if (path === '/api/codex/status') return Response.json({ installed: false });
    return Response.json({ keys: {}, models: { LLM_PROVIDER: 'openai' } });
  };
  await syncAgentBackends(() => true);
  assert.equal(claudeCodePaths.includes('/api/claude-code/status'), true,
    'app launch probes the Claude Code CLI without waiting for Settings to mount');
  assert.equal(await awaitClaudeCodeChoice(), true,
    'a signed-in Claude Code CLI reaches the model picker on launch');
  const claudeCode = getAgentModelSnapshot().choices.find((choice) => choice.backend === 'claude-code');
  assert.equal(claudeCode?.provider, 'anthropic', 'the launch-discovered entry is the Anthropic provider');
  assert.equal(claudeCode?.model, 'claude-sonnet-5', 'discovered model ids reach the picker verbatim');
  assert.equal(claudeCodePaths.includes('/api/claude-code/models'), true,
    'a signed-in account has its models listed without a manual "read models" click');
} finally {
  globalThis.fetch = startupFetch;
}

// ── DeepSeek Harness: launch discovery, refresh, saved model while down ─────
const dshPrefs = new Map<string, string>();
const dshLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => dshPrefs.get(key) ?? null,
    setItem: (key: string, value: string) => { dshPrefs.set(key, value); },
    removeItem: (key: string) => { dshPrefs.delete(key); },
  },
});
const dshFetch = globalThis.fetch;
let dshProbe: { ok: boolean; models?: string[] } = {
  ok: true, models: ['combo:recommended-free', 'deepseek-v3', 'qwen3-free'],
};
const probeBodies: string[] = [];
const dshIds = (): string[] => getAgentModelSnapshot().choices
  .filter((choice) => choice.provider === 'dsh')
  .map((choice) => choice.id);
const waitFor = async (predicate: () => boolean): Promise<boolean> => {
  const deadline = Date.now() + 1_000;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return predicate();
};
try {
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    if (path === '/api/keys') {
      return Response.json({ keys: { LLM_DSH_API_KEY: { configured: true } }, models: {} });
    }
    if (path === '/api/keys/test') {
      probeBodies.push(typeof init?.body === 'string' ? init.body : '');
      return Response.json(dshProbe);
    }
    if (path === '/api/codex/status') return Response.json({ installed: false });
    if (path === '/api/claude-code/status') return Response.json({ installed: false, version: null, account: null });
    return Response.json({ keys: {}, models: {} });
  };
  await syncAgentBackends(() => true);
  assert.equal(
    await waitFor(() => dshIds().length === 3),
    true,
    'launch discovery lists one entry per forward-port model',
  );
  assert.deepEqual(dshIds(), [
    'dsh:combo:recommended-free', 'dsh:deepseek-v3', 'dsh:qwen3-free',
  ], 'model ids keep their colons in the whole choice id');
  assert.deepEqual(JSON.parse(probeBodies[0]!), { page: 'llm/dsh', overrides: {} },
    'discovery uses the provider probe without staged overrides');

  selectAgentModel('dsh:deepseek-v3');
  assert.equal(getActiveAgentModelChoice()?.model, 'deepseek-v3',
    'the selected entry carries the model a run will request');

  dshProbe = { ok: false };
  await refreshDshModels();
  assert.equal(getDshHarnessState().down, true, 'a failed probe surfaces the harness-down state');
  assert.ok(dshIds().includes('dsh:deepseek-v3'), 'the last model stays selectable while the harness is down');
  assert.equal(getActiveAgentModelChoice()?.id, 'dsh:deepseek-v3');

  dshProbe = { ok: true, models: ['alpha', 'beta'] };
  await refreshDshModels();
  assert.equal(getDshHarnessState().down, false);
  assert.deepEqual(dshIds(), ['dsh:alpha', 'dsh:beta'],
    'the refresh path rebuilds the menu from the new list');
} finally {
  globalThis.fetch = dshFetch;
  if (dshLocalStorage) Object.defineProperty(globalThis, 'localStorage', dshLocalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
}

// ── HQ-7: the providers switch arrives with /api/keys, not the bundle ─────
{
  assert.equal(providersOff(), false, 'nothing is switched off before the settings payload arrives');
  const visibleKeys = (): string[] => agentVendorPagesWithVision()
    .map((page) => page.key.split('/')[1] ?? '')
    .filter((provider) => provider !== '');
  assert.ok(visibleKeys().includes('openai'), 'every provider is offered by default');
  globalThis.fetch = async (input) => {
    const path = String(input);
    if (path === '/api/keys') return Response.json({ keys: {}, models: {}, providersOff: true });
    if (path === '/api/codex/status') return Response.json({ installed: false });
    if (path === '/api/claude-code/status') return Response.json({ installed: false, version: null, account: null });
    return Response.json({ keys: {}, models: {} });
  };
  await syncAgentBackends(() => true);
  assert.equal(providersOff(), true, 'the runtime switch wins over the build-time default');
  assert.deepEqual(visibleKeys().sort(), ['dsh', 'lmstudio', 'ollama'],
    'only the harness and the two keyless local runtimes stay visible');
}

console.log('appShell.verify: project startup and optional-backend isolation passed');
