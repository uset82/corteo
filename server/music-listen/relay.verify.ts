// The real ear is one paid OpenRouter call, so the verify guards every way it
// could run unasked or be wasted: off means no request, the request carries a
// 64 kbps mono mp3 and the Spanish prompt, audio_tokens marks the note
// verified, an unverified note is cross-checked against local evidence, and a
// second call reads the cache instead of paying again. A local mock server
// stands in for OpenRouter; ffmpeg really encodes the fixture.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fixture = await mkdtemp(join(tmpdir(), 'occ-relay-'));
const previousHome = process.env.HOME;
process.env.HOME = join(fixture, 'home');
const previousDataDir = process.env.OPENCHATCUT_DATA_DIR;
process.env.OPENCHATCUT_DATA_DIR = join(fixture, 'data');
await mkdir(process.env.HOME, { recursive: true });
await mkdir(process.env.OPENCHATCUT_DATA_DIR, { recursive: true });
const relayEnvNames = [
  'OPENCHATCUT_LISTEN_RELAY',
  'OPENROUTER_API_KEY',
  'LISTEN_RELAY_BASE_URL',
  'LISTEN_RELAY_MODEL',
  'LISTEN_RELAY_CROSS_CHECK_MODEL',
  'OPENCHATCUT_PROVIDERS',
] as const;
const previousEnv = new Map(relayEnvNames.map((name) => [name, process.env[name]]));
for (const name of relayEnvNames) delete process.env[name];

const {
  LISTEN_RELAY_DEFAULT_MODEL,
  encodeRelayMp3,
  listenRelayConfig,
  relayAudioTokens,
  relayCacheKey,
  relayListenToSong,
  relayRemoteKey,
  relayTimestampsMs,
  crossCheckRelayNote,
  MP3_BITRATES_KBPS,
} = await import('./relay.ts');
const { getStoredEntry } = await import('../plugins/project-store.ts');
const { buildListenSnapshot, LISTEN_TEXT_MAX_CHARS } = await import('../../shared/music-inference/listen-snapshot.ts');
const { MUSIC_INTELLIGENCE_TOOL_SCHEMAS } = await import('../../src/agent/tools/schemas/music-intelligence-tools.ts');

const SONG_SECONDS = 4;
const SAMPLE_RATE = 44_100;
const SECTIONS = [
  { fromMs: 0, toMs: 3_000 },
  { fromMs: 3_000, toMs: 6_000 },
  { fromMs: 6_000, toMs: 10_000 },
];
const WORDS = ['la', 'noche', 'llega', 'otra', 'línea'];

function synthSong(): Float32Array {
  const total = SAMPLE_RATE * SONG_SECONDS;
  const samples = new Float32Array(total);
  for (let index = 0; index < total; index += 1) {
    const t = index / SAMPLE_RATE;
    const beat = Math.exp(-((t % 0.5) * 18)) * Math.sin(2 * Math.PI * 1_100 * t);
    samples[index] = 0.35 * beat + 0.15 * Math.sin(2 * Math.PI * 220 * t);
  }
  return samples;
}

function wavFile(samples: Float32Array, sampleRate: number): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  for (let index = 0; index < samples.length; index += 1) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[index]!)) * 32_767), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

interface SeenRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: IncomingMessage['headers'];
  readonly body: Record<string, unknown>;
}

type Reply = { status?: number; json: unknown };
let responder: (body: Record<string, unknown>, index: number) => Reply | Promise<Reply> = () => (
  verifiedReply('Timbre cálido y seco. 0:02 entra la batería.')
);

function verifiedReply(content: string): Reply {
  return {
    json: {
      id: 'gen-relay',
      provider: 'Google',
      model: LISTEN_RELAY_DEFAULT_MODEL,
      choices: [{ message: { role: 'assistant', content } }],
      usage: {
        prompt_tokens: 120,
        completion_tokens: 80,
        total_tokens: 200,
        prompt_tokens_details: { audio_tokens: 1_280 },
      },
    },
  };
}

function bodyOf(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const requests: SeenRequest[] = [];
const server = createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/api/v1/chat/completions') {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }
  const body = JSON.parse(await bodyOf(req)) as Record<string, unknown>;
  requests.push({ url: req.url, method: req.method, headers: req.headers, body });
  const reply = await responder(body, requests.length);
  res.statusCode = reply.status ?? 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(reply.json));
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = (server.address() as AddressInfo).port;
const baseUrl = `http://127.0.0.1:${port}/api/v1`;

