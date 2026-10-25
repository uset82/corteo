// What this proves: the repair H-9 shipped in `eed3137` (`server/sse-tool-call-fix.ts`)
// turns the malformed tool-call deltas the DeepSeek Harness free lanes send into a
// stream the OpenAI-compatible SDK accepts, that every other provider still receives
// the gateway bytes verbatim, and that a compressed upstream body is never decoded as
// text — which would corrupt it before the rule could ever match.
//
// The rule lives on `ProxyRoute.sseLineFix`, so this drives the real `/llm` route
// rather than the transform in isolation: the browser chat and the server runs both
// go through it.
import assert from 'node:assert/strict';
import { createServer, request as httpRequest, type IncomingMessage } from 'node:http';
import { gunzipSync, gzipSync } from 'node:zlib';
import { jsonSchema, stepCountIs, streamText, tool } from 'ai';
import { createMiniConnect } from '../../desktop/mini-connect.ts';
import { KEY_NAMES, seedKeystore } from '../keystore.ts';
import { llmProxyPlugin } from '../plugins/llm-proxy.ts';
import { fixToolCallDeltaLine } from '../sse-tool-call-fix.ts';
import { createServerLanguageModel } from './model.ts';

const FORWARD_KEY = 'fw-key';
const MODEL_ID = 'deepseek-v4-flash';

type Scenario = 'stub' | 'crlf' | 'tail' | 'error' | 'gzip';
let scenario: Scenario = 'stub';

interface Captured {
  readonly url: string;
  readonly provider: string | undefined;
  readonly acceptEncoding: string | undefined;
}
const captured: Captured[] = [];
let lastWrittenBody = '';

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return typeof value === 'string' ? value : undefined;
}

function frame(delta: unknown, finishReason: string | null = null, eol = '\n\n'): string {
  return `data: ${JSON.stringify({
    id: 'dsh-stub-1',
    object: 'chat.completion.chunk',
    created: 1,
    model: MODEL_ID,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  })}${eol}`;
}

// The frame the lanes actually send: an index and nothing else.
const STUB_FRAME = frame({ tool_calls: [{ index: 0 }] });
// One entry carrying both defects: the StepFun empty `type`, then the real call.
const CALL_FRAME = frame({ tool_calls: [{ index: 0, id: 'call_1', type: '', function: { name: 'probe', arguments: '' } }] });
const ARGS_FRAME = frame({ tool_calls: [{ index: 0, function: { arguments: '{"value":"ok"}' } }] });
const STUB_BODY = `: heartbeat\n\n${STUB_FRAME}${CALL_FRAME}${ARGS_FRAME}${frame({}, 'tool_calls')}data: [DONE]\n\n`;
const FINAL_BODY = frame({ role: 'assistant', content: 'Listo.' }) + frame({}, 'stop') + 'data: [DONE]\n\n';
const CRLF_BODY = `: heartbeat\r\n\r\n${frame({ role: 'assistant', content: 'Añadido.' }, null, '\r\n\r\n')}${frame({}, 'stop', '\r\n\r\n')}data: [DONE]\r\n\r\n`;
// No trailing newline: the proxy has to flush the last line on `end`.
const TAIL_BODY = `: heartbeat\n\n${frame({ role: 'assistant', content: 'Cola.' }).trimEnd()}`;

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

const stub = createServer(async (req, res) => {
  const body = await readBody(req);
  captured.push({
    url: req.url ?? '',
    provider: header(req, 'x-openchatcut-provider'),
    acceptEncoding: header(req, 'accept-encoding'),
  });
  if (header(req, 'authorization') !== `Bearer ${FORWARD_KEY}`) {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end('{"error":{"message":"missing or invalid API key"}}');
    return;
  }
  if (req.method === 'GET' && req.url === '/v1/models') {
    const json = JSON.stringify({ object: 'list', data: [{ id: MODEL_ID, object: 'model' }] });
    res.writeHead(200, { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(json)) });
    res.end(json);
    return;
  }
  if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{"error":{"message":"unexpected stub route"}}');
    return;
  }
  if (scenario === 'error') {
    res.writeHead(429, { 'content-type': 'application/json' });
    res.end('{"error":{"message":"free lane is busy"}}');
    return;
  }
  if (scenario === 'gzip') {
    // Ignores the `identity` request on purpose: this is the gateway that compresses
    // anyway, and the one that used to be handed to the utf8 decoder.
    const compressed = gzipSync(Buffer.from(STUB_BODY, 'utf8'));
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'content-encoding': 'gzip',
      'content-length': String(compressed.length),
    });
    res.end(compressed);
    return;
  }
  const parsed = JSON.parse(body) as { messages?: Array<{ role?: string }> };
  const withToolResult = (parsed.messages ?? []).some((message) => message.role === 'tool');
  const payload = scenario === 'crlf' ? CRLF_BODY
    : scenario === 'tail' ? TAIL_BODY
      : withToolResult ? FINAL_BODY : STUB_BODY;
  lastWrittenBody = payload;
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  if (scenario === 'crlf') {
    // Split a two-byte character across two TCP writes.
    const bytes = Buffer.from(payload, 'utf8');
    const at = bytes.indexOf(Buffer.from('ñ', 'utf8'));
    assert.ok(at > 0, 'the CRLF body contains the multi-byte character');
    res.write(bytes.subarray(0, at + 1));
    res.write(bytes.subarray(at + 1));
  } else {
    res.write(payload);
  }
  res.end();
});

