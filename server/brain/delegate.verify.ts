import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { delegateTask } from './delegate.ts';
import { handleMcpRequest, mcpSessionsForTest, resetMcpSessionsForTest } from '../external-agent/mcp.ts';
import { resetExternalAgentBrokerForTest } from '../external-agent/broker.ts';
import { closeClient, connectClient } from '../external-agent/mcp-session-verifier.ts';

let calls = 0;
let answers: string[] = [];
let fail = false;
let requests: Array<Record<string, any>> = [];
const router = createServer(async (req, res) => {
  calls += 1;
  let body = '';
  for await (const chunk of req) body += String(chunk);
  requests.push(JSON.parse(body));
  assert.equal(req.headers.authorization, 'Bearer forward-secret');
  res.setHeader('content-type', 'application/json');
  if (fail) {
    res.writeHead(503);
    res.end(JSON.stringify({ error: { code: 'no_lane', tried: [{ lane: 'offline' }] } }));
  } else {
    res.setHeader('x-corteo-lane', 'test-lane');
    res.setHeader('x-corteo-latency-ms', '42');
    res.end(JSON.stringify({ choices: [{ message: { content: answers.shift() ?? '{}' } }] }));
  }
});
await new Promise<void>((resolve) => router.listen(0, '127.0.0.1', resolve));
const address = router.address();
assert(address && typeof address !== 'string');
const deps = { routerUrl: `http://127.0.0.1:${address.port}/v1`, forwardKey: 'forward-secret', secrets: ['mcp-secret'] };
const args = { alias: 'corteo-draft', kind: 'lyric_cards', input: 'verse', schema: { type: 'object', required: ['title'], properties: { title: { type: 'string' } } } };
try {
  answers = ['```json\n{"title":"Luz"}\n```'];
  let result = await delegateTask(args, deps);
  assert.equal(result.ok, true); assert.equal(result.attempts, 1); assert.equal(result.lane, 'test-lane');
  assert.equal(result.latencyMs, 42);
  assert.equal(requests[0].model, 'corteo-draft'); assert.equal(requests[0].max_tokens, 1024);
  assert.equal(requests[0].stream, false); assert.equal(requests[0].temperature, 0.2);
  answers = ['{}', '{"title":"Mar"}']; calls = 0;
  requests = [];
  result = await delegateTask(args, deps);
  assert.equal(result.ok, true); assert.equal(result.attempts, 2); assert.equal(calls, 2);
  assert.match(requests[1].messages[3].content, /Your JSON did not validate/);
  answers = ['{}', '{}']; calls = 0;
  result = await delegateTask(args, deps);
  assert.equal(result.error, 'invalid_json'); assert.equal(result.attempts, 2); assert.equal(calls, 2);
  fail = true; result = await delegateTask(args, deps); fail = false;
  assert.equal(result.error, 'brain_unavailable'); assert.equal(result.reason, 'no_lane'); assert.deepEqual(result.tried, [{ lane: 'offline' }]);
  result = await delegateTask(args, { ...deps, routerUrl: 'http://127.0.0.1:1/v1' });
  assert.equal(result.reason, 'router_down');
  calls = 0;
  for (const tool of ['submit_export', 'submit_render_job', 'publish_to_social', 'schedule_publish', 'remove_item', 'delete_project', 'clear_timeline', 'begin_edit_session', 'review_edit_session']) {
    result = await delegateTask({ ...args, alias: 'corteo-edit', kind: 'tool_args', tool }, deps);
    assert.equal(result.error, 'tool_not_allowed', tool);
  }
  assert.equal(calls, 0);
  assert.equal((await delegateTask({ ...args, alias: 'corteo-fast', kind: 'tool_args', tool: 'split_item' }, deps)).error, 'alias_not_allowed');
  for (const secret of ['mcp-secret', 'forward-secret', 'OPENCHATCUT_MCP_TOKEN']) {
    assert.equal((await delegateTask({ ...args, input: secret }, deps)).error, 'secret_in_input');
  }
  assert.equal((await delegateTask({ ...args, input: { wrapper: { timelines: [] } } }, deps)).error, 'project_json_not_allowed');
  assert.equal((await delegateTask({ ...args, schema: { description: 'mcp-secret' } }, deps)).error, 'secret_in_input');
  assert.equal((await delegateTask({ ...args, input: { items: [], tracks: [] } }, deps)).error, 'project_json_not_allowed');
  assert.equal((await delegateTask({ ...args, schema: { description: 'x'.repeat(4001) } }, deps)).error, 'schema_too_large');
  assert.equal((await delegateTask({ ...args, alias: 'bad' }, deps)).error, 'invalid_alias');
  assert.equal((await delegateTask({ ...args, kind: 'bad' }, deps)).error, 'invalid_kind');
  assert.equal((await delegateTask({ ...args, kind: 'tool_args' }, deps)).error, 'tool_required');
  answers = ['42'];
  result = await delegateTask({ ...args, schema: { type: 'integer', const: 42 } }, deps);
  assert.equal(result.json, 42);
  answers = ['x'.repeat(16001)];
  assert.equal((await delegateTask(args, deps)).error, 'answer_too_large');
  answers = ['{"adds":[],"updates":[]}', '{"adds":[],"updates":[]}']; calls = 0;
  result = await delegateTask({ ...args, alias: 'corteo-edit', kind: 'tool_args', tool: 'edit_item' }, deps);
  assert.equal(result.error, 'invalid_json'); assert.equal(calls, 2);
  assert.equal((await delegateTask({ ...args, input: 'x'.repeat(12001) }, deps)).error, 'input_too_large');
  assert.equal((await delegateTask({ ...args, schema: { type: 'bad' } }, deps)).error, 'invalid_schema');
} finally { await new Promise<void>((resolve) => router.close(() => resolve())); }

await resetMcpSessionsForTest();
resetExternalAgentBrokerForTest();
const server = createServer((req, res) => { void handleMcpRequest(req, res, 'http://127.0.0.1'); });
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const serverAddress = server.address();
assert(serverAddress && typeof serverAddress !== 'string');
try {
  for (const suffix of ['', '?toolExposure=progressive']) {
    const client = await connectClient(new URL(`http://127.0.0.1:${serverAddress.port}/mcp${suffix}`), `delegate-${suffix}`);
    try {
      assert.ok((await client.client.listTools()).tools.some((tool) => tool.name === 'delegate'));
      const response = await client.client.callTool({ name: 'delegate', arguments: { alias: 'wrong', kind: 'storyboard', input: {} } });
      assert.equal(response.structuredContent?.error, 'invalid_alias');
      assert.equal(mcpSessionsForTest().find((session) => session.id === client.sessionId)?.binding, null);
    } finally { await closeClient(client); }
  }
} finally {
  await resetMcpSessionsForTest();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
console.log('delegate.verify: all checks passed');
