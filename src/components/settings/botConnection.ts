// The facts a bot needs to reach this editor, and no way to leak the token.
//
// Everything here is rendered on a settings card that gets screenshotted, so the
// token appears as a file path and never as a value. The snippet carries
// environment variable *names*: the bot reads the token from its own environment,
// which the person fills from CORTEO_TOKEN_FILE.
export const CORTEO_MCP_URL = 'https://corteo.uset82.workers.dev/api/external-mcp/mcp';

/** Where the installer writes the token: 0600, readable by the account, never printed. */
export const CORTEO_TOKEN_FILE = '~/corteo/secrets.env';

/** The one door. A person pipes it to bash; a bot runs it detached and polls the log. */
export const CORTEO_INSTALL_LINE =
  'curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/install.sh | bash';

/**
 * The snippet a bot pastes into its Agent SDK connection. It takes no argument on
 * purpose: a signature that cannot receive a token cannot render one on a screen.
 */
export function corteoDefineConnection(): string {
  return [
    'export default defineConnection({',
    '  url: process.env.OPENCHATCUT_MCP_URL!,',
    '  headers: { Authorization: `Bearer ${process.env.OPENCHATCUT_MCP_TOKEN}` },',
    '  advertiseTools: true,',
    '});',
    '',
    `// OPENCHATCUT_MCP_URL=${CORTEO_MCP_URL}`,
    `// OPENCHATCUT_MCP_TOKEN: read it from ${CORTEO_TOKEN_FILE}, never paste it`,
    '// hosting.egressDomains must include the editor host',
  ].join('\n');
}
