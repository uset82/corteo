import assert from 'node:assert/strict';
import {
  CORTEO_INSTALL_LINE,
  CORTEO_MCP_URL,
  CORTEO_TOKEN_FILE,
  corteoDefineConnection,
} from './botConnection.ts';

const snippet = corteoDefineConnection();

assert.match(snippet, /export default defineConnection\(/);
assert.match(snippet, /advertiseTools: true/);
assert.match(snippet, /process\.env\.OPENCHATCUT_MCP_TOKEN/);
assert.match(snippet, /hosting\.egressDomains/);
assert.equal(CORTEO_MCP_URL, 'https://corteo.uset82.workers.dev/api/external-mcp/mcp');

// The card this feeds is screenshotted, so nothing that reaches it may carry a
// token *value*: not the snippet, not the install line, not the URL, not the path.
for (const [what, text] of Object.entries({
  snippet,
  installLine: CORTEO_INSTALL_LINE,
  mcpUrl: CORTEO_MCP_URL,
  tokenFile: CORTEO_TOKEN_FILE,
})) {
  assert.doesNotMatch(text, /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/, `${what}: carries a bearer token`);
  assert.doesNotMatch(text, /OPENCHATCUT_MCP_TOKEN\s*=\s*\S/, `${what}: assigns a token value`);
}

// The snippet points at the file instead of holding the value.
assert.match(snippet, /OPENCHATCUT_MCP_TOKEN: read it from/);
assert.ok(snippet.includes(CORTEO_TOKEN_FILE), 'the snippet must name the token file');

assert.match(CORTEO_TOKEN_FILE, /secrets\.env$/, 'the token file is secrets.env beside the install');
assert.match(CORTEO_INSTALL_LINE, /install\.sh \| bash$/, 'the install line is the one door');

// The signature is the guarantee: with no parameter, no caller can pass a token in.
assert.equal(corteoDefineConnection.length, 0, 'corteoDefineConnection takes no argument');

console.log('botConnection.verify: the connect-a-bot card cannot carry a token');
