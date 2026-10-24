// Shared probe plumbing (SSRF-guarded proxy fetch, small header/url helpers) and the
// media-vendor probe definitions that several capability pages alias (MiniMax
// image/voice/video, Gemini image/voice, xAI image/video, ElevenLabs voice/transcription,
// ...). key-probes.ts composes the page table from these; runProbe lives there.
import { proxyDispatcher } from './outbound-proxy.ts';
import type { KeyName } from './keystore.ts';
import { PROBE_TIMEOUT_MS } from './key-probe-local.ts';
import { minimaxPostCheck, parseModelCatalog } from './key-probe-result.ts';
import { versionedApiBaseUrl } from './plugins/media-provider-config.ts';
import { xaiOauthAccessToken } from './xai-oauth-session.ts';

// Proxy-aware fetch: attaches the configured outbound proxy (keystore
// PROXY_URL or HTTPS_PROXY/HTTP_PROXY env) via undici dispatcher.
type FetchInit = Parameters<typeof fetch>[1] & { dispatcher?: unknown };

// Probes send REAL stored credentials to a user/agent-settable base URL.
// Loopback and private hosts stay allowed (local models and LAN gateways are
// legitimate), but cloud metadata / link-local targets and credential-bearing
// or non-http(s) URLs never are — those only appear in SSRF exfil attempts.
export function probeUrlError(url: RequestInfo | URL): string | null {
  let parsed: URL;
  try {
    parsed = new URL(String(url));
  } catch {
    return '探测地址不是合法 URL';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return `探测地址协议不支持:${parsed.protocol}`;
  }
  if (parsed.username || parsed.password) return '探测地址不允许携带内嵌凭据';
  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(host) || host.startsWith('fe80:')
    || host === 'metadata.google.internal') {
    return '探测地址指向云元数据/链路本地网段,已拒绝';
  }
  return null;
}

export const fetchWithProxy = (url: RequestInfo | URL, init?: FetchInit): Promise<Response> => {
  const unsafe = probeUrlError(url);
  if (unsafe) return Promise.reject(new Error(unsafe));
  return fetch(url, { ...init, dispatcher: proxyDispatcher() } as RequestInit);
};

export type Get = (name: KeyName) => string;

export interface ProbeDef {
  /** Starting test threshold: OR of AND-groups (every name in one inner list must be present) */
  readonly needs: readonly (readonly KeyName[])[];
  readonly run: (get: Get) => Promise<Response>;
  /** 2xx may also be a provider-level failure (MiniMax base_resp); return error text, null = true success */
  readonly postCheck?: (bodyText: string) => string | null;
  /** Custom conclusion when successful (non-network check such as local disk probe); null/default = general "connection successful" */
  readonly okText?: (bodyText: string) => string | null;
  /** Parse a successful model-catalog response. Only LLM provider pages use this. */
  readonly models?: (bodyText: string) => string[];
}

export const t = (): AbortSignal => AbortSignal.timeout(PROBE_TIMEOUT_MS);
export const base = (get: Get, name: KeyName, def: string): string => (get(name) || def).replace(/\/+$/, '');
export const bearer = (key: string): Record<string, string> => ({ Authorization: `Bearer ${key}` });

// The four capability pages of MiniMax share one detection: POST /v1/get_voice (free read-only;
// The voice_cloning list is usually empty, minimal response).
export const minimaxProbe: ProbeDef = {
  needs: [['MINIMAX_API_KEY']],
  run: (get) => fetch(`${base(get, 'MINIMAX_BASE_URL', 'https://api.minimaxi.com')}/v1/get_voice`, {
    method: 'POST', signal: t(),
    headers: { 'Content-Type': 'application/json', ...bearer(get('MINIMAX_API_KEY')) },
    body: JSON.stringify({ voice_type: 'voice_cloning' }),
  }),
  postCheck: minimaxPostCheck,
};

