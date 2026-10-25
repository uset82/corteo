// Claudia's own Linux VM. The editor and its MCP server listen on 127.0.0.1 only.
// Paid providers stay off unless the environment already says otherwise.
// The Cloudflare tunnel and the public Worker are not started here.
import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (!Number.isFinite(nodeMajor) || nodeMajor < 24) {
  process.stderr.write(
    `[corteo] Node ${process.versions.node} is too old. corteo needs Node 24.\n`
    + 'A fresh shell may still have Node 20 as `node` and NPM_CONFIG_PREFIX set.\n'
    + 'Run ~/corteo/scripts/corteo or npm run claudia:local (that script selects Node 24).\n',
  );
  process.exit(1);
}

if (!process.env.OPENCHATCUT_PROVIDERS) process.env.OPENCHATCUT_PROVIDERS = 'off';
if (!process.env.OPENCHATCUT_DEV_HEAP_MB) process.env.OPENCHATCUT_DEV_HEAP_MB = '6144';
if (!process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING) process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING = 'true';

const requestedPort = (process.env.CORTEO_PORT ?? '').trim();
if (requestedPort && !/^[1-9]\d{1,4}$/.test(requestedPort)) {
  process.stderr.write(`[corteo] CORTEO_PORT must be a port number (got ${requestedPort})\n`);
  process.exit(1);
}
const listenPort = requestedPort || '5199';
if (process.env.CORTEO_STORE_DIR && !process.env.OPENCHATCUT_DATA_DIR) {
  if (!isAbsolute(process.env.CORTEO_STORE_DIR)) {
    process.stderr.write('[corteo] CORTEO_STORE_DIR must be an absolute path\n');
    process.exit(1);
  }
  process.env.OPENCHATCUT_DATA_DIR = process.env.CORTEO_STORE_DIR;
}

process.stdout.write([
  'Claudia local',
  `  editor and MCP: http://127.0.0.1:${listenPort}/api/external-mcp/mcp`,
  `  providers: ${process.env.OPENCHATCUT_PROVIDERS}`,
  '  shell: npm run corteo -- project list',
  '  The public tunnel (npm run tunnel, wrangler deploy) is optional and is not used.',
  '',
].join('\n'));

const child = spawn(process.execPath, [
  fileURLToPath(new URL('./dev-profile.mjs', import.meta.url)),
  '--host',
  '127.0.0.1',
  ...(requestedPort ? ['--port', requestedPort] : []),
], {
  stdio: 'inherit',
  env: process.env,
});
child.once('error', (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
