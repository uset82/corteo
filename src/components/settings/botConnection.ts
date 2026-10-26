export const CORTEO_MCP_URL = 'https://corteo.uset82.workers.dev/api/external-mcp/mcp';

/** Snippet a Grok Bot pastes into its Agent SDK connection. The token stays in its env. */
export function corteoDefineConnection(token: string): string {
  return [
    'export default defineConnection({',
    `  url: process.env.OPENCHATCUT_MCP_URL!, // ${CORTEO_MCP_URL}`,
    '  headers: { Authorization: `Bearer ${process.env.OPENCHATCUT_MCP_TOKEN}` },',
    '  advertiseTools: true,',
    '});',
    '',
    `// OPENCHATCUT_MCP_URL=${CORTEO_MCP_URL}`,
    `// OPENCHATCUT_MCP_TOKEN=${token}`,
    '// hosting.egressDomains must include corteo.uset82.workers.dev',
  ].join('\n');
}
