import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createMiniConnect } from '../../desktop/mini-connect.ts';
import { KEY_NAMES, seedKeystore } from '../keystore.ts';
import {
  PROVIDERS_OFF_ALLOWED,
  PROVIDERS_OFF_BLOCKED_PREFIXES,
  providersOff,
} from './providers-off.ts';
import { providersOffPlugin } from './providers-off.ts';

seedKeystore({
  ...Object.fromEntries(KEY_NAMES.map((name) => [name, ''])),
  LLM_PROVIDER: 'anthropic',
});

assert.deepEqual([...PROVIDERS_OFF_ALLOWED], ['dsh', 'ollama', 'lmstudio']);
assert.deepEqual(
  [...PROVIDERS_OFF_BLOCKED_PREFIXES],
  [
    '/api/codex', '/api/copilot', '/api/claude-code', '/api/xai-oauth',
    '/generate/image', '/generate/video', '/generate/voice', '/generate/music', '/generate/sound',
    '/api/stock-search', '/api/firecrawl', '/api/web-browser',
    '/assemblyai', '/api/assemblyai-upload', '/e2b', '/api/upload-post', '/api/transcribe',
  ],
);
assert.equal(providersOff({}), false, 'absent switch keeps every provider');
assert.equal(providersOff({ OPENCHATCUT_PROVIDERS: 'on' }), false);
assert.equal(providersOff({ OPENCHATCUT_PROVIDERS: 'off' }), true);

const passed: string[] = [];
const app = createMiniConnect((error) => { throw error; });
const configure = providersOffPlugin().configureServer;
assert.equal(typeof configure, 'function');
if (typeof configure === 'function') {
  await configure.call({} as never, { middlewares: app } as never);
}
app.use((req, res) => {
  passed.push(req.url ?? '/');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end('{"passed":true}');
});
const server = createServer(app.handle);
await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
assert(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}`;

async function request(path: string, provider?: string): Promise<Response> {
  return fetch(`${origin}${path}`, {
    method: 'POST',
    ...(provider === undefined ? {} : { headers: { 'x-openchatcut-provider': provider } }),
    body: '{}',
  });
}

async function assertBlocked(path: string, provider?: string): Promise<void> {
  const response = await request(path, provider);
  assert.equal(response.status, 403, `${path} (${provider ?? 'saved provider'}) must answer 403`);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.equal(await response.text(), '{"error":"providers_disabled"}',
    'the refusal body is the exact stable JSON other tracks match on');
}

const previous = process.env.OPENCHATCUT_PROVIDERS;
try {
  process.env.OPENCHATCUT_PROVIDERS = 'off';

  await assertBlocked('/llm/messages', 'anthropic');
  await assertBlocked('/llm/responses', 'openai');
  await assertBlocked('/llm/messages', 'xai-oauth');
  await assertBlocked('/llm/messages', 'retired-provider');
  await assertBlocked('/llm/messages');
  await assertBlocked('/llm');

  for (const provider of ['dsh', 'ollama', 'lmstudio']) {
    const response = await request('/llm/messages', provider);
    assert.equal(response.status, 200, `${provider} stays reachable under the switch`);
    assert.deepEqual(await response.json(), { passed: true });
  }
  for (const mount of PROVIDERS_OFF_BLOCKED_PREFIXES) {
    await assertBlocked(mount);
    await assertBlocked(`${mount}/status`);
  }
  const boundary = await request('/api/codexfoo');
  assert.equal(boundary.status, 200, 'only the whole mount is blocked, not a longer sibling path');
  const unrelated = await request('/api/keys');
  assert.equal(unrelated.status, 200, 'unrelated API mounts keep working');
  for (const localPath of ['/generate/progress', '/generate/subtitles', '/api/isolate-voice', '/api/auto-grade', '/api/hf-proxy']) {
    assert.equal((await request(localPath)).status, 200, `${localPath} stays local under the switch`);
  }

  // The saved default is resolved exactly like the proxy does.
  seedKeystore({ LLM_PROVIDER: 'dsh' });
  const savedLocal = await request('/llm/chat/completions');
  assert.equal(savedLocal.status, 200, 'saved LLM_PROVIDER=dsh passes without a header');
  seedKeystore({ LLM_PROVIDER: 'anthropic' });

  // The switch is read per request, so removing the variable restores
  // today's behavior without a restart.
  delete process.env.OPENCHATCUT_PROVIDERS;
  assert.equal((await request('/llm/messages', 'anthropic')).status, 200);
  assert.equal((await request('/api/codex/status')).status, 200);
  assert.equal((await request('/api/xai-oauth/start')).status, 200);

  process.env.OPENCHATCUT_PROVIDERS = 'off';
  await assertBlocked('/llm/messages', 'anthropic');
  await assertBlocked('/api/codex/status');
} finally {
  if (previous === undefined) delete process.env.OPENCHATCUT_PROVIDERS;
  else process.env.OPENCHATCUT_PROVIDERS = previous;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

console.log('providers-off checks passed');
