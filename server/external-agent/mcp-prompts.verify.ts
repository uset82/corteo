import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { handleMcpRequest, resetMcpSessionsForTest } from './mcp.ts';
import { resetExternalAgentBrokerForTest } from './broker.ts';
import { closeClient, connectClient } from './mcp-session-verifier.ts';

await resetMcpSessionsForTest();
resetExternalAgentBrokerForTest();
const server = createServer((req, res) => { void handleMcpRequest(req, res, 'http://127.0.0.1'); });
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert(address && typeof address !== 'string');
try {
  const client = await connectClient(new URL(`http://127.0.0.1:${address.port}/mcp`), 'prompt-check');
  try {
    const prompts = (await client.client.listPrompts()).prompts;
    const prompt = prompts.find((entry) => entry.name === 'escuchar-y-editar-cancion');
    assert(prompt);
    assert.equal(prompt.arguments?.[0]?.name, 'cancion');
    assert.equal(prompt.arguments?.[0]?.required, false);
    const result = await client.client.getPrompt({ name: prompt.name, arguments: { cancion: 'Mi canción' } });
    const content = result.messages[0].content;
    assert.equal(content.type, 'text');
    if (content.type === 'text') {
      assert.match(content.text, /Mi canción/);
      assert.match(content.text, /listen_to_song/);
      assert.match(content.text, /partitura emocional/);
    }
  } finally { await closeClient(client); }
} finally {
  await resetMcpSessionsForTest();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
console.log('mcp-prompts.verify: escuchar-y-editar-cancion passed');