function audioPartOf(body: Record<string, unknown>): { format?: string; data?: string } {
  const messages = body.messages as Array<{ role: string; content: unknown }>;
  const user = messages.find((message) => message.role === 'user');
  assert.ok(Array.isArray(user?.content), 'the user turn carries content parts');
  const part = (user!.content as Array<Record<string, unknown>>).find((entry) => entry.type === 'input_audio');
  assert.ok(part, 'the request includes the audio part');
  return part!.input_audio as { format?: string; data?: string };
}

function textPartOf(body: Record<string, unknown>): string {
  const messages = body.messages as Array<{ role: string; content: unknown }>;
  const user = messages.find((message) => message.role === 'user');
  const part = (user!.content as Array<Record<string, unknown>>).find((entry) => entry.type === 'text');
  return String(part?.text ?? '');
}

function mp3Shape(mp3: Buffer): { bitrate: number; channelMode: number } {
  assert.equal(mp3[0], 0xff, 'the relay payload starts with an mp3 frame, not a tag');
  assert.equal(mp3[1]! & 0xe0, 0xe0, 'mpeg frame sync');
  assert.equal((mp3[1]! >> 3) & 0x03, 3, 'MPEG-1');
  assert.equal((mp3[1]! >> 1) & 0x03, 1, 'Layer III');
  return {
    bitrate: MP3_BITRATES_KBPS[(mp3[2]! >> 4) & 0x0f]!,
    channelMode: (mp3[3]! >> 6) & 0x03,
  };
}

