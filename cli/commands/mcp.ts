// `occ mcp token` — where a headless bot finds the localhost MCP bearer.
// The token is never printed unless --show is passed, and then only on stdout.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { flagBoolean, rejectUnknownFlags, type CommandLine } from '../args.ts';
import { CliError, UsageError } from '../errors.ts';
import { printJson, writeStdout } from '../output.ts';
import { loadOrCreateMcpToken, mcpTokenPath } from '../../server/mcp-token.ts';

function mcpUrl(): string {
  const port = process.env.CORTEO_PORT?.trim() || '5199';
  return `http://127.0.0.1:${port}/api/external-mcp/mcp`;
}
const FLAGS = ['json', 'show', 'help', 'data-dir'] as const;

function devProfileId(): string {
  const fromEnv = process.env.OPENCHATCUT_DEV_PROFILE_ID?.trim();
  if (fromEnv) return fromEnv;
  let gitDir = '';
  try {
    gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { encoding: 'utf8' }).trim();
  } catch {
    throw new CliError('Not in a corteo checkout, and OPENCHATCUT_DEV_PROFILE_ID is unset.');
  }
  const metadataPath = `${gitDir}/openchatcut-dev-profile.json`;
  try {
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as { profileId?: string };
    if (!metadata.profileId) throw new Error('missing profileId');
    return metadata.profileId;
  } catch {
    throw new CliError(
      `No dev profile at ${metadataPath}. Start the editor once (npm run claudia:local) so the MCP token file exists.`,
    );
  }
}

function tokenLocation(): { token: string; path: string } {
  const fromEnv = process.env.OPENCHATCUT_MCP_TOKEN?.trim();
  if (fromEnv) return { token: fromEnv, path: 'env:OPENCHATCUT_MCP_TOKEN' };
  const path = mcpTokenPath({ profileId: devProfileId() });
  return { token: loadOrCreateMcpToken({ profileId: devProfileId() }).token, path };
}

export async function runMcpCommand(
  positionals: readonly string[],
  commandLine: CommandLine,
  json: boolean,
): Promise<void> {
  rejectUnknownFlags(commandLine, FLAGS);
  const [subcommand] = positionals;
  if (subcommand !== 'token') {
    throw new UsageError('mcp needs a subcommand: token');
  }
  const { token, path } = tokenLocation();
  if (flagBoolean(commandLine, 'show')) {
    writeStdout(token);
    return;
  }
  if (json) {
    printJson({ path, url: mcpUrl(), localhostOnly: true });
    return;
  }
  writeStdout(path);
}
