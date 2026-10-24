// Set the server detection table of the "Test Connection" panel: the lightest real authentication request for each provider page
// (read-only endpoint or near-zero cost call), verify that the Key + Base URL is available. The key comes from keystore,
// Or the request body overrides (the temporary value that has not been saved in the panel will only take effect for this detection and will not be saved).
// Security invariant: The result only contains ok / message / status / latencyMs, and never echoes any key value;
// The provider's error copy is flattened and truncated before entering the message. Align the endpoints and authentication headers of each provider call one by one
// (Doubao audio-generation X-Api-Key / MiniMax base_resp / Gemini x-goog-api-key...).
import { getKey, KEY_NAMES, type KeyName } from './keystore.ts';
import { r2Probe } from './r2.ts';
import { mediaDirProbe, mediaDirPostCheck, mediaDirOkText } from './media-dir.ts';
import {
  AI_SDK_BASE_URL_FORMAT,
  resolveLlmBaseUrl,
} from './llm-config.ts';
import {
  LLM_PROVIDER_PRESETS,
  isLocalLlmProvider,
  llmProviderConfigNames,
  protocolForProvider,
  type LlmProvider,
} from '../shared/llm-providers.ts';
import { resolveDoubaoSpeaker } from './plugins/voice-providers.ts';
import {
  classifyStatus,
  classifyStatusTemplate,
  doubaoPostCheck,
  networkMessage,
  networkMessageTemplate,
  parseModelCatalog,
  parseTextModelCatalog,
  sanitizeProbeText,
  type ProbeMessageTemplate,
  type ProbeResult,
} from './key-probe-result.ts';
import { runDataDirProbe, runProxyProbe } from './key-probe-local.ts';
import {
  atlasMusicProbe,
  base,
  bearer,
  byteplusProbe,
  cartesiaProbe,
  deepgramProbe,
  elevenLabsProbe,
  fetchWithProxy,
  geminiMediaProbe,
  groqProbe,
  minimaxProbe,
  mistralMediaProbe,
  openAiMediaProbe,
  t,
  xaiMediaProbe,
  type Get,
  type ProbeDef,
} from './key-probe-media.ts';
export { classifyStatus, networkMessage, parseModelCatalog, type ProbeResult } from './key-probe-result.ts';
export { doubaoPostCheck, minimaxPostCheck } from './key-probe-result.ts';
export { probeUrlError } from './key-probe-media.ts';
export { runDataDirProbe, runProxyProbe } from './key-probe-local.ts';

function llmProbe(provider: LlmProvider): ProbeDef {
  const names = llmProviderConfigNames(provider);
  const protocol = protocolForProvider(provider);
  const apiKeyName = names.apiKey as KeyName;
  const baseUrlName = names.baseUrl as KeyName;
  const isLocal = isLocalLlmProvider(provider);
  return {
    needs: isLocal ? [[]] : [[apiKeyName]],
    run: (get) => {
      const key = get(apiKeyName);
      const headers = protocol === 'anthropic'
        ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
        : protocol === 'google'
          ? { 'x-goog-api-key': key }
          : key ? bearer(key) : {};
      const root = resolveLlmBaseUrl(provider, get(baseUrlName), AI_SDK_BASE_URL_FORMAT);
      return fetchWithProxy(`${root}/models`, { signal: t(), headers });
    },
    models: parseModelCatalog,
  };
}

/** The provider's error copy is flattened before entering the results: line breaks and truncation are removed. Never splice any key values.*/
export function sanitize(text: string): string {
  return sanitizeProbeText(text);
}

const requestyLlmProbe = llmProbe('requesty');
const requestyProbe: ProbeDef = {
  ...requestyLlmProbe,
  run: async (get) => {
    const checked = await requestyLlmProbe.run(get);
    if (!checked.ok) return checked;
    const root = resolveLlmBaseUrl('requesty', get('LLM_REQUESTY_BASE_URL'), AI_SDK_BASE_URL_FORMAT);
    const managed = await fetchWithProxy(`${root}/models/managed`, { signal: t() }).catch(() => null);
    return managed?.ok ? managed : checked;
  },
};

const cheaperInferenceProbe: ProbeDef = {
  ...llmProbe('cheaperinference'),
  models: parseTextModelCatalog,
};


