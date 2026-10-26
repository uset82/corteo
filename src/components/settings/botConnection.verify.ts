import assert from 'node:assert/strict';
import { CORTEO_MCP_URL, corteoDefineConnection } from './botConnection.ts';

const snippet = corteoDefineConnection('token-de-prueba');
assert.match(snippet, /export default defineConnection\(/);
assert.match(snippet, /advertiseTools: true/);
assert.match(snippet, new RegExp(CORTEO_MCP_URL.replace(/[.]/g, '\\.')));
assert.match(snippet, /OPENCHATCUT_MCP_TOKEN=token-de-prueba/);
assert.match(snippet, /hosting\.egressDomains/);
assert.equal(CORTEO_MCP_URL, 'https://corteo.uset82.workers.dev/api/external-mcp/mcp');

console.log('botConnection.verify: the connect-a-bot snippet is valid');
