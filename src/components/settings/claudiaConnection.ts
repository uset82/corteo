export const CLAUDIA_MCP_URL = 'https://corteo.uset82.workers.dev/api/external-mcp/mcp';

/** Snippet Claudia pastes into her Agent SDK connection. The token stays in her env. */
export function claudiaDefineConnection(token: string): string {
  return [
    'export default defineConnection({',
    `  url: process.env.OPENCHATCUT_MCP_URL!, // ${CLAUDIA_MCP_URL}`,
    '  headers: { Authorization: `Bearer ${process.env.OPENCHATCUT_MCP_TOKEN}` },',
    '  advertiseTools: true,',
    '});',
    '',
    `// OPENCHATCUT_MCP_URL=${CLAUDIA_MCP_URL}`,
    `// OPENCHATCUT_MCP_TOKEN=${token}`,
    '// hosting.egressDomains must include corteo.uset82.workers.dev',
  ].join('\n');
}
