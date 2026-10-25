// Runs the named Cloudflare Tunnel that the Worker fetches.
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function tunnelArgs(configPath) {
  return ['tunnel', '--config', configPath, 'run'];
}

const entryPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entryPath) {
  const configPath = fileURLToPath(new URL('../cloudflare/tunnel.yml', import.meta.url));
  const child = spawn('cloudflared', tunnelArgs(configPath), { stdio: 'inherit' });
  child.once('error', (error) => {
    const missing = error && error.code === 'ENOENT';
    process.stderr.write(missing
      ? 'No encontré cloudflared. Instálalo desde https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ y vuelve a ejecutar npm run tunnel.\n'
      : `cloudflared falló: ${error.message}\n`);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    if (signal) process.exitCode = 1;
    else process.exitCode = code ?? 1;
  });
}
