// Stub of the DeepSeek Harness forward port, exercised through the real /llm
// proxy and the same server model the agent runs use. It proves the gateway
// contract the editor depends on: forward-key auth, a model list, heartbeat
// comments, a silent start, reasoning deltas, one tool call split across SSE
// frames, and the follow-up tool-result turn.
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { jsonSchema, stepCountIs, streamText, tool } from 'ai';
import { createMiniConnect } from '../../desktop/mini-connect.ts';
import { KEY_NAMES, seedKeystore } from '../keystore.ts';
import { llmProxyPlugin } from '../plugins/llm-proxy.ts';
import { createServerLanguageModel } from './model.ts';

const FORWARD_KEY = 'fw-key';
const MODEL_ID = 'deepseek-v4-flash';
const SILENCE_MS = 1500;

interface CapturedRequest {
  readonly method: string;
  readonly url: string;
  readonly authorization: string | undefined;
  readonly body: string;
}

const requests: CapturedRequest[] = [];
let heartbeats = 0;

function sseChunk(delta: Record<string, unknown>, finishReason: string | null = null): string {
  return `data: ${JSON.stringify({
    id: 'dsh-stub-1',
    object: 'chat.completion.chunk',
    created: 1,
    model: MODEL_ID,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  })}\n\n`;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function refuseMissingKey(res: ServerResponse): void {
  res.writeHead(401, { 'content-type': 'application/json' });
  res.end('{"error":{"message":"missing or invalid API key"}}');
}

const stub = createServer(async (req, res) => {
  const body = await readBody(req);
  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
  requests.push({ method: req.method ?? '', url: req.url ?? '', authorization, body });
  if (authorization !== `Bearer ${FORWARD_KEY}`) {
    refuseMissingKey(res);
    return;
  }
  if (req.method === 'GET' && req.url === '/v1/models') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      object: 'list',
      data: [{ id: MODEL_ID, object: 'model', owned_by: 'deepseek-harness' }],
    }));
    return;
  }
  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    const parsed = JSON.parse(body) as { messages?: Array<{ role?: string }> };
    const withToolResult = (parsed.messages ?? []).some((message) => message.role === 'tool');
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    heartbeats += 1;
    res.write(': heartbeat\n\n');
    await delay(SILENCE_MS);
    if (withToolResult) {
      res.write(sseChunk({ role: 'assistant', content: 'Listo.' }));
      res.write(sseChunk({}, 'stop'));
    } else {
      res.write(sseChunk({ role: 'assistant', content: null, reasoning_content: 'Voy a usar la ' }));
      res.write(sseChunk({ reasoning_content: 'herramienta de prueba.' }));
      res.write(sseChunk({
        tool_calls: [{
          index: 0,
          id: 'call_dsh_1',
          type: 'function',
          function: { name: 'probe', arguments: '{"value":' },
        }],
      }));
      res.write(sseChunk({
        tool_calls: [{ index: 0, function: { arguments: '"ok"}' } }],
      }));
      res.write(sseChunk({}, 'tool_calls'));
    }
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end('{"error":{"message":"unexpected stub route"}}');
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

try {
  // Stub contract: the forward port rejects a request without the forward key.
  const unauthorized = await fetch(`${stubOrigin}/v1/chat/completions`, { method: 'POST', body: '{}' });
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(await unauthorized.json(), { error: { message: 'missing or invalid API key' } });

  const modelsResponse = await fetch(`${stubOrigin}/v1/models`, {
    headers: { authorization: `Bearer ${FORWARD_KEY}` },
  });
  assert.equal(modelsResponse.status, 200);
  const models = await modelsResponse.json() as { data: Array<{ id: string }> };
  assert.deepEqual(models.data.map((entry) => entry.id), [MODEL_ID]);

  seedKeystore({
    ...Object.fromEntries(KEY_NAMES.map((name) => [name, ''])),
    LLM_PROVIDER: 'dsh',
    LLM_DSH_API_KEY: FORWARD_KEY,
    LLM_DSH_BASE_URL: `${stubOrigin}/v1`,
  });

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

  // One streamed step: heartbeat comments, a silent start, reasoning, then one
  // tool call whose arguments arrive in two frames.
  const singleStartedAt = Date.now();
  const single = streamText({
    model: createServerLanguageModel('dsh', MODEL_ID, 'chat', proxyOrigin),
    prompt: 'Prueba la herramienta.',
    tools,
    maxRetries: 0,
    stopWhen: stepCountIs(1),
  });
  await single.consumeStream();
  const singleSteps = await single.steps;
  assert.equal(executed, 1, 'the split tool call executes exactly once');
  assert.equal(singleSteps.length, 1);
  assert.equal(singleSteps[0].finishReason, 'tool-calls');
  assert.match(singleSteps[0].reasoningText ?? '', /herramienta de prueba/);
  assert.equal(singleSteps[0].toolCalls[0]?.toolName, 'probe');
  assert.deepEqual(singleSteps[0].toolCalls[0]?.input, { value: 'ok' },
    'arguments split across frames are reassembled before execution');
  assert.equal(singleSteps[0].toolResults[0]?.output, 'tool-result-ok');
  assert.ok(Date.now() - singleStartedAt >= SILENCE_MS - 100,
    'the stream survives the heartbeat-only silence before the first token');

  // Full round trip: the follow-up request carries the tool result and the
  // gateway answers with the final text.
  executed = 0;
  const roundTrip = streamText({
    model: createServerLanguageModel('dsh', MODEL_ID, 'chat', proxyOrigin),
    prompt: 'Edita el título.',
    tools,
    maxRetries: 0,
    stopWhen: stepCountIs(2),
  });
  await roundTrip.consumeStream();
  const roundTripSteps = await roundTrip.steps;
  assert.equal(executed, 1);
  assert.equal(roundTripSteps.length, 2);
  assert.equal(roundTripSteps[0].finishReason, 'tool-calls');
  assert.equal(roundTripSteps[1].finishReason, 'stop');
  assert.equal(roundTripSteps[1].text, 'Listo.');

  const chatRequests = requests.filter((entry) => entry.method === 'POST' && entry.url === '/v1/chat/completions');
  assert.equal(chatRequests.length, 4, 'one direct stub-contract request plus three proxied steps');
  assert.equal(chatRequests[0].authorization, undefined, 'the direct stub contract request carries no key');
  for (const entry of chatRequests.slice(1)) {
    assert.equal(entry.authorization, `Bearer ${FORWARD_KEY}`, 'the proxy injects the saved forward key');
  }
  assert.match(chatRequests[3].body, /"role":"tool"/, 'the tool result travels back to the gateway');
  assert.ok(heartbeats >= 2, 'the stub sent heartbeat comments on every stream');
} finally {
  await close(proxyServer);
  await close(stub);
}

console.log('dsh-gateway.verify: stub gateway auth, heartbeat, reasoning and split tool call pass');
