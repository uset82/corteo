// The optional real ear: one OpenRouter call with the song as a 64 kbps mono
// mp3. It is off unless OPENCHATCUT_LISTEN_RELAY=openrouter and
// OPENROUTER_API_KEY are set, and it only runs when listen_to_song asks for it.
// OPENCHATCUT_PROVIDERS=off does not gate this call: the relay is the editor's
// one opt-in paid AI exception. Notes are cached per song version and model so
// a paid answer is fetched once.
import { spawnMediaProcess } from '../media-process.ts';
import { ffmpegBin } from '../media-binaries.ts';
import { getStoredEntry, setStoredEntry } from '../plugins/project-store.ts';
import type {
  ListenRelayCheck,
  ListenRelaySnapshot,
} from '../../shared/music-inference/listen-snapshot.ts';

export const LISTEN_RELAY_DEFAULT_MODEL = 'google/gemini-3.8-flash';
export const LISTEN_RELAY_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
export const RELAY_NOTE_MAX_CHARS = 1_200;
export const RELAY_TIMESTAMP_WINDOW_MS = 3_000;
export const RELAY_TIMEOUT_MS = 120_000;
const RELAY_ENCODE_TIMEOUT_MS = 60_000;
/** 15 minutes of 64 kbps mono mp3 is ~7.2 MB; the cap guards a bad muxer. */
const RELAY_MAX_MP3_BYTES = 16 * 1024 * 1024;
const RELAY_MAX_TOKENS = 700;

const SYSTEM_PROMPT = [
  'Eres un oyente musical experto. Describes solo lo que oyes en el audio:',
  'no inventes letras, instrumentos ni datos que no estén en la canción.',
  'Respondes en español neutro y en texto plano.',
].join(' ');

const LISTEN_PROMPT = [
  'Escucha esta canción completa y descríbela en español, en este orden:',
  '1. Timbre y producción: instrumentos, textura, mezcla, graves y agudos.',
  '2. Emoción vocal: cómo suena la voz; escribe "instrumental" si no hay voz.',
  '3. Arreglo: cómo entran y salen las partes y qué cambia entre secciones.',
  '4. Arco emocional con marcas de tiempo m:ss al inicio de cada momento.',
  'Cita la letra solo en fragmentos cortos entre comillas angulares («...»),',
  'máximo 12 palabras por cita; no transcribas la canción entera.',
  'Máximo 900 caracteres en total.',
].join(' ');

export interface ListenRelayConfig {
  readonly apiKey: string;
  readonly model: string;
  readonly crossCheckModel: string | null;
  readonly baseUrl: string;
}

export interface RelaySection {
  readonly fromMs: number;
  readonly toMs: number;
}

export interface RelayListenInput {
  readonly audioFile?: string;
  readonly assetId: string;
  readonly sourceRevision: string;
  readonly sections: readonly RelaySection[];
  readonly transcriptWords?: readonly string[];
  readonly config?: ListenRelayConfig;
  readonly fetchImpl?: typeof fetch;
  readonly encodeMp3?: (file: string) => Promise<Buffer>;
}

interface RelayReply {
  readonly text: string;
  readonly model: string;
  readonly provider: string;
  readonly usage: Record<string, unknown> | null;
}

interface StoredListenRelay {
  readonly key: string;
  readonly relay: ListenRelaySnapshot;
}

/** Reads the two switches per call so a verify can flip them without a restart. */
export function listenRelayConfig(env: NodeJS.ProcessEnv = process.env): ListenRelayConfig | null {
  if (env.OPENCHATCUT_LISTEN_RELAY !== 'openrouter') return null;
  const apiKey = (env.OPENROUTER_API_KEY ?? '').trim();
  if (!apiKey) return null;
  const model = (env.LISTEN_RELAY_MODEL ?? '').trim() || LISTEN_RELAY_DEFAULT_MODEL;
  const cross = (env.LISTEN_RELAY_CROSS_CHECK_MODEL ?? '').trim();
  return {
    apiKey,
    model,
    crossCheckModel: cross && cross !== model ? cross : null,
    baseUrl: (env.LISTEN_RELAY_BASE_URL ?? '').trim().replace(/\/+$/, '') || LISTEN_RELAY_DEFAULT_BASE_URL,
  };
}