/** page key (same name as the vendor page key of settingsSchema) → detection definition.*/
export const PROBES: Record<string, ProbeDef> = {
  ...Object.fromEntries(LLM_PROVIDER_PRESETS.map((preset) => [
    `llm/${preset.id}`,
    llmProbe(preset.id),
  ])),
  'llm/requesty': requestyProbe,
  'llm/cheaperinference': cheaperInferenceProbe,
  'image/openai': {
    needs: [['IMAGE_API_KEY'], ['OPENAI_API_KEY']],
    run: (get) => fetch(`${base(get, 'IMAGE_BASE_URL', 'https://api.openai.com')}/v1/models`, {
      signal: t(), headers: bearer(get('IMAGE_API_KEY') || get('OPENAI_API_KEY')),
    }),
  },
  'image/gemini': geminiMediaProbe,
  'image/minimax': minimaxProbe,
  'image/byteplus': byteplusProbe,
  'image/xai': xaiMediaProbe,
  'image/wavespeed': {
    needs: [['WAVESPEED_API_KEY']],
    run: (get) => fetch(`${base(get, 'WAVESPEED_BASE_URL', 'https://api.wavespeed.ai')}/api/v3/balance`, {
      signal: t(), headers: bearer(get('WAVESPEED_API_KEY')),
    }),
  },
  'voice/elevenlabs': elevenLabsProbe,
  'voice/openai': openAiMediaProbe,
  'voice/gemini': geminiMediaProbe,
  'voice/mistral': mistralMediaProbe,
  'voice/cartesia': cartesiaProbe,
  // Doubao 音频生成新版接口：X-Api-Key 单头鉴权；无免费探活端点，合成 1 个字做最小真实校验（成本可忽略）。
  'voice/doubao': {
    needs: [['DOUBAO_TTS_API_KEY']],
    run: (get) => {
      const root = base(get, 'DOUBAO_TTS_BASE_URL', 'https://openspeech.bytedance.com');
      return fetch(root.endsWith('/api/v3/tts/create') ? root : `${root}/api/v3/tts/create`, {
        method: 'POST', signal: t(),
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': get('DOUBAO_TTS_API_KEY') },
        body: JSON.stringify({
          model: get('DOUBAO_TTS_MODEL') || 'seed-audio-1.0',
          text_prompt: '测',
          references: [{ speaker: resolveDoubaoSpeaker(get('DOUBAO_TTS_VOICE_ID')) || 'zh_female_vv_uranus_bigtts' }],
          audio_config: { format: 'mp3', sample_rate: 24_000 },
        }),
      });
    },
    postCheck: doubaoPostCheck,
  },
  'voice/minimax': minimaxProbe,
  'voice/inworld': {
    needs: [['INWORLD_TTS_API_KEY']],
    run: (get) => fetch(`${base(get, 'INWORLD_TTS_BASE_URL', 'https://api.inworld.ai')}/voices/v1/voices`, {
      signal: t(), headers: { Authorization: `Basic ${get('INWORLD_TTS_API_KEY')}` },
    }),
  },
  'voice/fishaudio': {
    needs: [['FISHAUDIO_TTS_API_KEY']],
    run: (get) => fetch(`${base(get, 'FISHAUDIO_TTS_BASE_URL', 'https://api.fish.audio')}/model`, {
      signal: t(), headers: bearer(get('FISHAUDIO_TTS_API_KEY')),
    }),
  },
  // No free read-only endpoint is documented; synthesizing 1 word is the minimum real verification (negligible cost).
  'voice/speechify': {
    needs: [['SPEECHIFY_TTS_API_KEY']],
    run: (get) => fetch(`${base(get, 'SPEECHIFY_TTS_BASE_URL', 'https://api.sws.speechify.com')}/v1/audio/speech`, {
      method: 'POST', signal: t(),
      headers: { 'Content-Type': 'application/json', ...bearer(get('SPEECHIFY_TTS_API_KEY')) },
      body: JSON.stringify({ input: '测', voice_id: 'george', audio_format: 'mp3', model: get('SPEECHIFY_TTS_MODEL') || 'simba-multilingual' }),
    }),
  },
  'video/seedance': {
    needs: [['SEEDANCE_API_KEY']],
    run: (get) => fetch(`${base(get, 'SEEDANCE_BASE_URL', 'https://ark.cn-beijing.volces.com/api/v3')}/contents/generations/tasks?page_num=1&page_size=1`, {
      signal: t(), headers: bearer(get('SEEDANCE_API_KEY')),
    }),
  },
  'video/kling': {
    needs: [['KLING_API_KEY']],
    run: (get) => fetch(`${base(get, 'KLING_BASE_URL', 'https://api-singapore.klingai.com')}/v1/videos/text2video?pageNum=1&pageSize=1`, {
      signal: t(), headers: bearer(get('KLING_API_KEY')),
    }),
  },
  'video/hailuo': minimaxProbe,
  'video/byteplus': byteplusProbe,
  'video/xai': xaiMediaProbe,
  'video/ofox': {
    needs: [['LLM_OFOX_API_KEY']],
    run: (get) => fetch(`${base(get, 'LLM_OFOX_BASE_URL', 'https://api.ofox.ai/v1')}/models`, {
      signal: t(), headers: bearer(get('LLM_OFOX_API_KEY')),
    }),
    models: parseModelCatalog,
  },
  'music/mureka': {
    needs: [['MUREKA_API_KEY']],
    run: (get) => fetch(`${base(get, 'MUREKA_BASE_URL', 'https://api.mureka.ai')}/v1/account/billing`, {
      signal: t(), headers: bearer(get('MUREKA_API_KEY')),
    }),
  },
  'music/minimax': minimaxProbe,
  'music/atlas': atlasMusicProbe,
  // Read-only account endpoint; fake key → 401. The same key also serves
  // /generate/sound (video-to-SFX), so one probe covers both capabilities.
  'music/sonilo': {
    needs: [['SONILO_API_KEY']],
    run: (get) => fetch(`${base(get, 'SONILO_BASE_URL', 'https://api.sonilo.com')}/v1/account/services`, {
      signal: t(), headers: bearer(get('SONILO_API_KEY')),
    }),
  },
  // /v1/search has been opened to anonymous users (the measured number is 200 without key), and the key; collections cannot be detected
  // It is the account binding endpoint, and the fake key is stable 401.
  'stock/pexels': {
    needs: [['PEXELS_API_KEY']],
    run: (get) => fetch('https://api.pexels.com/v1/collections?per_page=1', {
      signal: t(), headers: { Authorization: get('PEXELS_API_KEY') },
    }),
  },
  // Pixabay official design: key takes the query parameter (the server is directly connected to HTTPS, the same shape as the stock plugin).
  'stock/pixabay': {
    needs: [['PIXABAY_API_KEY']],
    run: (get) => {
      const params = new URLSearchParams({ key: get('PIXABAY_API_KEY'), q: 'sky', per_page: '3' });
      return fetchWithProxy(`https://pixabay.com/api/?${params.toString()}`, { signal: t() });
    },
  },
  // Unsplash: The search endpoint requires Client-ID, fake key 401.
  'stock/unsplash': {
    needs: [['UNSPLASH_ACCESS_KEY']],
    run: (get) => fetch('https://api.unsplash.com/search/photos?query=sky&per_page=1', {
      signal: t(), headers: { Authorization: 'Client-ID ' + get('UNSPLASH_ACCESS_KEY') },
    }),
  },
  // Freesound: token uses query (same shape as stock plugin), false token 401.
  'stock/freesound': {
    needs: [['FREESOUND_API_KEY']],
    run: (get) => {
      const params = new URLSearchParams({ query: 'wind', page_size: '1', fields: 'id', token: get('FREESOUND_API_KEY') });
      return fetchWithProxy('https://freesound.org/apiv2/search/text/?' + params.toString(), { signal: t() });
    },
  },
  'transcription/assemblyai': {
    needs: [['ASSEMBLYAI_API_KEY']],
    run: (get) => fetch('https://api.assemblyai.com/v2/transcript?limit=1', {
      signal: t(), headers: { authorization: get('ASSEMBLYAI_API_KEY') },
    }),
  },
  'transcription/openai': openAiMediaProbe,
  'transcription/mistral': mistralMediaProbe,
  'transcription/deepgram': deepgramProbe,
  'transcription/groq': groqProbe,
  'transcription/elevenlabs': elevenLabsProbe,
  'transcription/cartesia': cartesiaProbe,
  'sandbox/e2b': {
    needs: [['E2B_API_KEY']],
    run: (get) => fetch('https://api.e2b.dev/sandboxes', {
      signal: t(), headers: { 'X-API-KEY': get('E2B_API_KEY') },
    }),
  },
  'web/firecrawl': {
    needs: [['FIRECRAWL_API_KEY']],
    run: (get) => fetch('https://api.firecrawl.dev/v2/team/credit-usage', {
      signal: t(), headers: bearer(get('FIRECRAWL_API_KEY')),
    }),
  },
  // Read-only account endpoint; a fake key is a stable 401. Upload-Post keys
  // use the `Apikey` scheme, not `Bearer`.
  'publish/upload-post': {
    needs: [['UPLOAD_POST_API_KEY']],
    run: (get) => fetch(`${base(get, 'UPLOAD_POST_BASE_URL', 'https://api.upload-post.com')}/api/uploadposts/me`, {
      signal: t(), headers: { Authorization: `Apikey ${get('UPLOAD_POST_API_KEY')}` },
    }),
  },
  // S3 HeadBucket is sent via SDK (SigV4 signature cannot be fetched manually), r2.ts synthesizes Response:
  // 200=The bucket exists and has been authenticated; 403/404 goes to classifyStatus; the network layer throws it to networkMessage as it is.
  'storage/r2': {
    needs: [['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']],
    run: (get) => r2Probe(get),
  },
  // Local saving directory: disk check (create directory + write and delete detection files), non-network request. Empty group needs = not filled in
  // It can also be tested (if not set = use the default directory, it is legal).
  'storage/local': {
    needs: [[]],
    run: (get) => mediaDirProbe(get),
    postCheck: mediaDirPostCheck,
    okText: mediaDirOkText,
  },
};