try {
  const songPath = join(fixture, 'song.wav');
  await writeFile(songPath, wavFile(synthSong(), SAMPLE_RATE));
  const input = {
    audioFile: songPath,
    assetId: 'asset-relay',
    sourceRevision: 'rev-1',
    sections: SECTIONS,
    transcriptWords: WORDS,
  };

  // 1. Off: no switch, no key, no call. The cloud switch alone does not matter.
  assert.equal(listenRelayConfig({} as NodeJS.ProcessEnv), null, 'the relay is off by default');
  assert.equal(
    listenRelayConfig({ OPENCHATCUT_LISTEN_RELAY: 'openrouter' } as NodeJS.ProcessEnv),
    null,
    'the switch without a key is still off',
  );
  assert.equal(
    listenRelayConfig({ OPENROUTER_API_KEY: 'k' } as NodeJS.ProcessEnv),
    null,
    'a key without the switch is still off',
  );
  assert.equal(await relayListenToSong(input), null, 'an off relay returns nothing');
  assert.equal(requests.length, 0, 'an off relay makes no HTTP call');

  // 2. On: the default model, a 64 kbps mono mp3 and the Spanish prompt.
  //    OPENCHATCUT_PROVIDERS=off does not gate the relay: it is the one opt-in
  //    paid exception, and the relay has its own two switches.
  process.env.OPENCHATCUT_LISTEN_RELAY = 'openrouter';
  process.env.OPENROUTER_API_KEY = 'test-key-relay';
  process.env.OPENCHATCUT_PROVIDERS = 'off';
  process.env.LISTEN_RELAY_BASE_URL = baseUrl;
  assert.ok(listenRelayConfig(), 'the two switches turn the relay on');

  const verified = await relayListenToSong(input);
  assert.ok(verified, 'the relay answers when it is on');
  assert.equal(verified.status, 'verificado', 'audio_tokens > 0 proves the model heard the song');
  assert.equal(verified.audioTokens, 1_280);
  assert.equal(verified.promptTokens, 120);
  assert.equal(verified.completionTokens, 80);
  assert.equal(verified.provider, 'Google');
  assert.equal(verified.model, LISTEN_RELAY_DEFAULT_MODEL);
  assert.equal(verified.cached, false);
  assert.equal(verified.check, undefined, 'a verified note needs no local cross-check');
  assert.ok(verified.note.includes('0:02 entra la batería'));

  assert.equal(requests.length, 1, 'one request per song');
  const first = requests[0]!;
  assert.equal(first.url, '/api/v1/chat/completions');
  assert.equal(first.method, 'POST');
  assert.equal(first.headers.authorization, 'Bearer test-key-relay');
  assert.match(String(first.headers['content-type']), /application\/json/);
  assert.equal(first.body.model, LISTEN_RELAY_DEFAULT_MODEL, 'the default model is used');
  const messages = first.body.messages as Array<{ role: string; content: string | unknown[] }>;
  assert.equal(messages[0]!.role, 'system');
  assert.match(String(messages[0]!.content), /español/);
  const prompt = textPartOf(first.body);
  for (const expected of ['Timbre', 'Emoción vocal', 'Arreglo', 'Arco emocional', 'm:ss', 'comillas angulares', '12 palabras']) {
    assert.ok(prompt.includes(expected), `the Spanish prompt asks for "${expected}"`);
  }
  const audio = audioPartOf(first.body);
  assert.equal(audio.format, 'mp3');
  const mp3 = Buffer.from(String(audio.data), 'base64');
  const shape = mp3Shape(mp3);
  assert.equal(shape.bitrate, 64, `the song travels as a 64 kbps mp3, got ${shape.bitrate}`);
  assert.equal(shape.channelMode, 3, 'the mp3 is mono');
  assert.ok(mp3.length > 20_000 && mp3.length < 40_000, `four seconds at 64 kbps, got ${mp3.length} bytes`);
  const encoded = await encodeRelayMp3(songPath);
  assert.deepEqual(mp3Shape(encoded), { bitrate: 64, channelMode: 3 }, 'the encoder itself is 64 kbps mono');

  // 3. The second call reads the cache: same note, no second bill.
  const cached = await relayListenToSong(input);
  assert.ok(cached);
  assert.equal(cached.cached, true);
  assert.equal(cached.note, verified.note);
  assert.equal(requests.length, 1, 'a cached note spends nothing');
  const storedKey = await relayRemoteKey(relayCacheKey('asset-relay', 'rev-1', LISTEN_RELAY_DEFAULT_MODEL));
  const stored = await getStoredEntry(storedKey);
  assert.equal(stored.found, true, 'the note lives in the project store');

  // 4. The cache is per model: another model pays for its own answer.
  process.env.LISTEN_RELAY_MODEL = 'openai/gpt-audio';
  responder = (body) => ({
    json: {
      provider: 'OpenAI',
      model: String(body.model),
      choices: [{ message: { content: 'Otra escucha. 0:03 sube la voz.' } }],
      usage: { prompt_tokens: 90, completion_tokens: 40, prompt_tokens_details: { audio_tokens: 700 } },
    },
  });
  const otherModel = await relayListenToSong(input);
  assert.ok(otherModel);
  assert.equal(otherModel.cached, false);
  assert.equal(requests.length, 2);
  assert.equal(requests[1]!.body.model, 'openai/gpt-audio');
  assert.equal(otherModel.model, 'openai/gpt-audio');
  delete process.env.LISTEN_RELAY_MODEL;

  // 5. audio_tokens = 0 means "sin verificar"; timestamps and quotes are
  //    checked against the local sections (±3 s) and the whisper words.
  responder = () => ({
    json: {
      provider: 'Google',
      model: LISTEN_RELAY_DEFAULT_MODEL,
      choices: [{
        message: {
          content: 'Arranca suave. 0:02 entra la batería; 0:07 rompe el estribillo; 0:20 vuelve el silencio. Letra: «la noche llega» y «brilla el mar».',
        },
      }],
      usage: { prompt_tokens: 100, completion_tokens: 60, prompt_tokens_details: {} },
    },
  });
  const unverified = await relayListenToSong({ ...input, sourceRevision: 'rev-2' });
  assert.ok(unverified);
  assert.equal(unverified.status, 'sin verificar');
  assert.equal(unverified.audioTokens, 0);
  assert.deepEqual(
    unverified.check,
    { timestamps: 3, matchedTimestamps: 2, quotes: 2, matchedQuotes: 1 },
    'two of three timestamps sit by a section change and one of two quotes is in the transcript',
  );
  const snapshot = buildListenSnapshot({
    assetName: 'Noche de prueba',
    durationMs: 10_000,
    range: { fromMs: 0, toMs: 10_000 },
    analysisSource: 'dsp',
    sections: SECTIONS.map((section) => ({ ...section, role: 'steady' as const, energy: 0.5 })),
    beatsMs: [],
    downbeatsMs: [],
    measurements: null,
    songMap: null,
    relay: unverified,
  });
  for (const expected of [
    'Oído real (Google · google/gemini-3.8-flash): sin verificar (0 tokens de audio)',
    'marcas de tiempo 2/3 junto a un cambio de sección (±3 s)',
    'citas 1/2 en la letra transcrita',
    '0:07 rompe el estribillo',
  ]) {
    assert.ok(snapshot.summaryEs.includes(expected), `summary must mention "${expected}"\n${snapshot.summaryEs}`);
  }
  const meta = snapshot.data.relay as Record<string, unknown>;
  assert.equal(meta.audioTokens, 0);
  assert.deepEqual(meta.check, { timestamps: 3, matchedTimestamps: 2, quotes: 2, matchedQuotes: 1 });
  const longNote = buildListenSnapshot({
    assetName: 'Noche de prueba',
    durationMs: 10_000,
    range: { fromMs: 0, toMs: 10_000 },
    analysisSource: 'dsp',
    sections: [],
    beatsMs: [],
    downbeatsMs: [],
    measurements: null,
    songMap: null,
    relay: { ...unverified, note: 'x'.repeat(5_000) },
  });
  assert.ok(
    JSON.stringify(longNote).length <= LISTEN_TEXT_MAX_CHARS,
    'a long relay note still fits the snapshot ceiling',
  );

  // 6. The optional cross-check model only runs when the first answer did not
  //    prove it heard, and only its verified answer replaces the note.
  responder = (body) => {
    const model = String(body.model);
    const isCross = model === 'google/gemini-audio';
    return {
      json: {
        provider: isCross ? 'Google' : 'OpenAI',
        model,
        choices: [{ message: { content: isCross ? 'Escucha verificada por el segundo modelo. 0:03 sube la voz.' : 'Primera escucha sin audio.' } }],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 20,
          prompt_tokens_details: isCross ? { audio_tokens: 640 } : {},
        },
      },
    };
  };
  process.env.LISTEN_RELAY_CROSS_CHECK_MODEL = 'google/gemini-audio';
  const crossed = await relayListenToSong({ ...input, sourceRevision: 'rev-3' });
  assert.ok(crossed);
  assert.equal(crossed.status, 'verificado', 'the cross-check answer can prove it heard');
  assert.equal(crossed.model, 'google/gemini-audio');
  assert.equal(crossed.audioTokens, 640);
  const crossRequests = requests.slice(-2);
  assert.deepEqual(crossRequests.map((request) => request.body.model), [LISTEN_RELAY_DEFAULT_MODEL, 'google/gemini-audio']);
  delete process.env.LISTEN_RELAY_CROSS_CHECK_MODEL;

  // 7. A provider error is visible and is never cached as a note.
  responder = () => ({ status: 500, json: { error: { message: 'sin saldo' } } });
  await assert.rejects(
    relayListenToSong({ ...input, sourceRevision: 'rev-4' }),
    /OpenRouter respondió 500: sin saldo/,
    'the provider error reaches the caller',
  );
  const failedKey = await relayRemoteKey(relayCacheKey('asset-relay', 'rev-4', LISTEN_RELAY_DEFAULT_MODEL));
  assert.equal((await getStoredEntry(failedKey)).found, false, 'a failed call is not cached');

  // 8. Off again: deleting the switch stops every further call.
  delete process.env.OPENCHATCUT_LISTEN_RELAY;
  const beforeOff = requests.length;
  assert.equal(await relayListenToSong({ ...input, sourceRevision: 'rev-5' }), null);
  assert.equal(requests.length, beforeOff, 'turning the switch off stops the relay');

  // 9. Small pure helpers used by the summary and the tool schema.
  assert.deepEqual(relayTimestampsMs('0:00 y 1:02 y 12:59'), [0, 62_000, 779_000]);
  assert.equal(relayAudioTokens({ input_tokens_details: { audio_tokens: 12 } }), 12);
  assert.equal(relayAudioTokens({ prompt_tokens_details: { audio: 7 } }), 7);
  assert.equal(relayAudioTokens(null), 0);
  assert.deepEqual(
    crossCheckRelayNote('0:03 «la noche llega»', SECTIONS, WORDS),
    { timestamps: 1, matchedTimestamps: 1, quotes: 1, matchedQuotes: 1 },
  );
  assert.deepEqual(
    crossCheckRelayNote('sin datos', SECTIONS, []),
    { timestamps: 0, matchedTimestamps: 0, quotes: 0, matchedQuotes: 0 },
  );
  const relaySchema = MUSIC_INTELLIGENCE_TOOL_SCHEMAS.find((tool) => tool.name === 'listen_to_song');
  const relayProperty = (relaySchema as {
    input_schema: { properties: Record<string, { type?: string }> };
  }).input_schema.properties.relay;
  assert.equal(relayProperty?.type, 'boolean', 'the tool exposes the relay as an opt-in boolean');

  console.log(
    `relay.verify: ${requests.length} mock requests, verified ${verified.audioTokens} audio tokens, `
    + `cross-check ${unverified.check?.matchedTimestamps}/3 timestamps, cache on the second call`,
  );
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const name of relayEnvNames) {
    const value = previousEnv.get(name);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;
  if (previousDataDir === undefined) delete process.env.OPENCHATCUT_DATA_DIR;
  else process.env.OPENCHATCUT_DATA_DIR = previousDataDir;
}
