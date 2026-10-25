import { startUiLocaleSync } from '../i18n/localeSync';
import { t } from '../i18n/locale';
import { useCallback, useEffect, useState } from 'react';
import { applyLiveCaps, applyLiveKeyStatus, applyLiveModels } from '../agent/capabilities';
import { fetchCodexModels, fetchCodexStatus } from '../agent/codex/client';
import { fetchCopilotModels, fetchCopilotStatus } from '../agent/copilot/client';
import { fetchClaudeCodeModels, fetchClaudeCodeStatus } from '../agent/claude-code/client';
import { applyAgentModelStatus, applyClaudeCodeAgentStatus, applyCodexAgentStatus, applyCopilotAgentStatus, applyDshModels, selectAgentModel, getActiveAgentModelChoice, getAgentModelSnapshot } from '../agent/model-selection';
import { applyProvidersOff, PROVIDERS_OFF, providersOff } from '../agent/providers-off';
import { loadAgentModelPref } from '../persist/sessionPrefs';
import type { ProjectDoc, TimelineState } from '../editor/types';
import {
  createProject,
  docFromTimeline,
  hasProjectHistory,
  listProjects,
} from '../persist/projectStore';
import type { ProjectMeta } from '../persist/projectStoreCoordinators';
import { kvRemoteMode } from '../persist/sharedKv';
import { projectStoreWriteCredential } from '../persist/projectStoreTransport';

export type AppRoute = { name: 'dashboard' } | { name: 'editor'; id: string };

interface LiveAgentStatus {
  readonly caps?: Record<string, boolean>;
  readonly keys?: Record<string, { readonly configured: boolean }>;
  readonly models?: Record<string, string>;
  readonly providersOff?: boolean;
}

const emptyState = (): TimelineState => ({
  fps: 30,
  width: 1920,
  height: 1080,
  items: [],
  selectedId: null,
  trackOrder: ['track_v1'],
  tracks: { track_v1: { kind: 'video' } },
});

export const emptyProjectDoc = (): ProjectDoc => docFromTimeline(emptyState());
// Keep the sample timeline out of established users' startup bundle; it is needed only on first run.
const seedDoc = async (): Promise<ProjectDoc> => docFromTimeline((await import('../editor/initial')).INITIAL);

function parseHash(): AppRoute {
  const match = window.location.hash.match(/^#\/editor\/(.+)$/);
  return match ? { name: 'editor', id: match[1] } : { name: 'dashboard' };
}

export function navigateTo(hash: string): void {
  window.location.hash = hash;
}

/**
 * The DeepSeek Harness answers `/v1/models` on its forward port, and the
 * existing provider probe already lists them. Detached from startup and from
 * the model picker's refresh button; it never rejects so a stopped harness
 * cannot break either caller.
 */
export async function refreshDshModels(): Promise<void> {
  try {
    const response = await fetch('/api/keys/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 'llm/dsh', overrides: {} }),
    });
    const body = await response.json().catch(() => null) as
      { readonly ok?: boolean; readonly models?: unknown } | null;
    const models = Array.isArray(body?.models)
      ? body.models.filter((model): model is string => typeof model === 'string')
      : [];
    applyDshModels(models, body?.ok !== true);
  } catch {
    applyDshModels([], true);
  }
}

async function syncCopilotBackend(
  isActive: () => boolean,
  savedModel?: string,
  savedReasoningEffort?: string,
): Promise<void> {
  try {
    const status = await fetchCopilotStatus();
    if (!isActive()) return;
    const models = status.installed && status.supported && status.authenticated
      ? await fetchCopilotModels().catch(() => null)
      : null;
    if (isActive()) applyCopilotAgentStatus(
      status, savedModel, savedReasoningEffort, models && !models.error ? models.models : [],
    );
  } catch {
    // An optional backend must not prevent configured API/Codex models from loading.
  }
}

/**
 * Claude Code is a first-class CLI backend like Codex, so its status has to be
 * discovered on app launch rather than the first time Settings mounts: the
 * model picker builds its Anthropic entries from this status, and before this
 * ran at startup the backend stayed invisible until the user opened Settings
 * and re-detected the CLI by hand.
 */
async function syncClaudeCodeBackend(isActive: () => boolean, savedModel?: string): Promise<void> {
  try {
    const status = await fetchClaudeCodeStatus();
    if (!isActive()) return;
    const models = status.installed && status.account?.loggedIn === true
      ? await fetchClaudeCodeModels().catch(() => null)
      : null;
    if (isActive()) {
      applyClaudeCodeAgentStatus(status, savedModel, models && !models.error ? models.models : []);
    }
  } catch {
    // An optional backend must not prevent configured API/Codex models from loading.
  }
}