export const atlasMusicProbe: ProbeDef = {
  needs: [['ATLASCLOUD_API_KEY']],
  run: async (get) => {
    const root = base(get, 'ATLASCLOUD_API_BASE', 'https://api.atlascloud.ai/api/v1');
    const response = await fetchWithProxy(`${root}/model/prediction/openchatcut-credential-probe`, {
      signal: t(), headers: bearer(get('ATLASCLOUD_API_KEY')),
    });
    if (response.status !== 404) return response;
    const body = await response.text().catch(() => '');
    try {
      const payload = JSON.parse(body) as { code?: number; message?: string };
      if (payload.code === 404 && payload.message === 'not found') {
        return new Response('{"authenticated":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    } catch {
      // Preserve an unrecognized 404 so the common classifier reports a bad Base URL.
    }
    return new Response(body, { status: 404, headers: response.headers });
  },
};

// BytePlus ModelArk: one account/key serves image (Seedream) and video (Seedance) alike —
// both capability pages share this /models detection, same as minimaxProbe above.
export const byteplusProbe: ProbeDef = {
  needs: [['BYTEPLUS_API_KEY']],
  run: (get) => fetch(`${base(get, 'BYTEPLUS_BASE_URL', 'https://ark.ap-southeast.bytepluses.com/api/v3')}/models`, {
    signal: t(), headers: bearer(get('BYTEPLUS_API_KEY')),
  }),
  models: parseModelCatalog,
};

export const openAiMediaProbe: ProbeDef = {
  needs: [['OPENAI_API_KEY']],
  run: (get) => fetch(`${versionedApiBaseUrl(base(get, 'IMAGE_BASE_URL', 'https://api.openai.com'), 'v1')}/models`, {
    signal: t(), headers: bearer(get('OPENAI_API_KEY')),
  }),
};

export const geminiMediaProbe: ProbeDef = {
  needs: [['GEMINI_API_KEY']],
  run: (get) => fetch(`${versionedApiBaseUrl(base(get, 'GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com'), 'v1beta')}/models?pageSize=1`, {
    signal: t(), headers: { 'x-goog-api-key': get('GEMINI_API_KEY') },
  }),
};

export const mistralMediaProbe: ProbeDef = {
  needs: [['LLM_MISTRAL_API_KEY']],
  run: (get) => fetch(`${versionedApiBaseUrl(base(get, 'LLM_MISTRAL_BASE_URL', 'https://api.mistral.ai/v1'), 'v1')}/models`, {
    signal: t(), headers: bearer(get('LLM_MISTRAL_API_KEY')),
  }),
};

export const deepgramProbe: ProbeDef = {
  needs: [['DEEPGRAM_API_KEY']],
  run: (get) => fetch('https://api.deepgram.com/v1/projects', {
    signal: t(), headers: { Authorization: `Token ${get('DEEPGRAM_API_KEY')}` },
  }),
};

export const groqProbe: ProbeDef = {
  needs: [['GROQ_API_KEY']],
  run: (get) => fetch(`${base(get, 'GROQ_BASE_URL', 'https://api.groq.com/openai/v1')}/models`, {
    signal: t(), headers: bearer(get('GROQ_API_KEY')),
  }),
};

/** xAI media pages: one probe for image and video; the subscription session
 * token takes priority over the configured LLM API key. */
export const xaiMediaProbe: ProbeDef = {
  needs: [['LLM_XAI_OAUTH_API_KEY'], ['LLM_XAI_API_KEY']],
  run: (get) => {
    const token = xaiOauthAccessToken() || get('LLM_XAI_API_KEY');
    return fetchWithProxy(`${base(get, 'LLM_XAI_BASE_URL', 'https://api.x.ai/v1')}/models`, {
      signal: t(), headers: token ? bearer(token) : {},
    });
  },
  models: parseModelCatalog,
};

export const elevenLabsProbe: ProbeDef = {
  needs: [['ELEVENLABS_API_KEY']],
  run: (get) => fetch(`${base(get, 'ELEVENLABS_BASE_URL', 'https://api.elevenlabs.io')}/v1/models`, {
    signal: t(), headers: { 'xi-api-key': get('ELEVENLABS_API_KEY') },
  }),
};

export const cartesiaProbe: ProbeDef = {
  needs: [['CARTESIA_API_KEY']],
  run: (get) => fetch('https://api.cartesia.ai/voices?limit=1', {
    signal: t(),
    headers: {
      Authorization: `Bearer ${get('CARTESIA_API_KEY')}`,
      'Cartesia-Version': '2026-03-01',
    },
  }),
};