/** Temporarily stored overrides (in the whitelist, the empty string represents clearing for this test) overwrite the stored value.*/
export function makeGetter(overrides: Record<string, unknown>): Get {
  const clean = new Map<string, string>();
  for (const [name, raw] of Object.entries(overrides)) {
    if (!(KEY_NAMES as readonly string[]).includes(name)) continue; // Discarded outside the whitelist
    clean.set(name, String(raw ?? '').trim());
  }
  if (clean.has('LLM_BASE_URL') && !clean.has('LLM_BASE_URL_FORMAT')) {
    clean.set('LLM_BASE_URL_FORMAT', clean.get('LLM_BASE_URL') ? AI_SDK_BASE_URL_FORMAT : '');
  }
  return (name) => clean.has(name) ? clean.get(name)! : getKey(name);
}

/** Run a connectivity probe of the provider's page. Unconfigured/unknown pages are returned before sending a request and do not hit the network.*/
export async function runProbe(page: string, overrides: Record<string, unknown>): Promise<ProbeResult> {
  if (page === 'agent/proxy') return runProxyProbe(overrides);
  // The storage root is not a keystore key (makeGetter would drop it), so its
  // writability check reads the panel's raw value directly.
  if (page === 'storage/projects') return runDataDirProbe(overrides);
  const probe = PROBES[page];
  if (!probe) return { ok: false, message: '该厂商暂不支持连接测试' };
  const get = makeGetter(overrides);
  // DeepSeek Harness is the first page whose Spanish copy matters from day one
  // (free-lane users are not expected to read Chinese). Its results carry the
  // Chinese template that settingsVendorPane.tsx translates with t().
  const translated = page === 'llm/dsh';
  const ready = probe.needs.some((group) => group.every((n) => get(n).length > 0));
  if (!ready) {
    return {
      ok: false,
      message: '尚未填写 API Key · 填好后再点测试',
      ...(translated ? { messageKey: '尚未填写 API Key · 填好后再点测试' } : {}),
    };
  }
  const started = Date.now();
  try {
    const response = await probe.run(get);
    const latencyMs = Date.now() - started;
    const bodyText = await response.text().catch(() => '');
    if (response.ok) {
      const vendorError = probe.postCheck?.(bodyText) ?? null;
      if (vendorError) return { ok: false, status: response.status, latencyMs, message: vendorError };
      const models = probe.models?.(bodyText);
      const modelText = models
        ? models.length > 0 ? ` · 已读取 ${models.length} 个模型` : ' · 接口未返回模型列表'
        : '';
      const okText = probe.okText?.(bodyText) ?? '连接成功 · 鉴权通过';
      const template: Partial<ProbeMessageTemplate> = translated && probe.okText === undefined
        ? models
          ? models.length > 0
            ? {
                messageKey: '连接成功 · 鉴权通过 · 已读取 {n} 个模型 · {ms}ms',
                messageParams: { n: models.length, ms: latencyMs },
              }
            : { messageKey: '连接成功 · 鉴权通过 · 接口未返回模型列表 · {ms}ms', messageParams: { ms: latencyMs } }
          : { messageKey: '连接成功 · 鉴权通过 · {ms}ms', messageParams: { ms: latencyMs } }
        : {};
      return {
        ok: true,
        status: response.status,
        latencyMs,
        message: `${okText}${modelText} · ${latencyMs}ms`,
        ...template,
        ...(models ? { models } : {}),
      };
    }
    return {
      ...classifyStatus(response.status, bodyText),
      latencyMs,
      ...(translated ? classifyStatusTemplate(response.status, bodyText) : {}),
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: networkMessage(error),
      ...(translated ? networkMessageTemplate(error) : {}),
    };
  }
}