export async function syncAgentBackends(isActive: () => boolean): Promise<void> {
  // A local-only deployment blocks the CLI routes, so probing them on every
  // launch would only log 403s (and could make Codex the active backend).
  const [keyResult, codexResult] = await Promise.allSettled([
    fetch('/api/keys').then(async (response): Promise<LiveAgentStatus> => {
      if (!response.ok) throw new Error('Agent key status is unavailable.');
      return response.json() as Promise<LiveAgentStatus>;
    }),
    PROVIDERS_OFF ? Promise.resolve(null) : fetchCodexStatus(),
  ]);
  if (!isActive()) return;
  let savedCodexModel: string | undefined;
  let savedCodexReasoningEffort: string | undefined;
  let savedClaudeCodeModel: string | undefined;
  if (keyResult.status === 'fulfilled') {
    const { caps, keys, models, providersOff: providersOffLive } = keyResult.value;
    if (caps) applyLiveCaps(caps);
    // Before any model list is built below: the vendor pages and the choices
    // read providersOff(), and a stale build-time flag would show the wrong
    // providers (HQ-7).
    if (typeof providersOffLive === 'boolean') applyProvidersOff(providersOffLive);
    if (keys) applyLiveKeyStatus(keys);
    if (models) {
      applyLiveModels(models);
      applyAgentModelStatus(keys ?? {}, models);
      savedCodexModel = models.CODEX_MODEL;
      savedCodexReasoningEffort = models.CODEX_REASONING_EFFORT;
      savedClaudeCodeModel = models.CLAUDE_CODE_MODEL;
      if (!providersOff()
        && (models.COPILOT_MODEL || loadAgentModelPref()?.startsWith('copilot:'))) {
        void syncCopilotBackend(isActive, models.COPILOT_MODEL, models.COPILOT_REASONING_EFFORT);
      }
    }
    startUiLocaleSync(models?.UI_LOCALE);
    // Only a harness with a saved key is probed at launch: an unconfigured
    // provider would just answer 401 on every boot.
    if (keys?.LLM_DSH_API_KEY?.configured || models?.LLM_DSH_MODEL) void refreshDshModels();
  }
  // Detached like the Copilot probe: `claude --version` plus `claude auth
  // status` can take seconds, and configured API/Codex models must stay usable
  // while it runs. Unlike Copilot it is never gated on a saved model, because
  // an unconfigured install is exactly the case this has to surface.
  if (!providersOff()) void syncClaudeCodeBackend(isActive, savedClaudeCodeModel);
  if (codexResult.status !== 'fulfilled' || !codexResult.value) return;
  const modelResult = codexResult.value.installed && codexResult.value.account?.type !== 'apiKey'
    ? await fetchCodexModels().catch(() => null)
    : null;
  if (!isActive()) return;
  applyCodexAgentStatus(
    codexResult.value,
    savedCodexModel,
    savedCodexReasoningEffort,
    modelResult && !modelResult.error ? modelResult.models : [],
  );
  // When Codex (the MCP route) is available and the user has never pinned a
  // model, make Codex the active model so the composer starts on the MCP
  // backend instead of the configured default LLM.
  const active = getActiveAgentModelChoice();
  if (active && active.backend !== 'codex' && !loadAgentModelPref()) {
    const codex = getAgentModelSnapshot().choices.find((choice) => choice.backend === 'codex');
    if (codex) selectAgentModel(codex.id);
  }
}

export function useAppRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(parseHash());
  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

export function useAgentBackendSync(): void {
  useEffect(() => {
    let alive = true;
    void syncAgentBackends(() => alive);
    return () => { alive = false; };
  }, []);
}

export interface ProjectStartupSource {
  list(): Promise<ProjectMeta[]>;
  hasHistory(): Promise<boolean>;
  canSeedDemo(): boolean;
  createDemo(): Promise<ProjectMeta>;
}

const projectStartupSource: ProjectStartupSource = {
  list: listProjects,
  hasHistory: hasProjectHistory,
  canSeedDemo: () => kvRemoteMode() === 'local' || projectStoreWriteCredential(),
  createDemo: async () => createProject(t('示例工程'), await seedDoc()),
};

export async function loadInitialProjects(
  source: ProjectStartupSource = projectStartupSource,
): Promise<ProjectMeta[]> {
  const list = await source.list();
  if (list.length > 0 || await source.hasHistory()) return list;
  if (!source.canSeedDemo()) return [];
  return [await source.createDemo()];
}

export function useProjects(): {
  projects: ProjectMeta[] | null;
  refresh: () => Promise<void>;
} {
  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);
  const refresh = useCallback(async () => { setProjects(await listProjects()); }, []);
  useEffect(() => {
    void loadInitialProjects().then(setProjects);
  }, []);
  return { projects, refresh };
}
