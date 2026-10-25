import assert from 'node:assert/strict';
import { CLAUDIA_MCP_URL, claudiaDefineConnection } from './claudiaConnection.ts';

const snippet = claudiaDefineConnection('token-de-prueba');
assert.match(snippet, /export default defineConnection\(/);
assert.match(snippet, /advertiseTools: true/);
assert.match(snippet, new RegExp(CLAUDIA_MCP_URL.replace(/[.]/g, '\\.')));
assert.match(snippet, /OPENCHATCUT_MCP_TOKEN=token-de-prueba/);
assert.match(snippet, /hosting\.egressDomains/);
assert.equal(CLAUDIA_MCP_URL, 'https://corteo.uset82.workers.dev/api/external-mcp/mcp');

console.log('claudiaConnection.verify: the Conectar Claudia snippet is valid');