async function listen(server: ReturnType<typeof createServer>): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address && typeof address !== 'string');
  return address.port;
}

async function close(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

const stubPort = await listen(stub);
const stubOrigin = `http://127.0.0.1:${stubPort}`;

const app = createMiniConnect((error) => { throw error; });
const configureProvider = llmProxyPlugin().configureServer;
assert.equal(typeof configureProvider, 'function');
if (typeof configureProvider === 'function') {
  await configureProvider.call({} as never, { middlewares: app } as never);
}
const proxyServer = createServer(app.handle);
const proxyPort = await listen(proxyServer);
const proxyOrigin = `http://127.0.0.1:${proxyPort}`;

/** Raw request through the proxy, so the bytes can be asserted directly. */
async function throughProxy(
  path: string,
  provider: string,
  init: { acceptEncoding?: string } = {},
): Promise<{ status: number; text: string; contentLength: string | null }> {
  const post = path.endsWith('/chat/completions');
  const response = await fetch(`${proxyOrigin}/llm${path}`, {
    method: post ? 'POST' : 'GET',
    headers: {
      'x-openchatcut-provider': provider,
      ...(post ? { 'content-type': 'application/json' } : {}),
      ...(init.acceptEncoding ? { 'accept-encoding': init.acceptEncoding } : {}),
    },
    ...(post ? { body: JSON.stringify({ model: MODEL_ID, messages: [{ role: 'user', content: 'hola' }], stream: true }) } : {}),
  });
  return { status: response.status, text: await response.text(), contentLength: response.headers.get('content-length') };
}

/**
 * Same route, but with node:http so nothing decompresses behind our back: `fetch`
 * would hide the very corruption this checks for.
 */
function rawThroughProxy(path: string, provider: string): Promise<{ status: number; encoding: string | undefined; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${proxyOrigin}/llm${path}`);
    const req = httpRequest({
      host: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      headers: {
        'x-openchatcut-provider': provider,
        'content-type': 'application/json',
        'accept-encoding': 'identity',
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        encoding: typeof res.headers['content-encoding'] === 'string' ? res.headers['content-encoding'] : undefined,
        body: Buffer.concat(chunks),
      }));
    });
    req.on('error', reject);
    req.end(JSON.stringify({ model: MODEL_ID, messages: [{ role: 'user', content: 'hola' }], stream: true }));
  });
}

const lastCapture = (): Captured => {
  const entry = captured[captured.length - 1];
  assert.ok(entry, 'the stub recorded the request');
  return entry;
};

try {
  seedKeystore({
    ...Object.fromEntries(KEY_NAMES.map((name) => [name, ''])),
    LLM_PROVIDER: 'dsh',
    LLM_DSH_API_KEY: FORWARD_KEY,
    LLM_DSH_BASE_URL: `${stubOrigin}/v1`,
    LLM_OPENAI_API_KEY: FORWARD_KEY,
    LLM_OPENAI_BASE_URL: `${stubOrigin}/v1`,
  });

  // 1. Harness lane: the payload-free stub frame is repaired, the rest survives.
  scenario = 'stub';
  const dsh = await throughProxy('/chat/completions', 'dsh', { acceptEncoding: 'gzip' });
  assert.equal(dsh.status, 200);
  assert.ok(dsh.text.includes(': heartbeat\n\n'), 'heartbeat comments still reach the client');
  assert.ok(!dsh.text.includes('{"index":0}]}'), 'the bare stub frame does not reach the client');
  assert.ok(dsh.text.includes('"function":{}'), 'it carries the function object the SDK requires');
  assert.ok(!dsh.text.includes('"type":""'), 'the StepFun empty type is dropped');
  assert.ok(dsh.text.includes('"name":"probe"'), 'the real call frame is untouched');
  assert.ok(dsh.text.includes('data: [DONE]'), '[DONE] is passed through');
  assert.equal(lastCapture().acceptEncoding, 'identity', 'a rewritten stream is requested uncompressed');

  // 2. Any other provider: byte-identical passthrough, no identity rewrite.
  const other = await throughProxy('/chat/completions', 'openai', { acceptEncoding: 'gzip' });
  assert.equal(other.status, 200);
  assert.equal(other.text, lastWrittenBody, 'a non-dsh provider gets the gateway bytes verbatim');
  assert.equal(lastCapture().acceptEncoding, 'gzip', 'other providers keep the caller encoding');

  // 3. End to end: the repaired stream drives a tool and finishes the turn.
  scenario = 'stub';
  let executed = 0;
  const tools = {
    probe: tool({
      description: 'Records a probe call from the stub gateway.',
      inputSchema: jsonSchema<{ value: string }>({
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value'],
      }),
      execute: async () => {
        executed += 1;
        return 'tool-result-ok';
      },
    }),
  };
  const run = streamText({
    model: createServerLanguageModel('dsh', MODEL_ID, 'chat', proxyOrigin),
    prompt: 'Prueba la herramienta.',
    tools,
    maxRetries: 0,
    stopWhen: stepCountIs(2),
  });
  await run.consumeStream();
  const steps = await run.steps;
  assert.equal(executed, 1, 'the tool runs exactly once');
  assert.equal(steps.length, 2, 'the run continues after the tool result');
  assert.equal(steps[0].finishReason, 'tool-calls');
  assert.equal(steps[0].toolCalls[0]?.toolName, 'probe');
  assert.deepEqual(steps[0].toolCalls[0]?.input, { value: 'ok' });
  assert.equal(steps[0].toolResults[0]?.output, 'tool-result-ok');
  assert.equal(steps[1].text, 'Listo.');

  // 4. CRLF framing with a multi-byte character split across two writes.
  scenario = 'crlf';
  const crlf = streamText({
    model: createServerLanguageModel('dsh', MODEL_ID, 'chat', proxyOrigin),
    prompt: 'Escribe una palabra.',
    maxRetries: 0,
    stopWhen: stepCountIs(1),
  });
  await crlf.consumeStream();
  assert.equal((await crlf.steps)[0]?.text, 'Añadido.', 'CRLF and split UTF-8 survive the line buffer');

  // 5. A last line with no trailing newline is still flushed.
  scenario = 'tail';
  const tail = await throughProxy('/chat/completions', 'dsh');
  assert.ok(tail.text.includes('"Cola."'), 'the unterminated tail line is flushed on end');
  assert.ok(tail.text.endsWith('}]}'), 'nothing is truncated after the last line');

  // 6. A non-SSE response on the same route keeps its length and body.
  scenario = 'stub';
  const models = await throughProxy('/models', 'dsh');
  assert.equal(models.status, 200);
  assert.equal(models.contentLength, String(Buffer.byteLength(models.text)), 'JSON responses are not re-chunked');
  const parsed = JSON.parse(models.text) as { data: Array<{ id: string }> };
  assert.deepEqual(parsed.data.map((entry) => entry.id), [MODEL_ID]);

  // 7. Upstream errors still take the existing error path, not the rewrite.
  scenario = 'error';
  const failure = await throughProxy('/chat/completions', 'dsh');
  assert.equal(failure.status, 429);
  const body = JSON.parse(failure.text) as { error: { message: string } };
  assert.match(body.error.message, /DeepSeek Harness/, 'the dsh-specific Spanish message is kept');

  // 8. Compressed anyway: the bytes must arrive intact and still labelled gzip.
  //    Decoding them as utf8 would leave U+FFFD in the body and the rule would never
  //    match, so the repair is skipped and the caller keeps a decodable stream.
  scenario = 'gzip';
  const compressed = await rawThroughProxy('/chat/completions', 'dsh');
  assert.equal(compressed.status, 200);
  assert.equal(compressed.encoding, 'gzip', 'the encoding label is kept for the caller to decode');
  assert.equal(gunzipSync(compressed.body).toString('utf8'), STUB_BODY, 'the compressed body is passed through untouched');

  // 9. The rule on its own: fill the missing `function`, drop the empty `type`, and
  //    leave every other line byte for byte.
  assert.ok(fixToolCallDeltaLine(STUB_FRAME.trimEnd()).includes('"function":{}'), 'the rule adds the missing function object');
  assert.ok(!fixToolCallDeltaLine(CALL_FRAME.trimEnd()).includes('"type":""'), 'the empty type is dropped');
  const plainLine = FINAL_BODY.split('\n')[0] ?? '';
  assert.equal(fixToolCallDeltaLine(plainLine), plainLine, 'a content frame is returned unchanged');
} finally {
  await close(proxyServer);
  await close(stub);
}

console.log('dsh-sse-repair.verify: stub tool-call frame repaired, gzip body untouched, other providers verbatim');
