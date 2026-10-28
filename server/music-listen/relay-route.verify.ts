// Runnable check: `npx tsx server/music-listen/relay-route.verify.ts`.
// The dialog button must never reach a paid model unless both relay switches are
// on, and it must not learn anything about the key.
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleMusicRelayRequest, relayStatus, type MusicRelayRouteDeps } from './relay-route.ts';
import type { ListenRelayConfig } from './relay.ts';

interface Reply {
  status: number;
  body: Record<string, unknown>;
}

function request(method: string, body?: unknown): IncomingMessage {
  const stream = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;
  stream.method = method;
  return stream;
}

function response(): { res: ServerResponse; reply: () => Reply } {
  let status = 0;
  let raw = '';
  const res = {
    set statusCode(value: number) { status = value; },
    get statusCode() { return status; },
    setHeader: () => undefined,
    end: (chunk?: unknown) => { raw = typeof chunk === 'string' ? chunk : ''; },
  } as unknown as ServerResponse;
  return { res, reply: () => ({ status, body: JSON.parse(raw || '{}') as Record<string, unknown> }) };
}

const config: ListenRelayConfig = {
  apiKey: 'never-echoed', model: 'mock/ear', crossCheckModel: null, baseUrl: 'https://mock.test/api/v1',
};

const snapshot = {
  provider: 'openrouter', model: 'mock/ear', status: 'sin verificar' as const,
  audioTokens: 421, promptTokens: 900, completionTokens: 120, cached: false,
  note: 'La voz entra en 0:24 y el estribillo sube en 1:02.',
};

let listens = 0;
const deps: MusicRelayRouteDeps = {
  config: () => config,
  resolvePath: (src) => (src.includes('missing') ? undefined : `/srv${src}`),
  listen: async (asset, options) => {
    listens += 1;
    assert.equal(options.relay, true, 'the dialog path always asks for the real ear');
    assert.equal(options.pictures, false, 'the dialog only needs text');
    assert.equal(asset.sourceRevision, 'rev-1', 'the asset identity survives the round trip');
    return { ok: true, summary: 'Escuchada', relay: snapshot };
  },
  log: () => undefined,
};

const asset = {
  id: 'song-1', kind: 'audio' as const, name: 'cancion.wav', src: '/media/uploads/cancion.wav',
  durationInFrames: 5_000, sourceRevision: 'rev-1',
};

// GET reports the switch and the model, never the key or the base url.
{
  const { res, reply } = response();
  await handleMusicRelayRequest(request('GET'), res, deps);
  const got = reply();
  assert.equal(got.status, 200);
  assert.deepEqual(got.body, { ok: true, enabled: true, provider: 'openrouter', model: 'mock/ear' });
  assert.doesNotMatch(JSON.stringify(got.body), /never-echoed|mock\.test/);
}

assert.deepEqual(relayStatus(null), { ok: true, enabled: false });

// POST runs one listen and hands back the note.
{
  const { res, reply } = response();
  await handleMusicRelayRequest(request('POST', { asset }), res, deps);
  const got = reply();
  assert.equal(got.status, 200);
  assert.equal(got.body.ok, true);
  assert.equal((got.body.relay as { note?: string }).note, snapshot.note);
  assert.equal(listens, 1);
}

// Without the switches the request is refused before any media is touched.
{
  const { res, reply } = response();
  await handleMusicRelayRequest(request('POST', { asset }), res, { ...deps, config: () => null });
  assert.equal(reply().status, 409);
  assert.equal(listens, 1, 'a switched-off relay must not call the model');
}

// A src the server cannot resolve is refused, so the route reads no arbitrary path.
{
  const { res, reply } = response();
  await handleMusicRelayRequest(request('POST', { asset: { ...asset, src: '/media/uploads/missing.wav' } }), res, deps);
  assert.equal(reply().status, 404);
  assert.equal(listens, 1);
}

// Only GET and POST are answered.
{
  const { res, reply } = response();
  await handleMusicRelayRequest(request('PUT', { asset }), res, { ...deps, config: () => null });
  assert.equal(reply().status, 405);
}

// A failing listen surfaces as a bounded error, not a stack.
{
  const { res, reply } = response();
  await handleMusicRelayRequest(request('POST', { asset }), res, {
    ...deps,
    listen: async () => { throw new Error('ffmpeg is missing'); },
  });
  const got = reply();
  assert.equal(got.status, 502);
  assert.equal(got.body.error, 'ffmpeg is missing');
}

console.log('relay-route: the real-ear door stays shut without the switches and answers with the note when they are on');