function flatText(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function errorDetail(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: unknown } | string };
    if (typeof parsed.error === 'string') return flatText(parsed.error, 200);
    if (parsed.error && typeof parsed.error.message === 'string') return flatText(parsed.error.message, 200);
  } catch {
    // A non-JSON error page is reported as its first characters.
  }
  return flatText(raw, 200);
}

function numeric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

function tokenCount(usage: Record<string, unknown> | null, ...keys: string[]): number {
  for (const key of keys) {
    const value = numeric(usage?.[key]);
    if (value > 0) return value;
  }
  return 0;
}

/** OpenAI-style details, Gemini's input details, or a flat audio_tokens. */
export function relayAudioTokens(usage: unknown): number {
  if (usage === null || typeof usage !== 'object') return 0;
  const record = usage as Record<string, unknown>;
  let audio = 0;
  for (const detailsKey of ['prompt_tokens_details', 'input_tokens_details']) {
    const details = record[detailsKey];
    if (details && typeof details === 'object') {
      const detail = details as Record<string, unknown>;
      audio = Math.max(audio, numeric(detail.audio_tokens), numeric(detail.audio));
    }
  }
  return Math.max(audio, numeric(record.audio_tokens));
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
        return (part as { text: string }).text;
      }
      return '';
    })
    .join('');
}

/** The video's own timeline labels: m:ss, the same clock the summary uses. */
export function relayTimestampsMs(note: string): number[] {
  const stamps: number[] = [];
  for (const match of note.matchAll(/\b(\d{1,3}):([0-5]\d)\b/g)) {
    stamps.push(Number(match[1]) * 60_000 + Number(match[2]) * 1_000);
  }
  return stamps;
}

function normalizeLyricText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Checks an unverified note against section boundaries and whisper words. */
export function crossCheckRelayNote(
  note: string,
  sections: readonly RelaySection[],
  transcriptWords: readonly string[] = [],
): ListenRelayCheck {
  const boundaries = sections.flatMap((section) => [section.fromMs, section.toMs]);
  const timestamps = relayTimestampsMs(note);
  const matchedTimestamps = timestamps.filter((stamp) => boundaries.some(
    (boundary) => Math.abs(boundary - stamp) <= RELAY_TIMESTAMP_WINDOW_MS,
  )).length;
  const quotes = [...note.matchAll(/[«“"]([^«»“”"]{2,140})[»”"]/g)]
    .map((match) => normalizeLyricText(match[1]!))
    .filter((quote) => quote.length > 0);
  const transcript = normalizeLyricText(transcriptWords.join(' '));
  const matchedQuotes = quotes.filter((quote) => transcript.includes(quote)).length;
  return { timestamps: timestamps.length, matchedTimestamps, quotes: quotes.length, matchedQuotes };
}

export const MP3_BITRATES_KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];

export function relayMp3Args(file: string): string[] {
  return [
    '-v', 'error', '-nostdin', '-y',
    '-i', file,
    '-vn', '-sn', '-dn',
    '-ac', '1', '-b:a', '64k',
    '-map_metadata', '-1', '-id3v2_version', '0', '-write_xing', '0',
    '-f', 'mp3',
    'pipe:1',
  ];
}

/** Decodes nothing to PCM again: ffmpeg shrinks the original straight to mp3. */
export async function encodeRelayMp3(
  file: string,
  options: { readonly timeoutMs?: number } = {},
): Promise<Buffer> {
  if (!file) throw new Error('the relay needs a local audio file');
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawnMediaProcess(ffmpegBin(), relayMp3Args(file), {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const chunks: Buffer[] = [];
    let stderr = '';
    let total = 0;
    let settled = false;
    const finish = (error?: Error, value?: Buffer): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        child.kill('SIGKILL');
        reject(error);
        return;
      }
      resolve(value!);
    };
    const timer = setTimeout(
      () => finish(new Error(`relay encode timed out after ${Math.round((options.timeoutMs ?? RELAY_ENCODE_TIMEOUT_MS) / 1000)}s`)),
      options.timeoutMs ?? RELAY_ENCODE_TIMEOUT_MS,
    );
    child.stdout.on('data', (chunk: Buffer) => {
      if (settled) return;
      total += chunk.length;
      if (total > RELAY_MAX_MP3_BYTES) {
        finish(new Error(`relay mp3 exceeds ${Math.round(RELAY_MAX_MP3_BYTES / (1024 * 1024))} MB`));
        return;
      }
      chunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < 8_192) stderr += chunk.toString('utf8');
    });
    child.on('error', (error: NodeJS.ErrnoException) => {
      finish(new Error(`ffmpeg failed to start: ${error.message}`));
    });
    child.on('close', (code) => {
      if (code !== 0) {
        finish(new Error(`ffmpeg exited with code ${code}: ${stderr.trim().slice(-600) || 'no diagnostics'}`));
        return;
      }
      if (!total) {
        finish(new Error('ffmpeg produced an empty relay mp3'));
        return;
      }
      finish(undefined, Buffer.concat(chunks, total));
    });
  });
}

