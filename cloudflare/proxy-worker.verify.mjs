import assert from 'node:assert/strict';
import { proxyTarget } from './proxy-worker.mjs';

assert.equal(
  proxyTarget(
    'https://corteo.uset82.workers.dev/api/external-mcp/mcp?x=1',
    'https://editor.uset82.com',
  ),
  'https://editor.uset82.com/api/external-mcp/mcp?x=1',
);
assert.equal(
  proxyTarget('https://corteo.uset82.workers.dev/llm/chat/completions', 'https://editor.uset82.com/'),
  'https://editor.uset82.com/llm/chat/completions',
);
assert.throws(() => proxyTarget('https://corteo.uset82.workers.dev/', ''), /TUNNEL_ORIGIN is not set/);
assert.throws(() => proxyTarget('https://corteo.uset82.workers.dev/', 'ftp://editor.uset82.com'), /http/);

console.log('proxy-worker.verify: the public path is forwarded to the tunnel');