export function relayRequestBody(model: string, mp3: Buffer): Record<string, unknown> {
  return {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: LISTEN_PROMPT },
          { type: 'input_audio', input_audio: { data: mp3.toString('base64'), format: 'mp3' } },
        ],
      },
    ],
    temperature: 0.3,
    max_tokens: RELAY_MAX_TOKENS,
    usage: { include: true },
  };
}

/** Exported so the verify can prove the header we send without a real call. */
export function relayRequestHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Title': 'Corteo listen_to_song',
  };
}

async function askRelay(
  config: ListenRelayConfig,
  model: string,
  mp3: Buffer,
  fetchImpl: typeof fetch,
): Promise<RelayReply> {
  const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: relayRequestHeaders(config.apiKey),
    body: JSON.stringify(relayRequestBody(model, mp3)),
    signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
  });
  const raw = await response.text();
  if (!response.ok) {
    const detail = errorDetail(raw);
    throw new Error(`OpenRouter respondió ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('OpenRouter devolvió una respuesta que no es JSON');
  }
  const body = parsed as {
    provider?: unknown;
    model?: unknown;
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: unknown;
  };
  const text = flatText(messageText(body.choices?.[0]?.message?.content), RELAY_NOTE_MAX_CHARS);
  if (!text) throw new Error('OpenRouter devolvió una respuesta sin texto');
  const usage = body.usage && typeof body.usage === 'object'
    ? body.usage as Record<string, unknown>
    : null;
  return {
    text,
    model: typeof body.model === 'string' && body.model.trim() ? flatText(body.model, 120) : model,
    provider: typeof body.provider === 'string' && body.provider.trim()
      ? flatText(body.provider, 120)
      : 'openrouter',
    usage,
  };
}

export function relayCacheKey(assetId: string, sourceRevision: string, model: string): string {
  return JSON.stringify(['openrouter', model, assetId, sourceRevision]);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function relayRemoteKey(cacheKeyValue: string): Promise<string> {
  return `listen-relay:${await sha256Hex(cacheKeyValue)}`;
}

function validRelaySnapshot(value: unknown): value is ListenRelaySnapshot {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const relay = value as Partial<Record<keyof ListenRelaySnapshot, unknown>>;
  if (typeof relay.provider !== 'string' || relay.provider.length === 0 || relay.provider.length > 200) return false;
  if (typeof relay.model !== 'string' || relay.model.length === 0 || relay.model.length > 200) return false;
  if (relay.status !== 'verificado' && relay.status !== 'sin verificar') return false;
  for (const count of [relay.audioTokens, relay.promptTokens, relay.completionTokens]) {
    if (!Number.isInteger(count) || (count as number) < 0) return false;
  }
  if (typeof relay.cached !== 'boolean') return false;
  if (typeof relay.note !== 'string' || relay.note.length === 0 || relay.note.length > RELAY_NOTE_MAX_CHARS) return false;
  const check = relay.check as Partial<Record<keyof ListenRelayCheck, unknown>> | undefined;
  if (check !== undefined) {
    const counts = [check.timestamps, check.matchedTimestamps, check.quotes, check.matchedQuotes];
    if (counts.some((count) => !Number.isInteger(count) || (count as number) < 0)) return false;
    if ((check.matchedTimestamps as number) > (check.timestamps as number)) return false;
    if ((check.matchedQuotes as number) > (check.quotes as number)) return false;
  }
  return true;
}

function validStoredRelay(value: unknown, key: string): value is StoredListenRelay {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const stored = value as Partial<Record<keyof StoredListenRelay, unknown>>;
  return stored.key === key && validRelaySnapshot(stored.relay);
}

async function loadCachedRelay(
  assetId: string,
  sourceRevision: string,
  model: string,
): Promise<ListenRelaySnapshot | null> {
  const key = relayCacheKey(assetId, sourceRevision, model);
  const row = await getStoredEntry(await relayRemoteKey(key));
  if (!row.found || !validStoredRelay(row.value, key)) return null;
  return { ...row.value.relay, cached: true };
}

async function saveCachedRelay(
  assetId: string,
  sourceRevision: string,
  model: string,
  relay: ListenRelaySnapshot,
): Promise<void> {
  const key = relayCacheKey(assetId, sourceRevision, model);
  const stored: StoredListenRelay = { key, relay: { ...relay, cached: false } };
  await setStoredEntry(await relayRemoteKey(key), stored);
}

/**
 * One request, one note. Returns null when the relay is off. A configured
 * cross-check model is asked once more only when the first answer reports no
 * audio tokens, so the default path never pays for two calls.
 */
export async function relayListenToSong(
  input: RelayListenInput,
): Promise<ListenRelaySnapshot | null> {
  const config = input.config ?? listenRelayConfig();
  if (!config) return null;
  try {
    const cached = await loadCachedRelay(input.assetId, input.sourceRevision, config.model);
    if (cached) return cached;
  } catch {
    // An unreadable cache must not block a call the user asked for.
  }
  if (!input.audioFile) throw new Error('the relay needs a local audio file');
  const encode = input.encodeMp3 ?? encodeRelayMp3;
  const mp3 = await encode(input.audioFile);
  const fetchImpl = input.fetchImpl ?? fetch;
  const primary = await askRelay(config, config.model, mp3, fetchImpl);
  let winner = primary;
  if (relayAudioTokens(primary.usage) === 0 && config.crossCheckModel) {
    try {
      const cross = await askRelay(config, config.crossCheckModel, mp3, fetchImpl);
      if (relayAudioTokens(cross.usage) > 0) winner = cross;
    } catch {
      // The first answer still stands when the cross-check call fails.
    }
  }
  const audioTokens = relayAudioTokens(winner.usage);
  const relay: ListenRelaySnapshot = {
    provider: winner.provider,
    model: winner.model,
    status: audioTokens > 0 ? 'verificado' : 'sin verificar',
    audioTokens,
    promptTokens: tokenCount(winner.usage, 'prompt_tokens', 'input_tokens'),
    completionTokens: tokenCount(winner.usage, 'completion_tokens', 'output_tokens'),
    cached: false,
    ...(audioTokens > 0
      ? {}
      : { check: crossCheckRelayNote(winner.text, input.sections, input.transcriptWords ?? []) }),
    note: winner.text,
  };
  try {
    await saveCachedRelay(input.assetId, input.sourceRevision, config.model, relay);
  } catch {
    // Losing the cache costs another call next time, not this note.
  }
  return relay;
}
