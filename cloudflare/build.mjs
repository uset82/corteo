// Build the editor UI for Cloudflare Workers Static Assets.
// `npm run build` is the wrong command here: its prebuild downloads the native
// whisper server, and Workers Builds invokes this from `npx wrangler deploy`
// with dependencies not yet installed.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const dist = join(root, 'dist');
const assetLimit = 25 * 1024 * 1024;
// Workers Builds installs from package-lock.json before the deploy command runs.
const skipInstall = process.argv.includes('--skip-install')
  || existsSync(join(root, 'node_modules', 'vite', 'package.json'));

const run = (command, args, env) => {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
};

if (!skipInstall) {
  // NODE_ENV=production would omit Vite, which is a devDependency.
  run('npm', ['ci', '--include=dev'], {
    ...process.env,
    CI: '1',
    ELECTRON_SKIP_BINARY_DOWNLOAD: '1',
    NODE_ENV: 'development',
  });
}

run('node', ['scripts/sync-mediapipe.mjs'], process.env);
run('npx', ['vite', 'build', '--config', 'config/vite.config.ts'], {
  ...process.env,
  NODE_ENV: 'production',
});

// Native whisper-cli binaries are a server download, not part of the browser app.
await rm(join(dist, 'whisper-cli'), { recursive: true, force: true });

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (!entry.isFile()) continue;
    const size = (await stat(path)).size;
    if (size < assetLimit) continue;
    const rel = relative(root, path);
    if (!path.endsWith('.wasm')) {
      throw new Error(`${rel} is ${size} bytes, over the Workers 25 MiB asset limit`);
    }
    const compressed = gzipSync(await readFile(path), { level: 9 });
    if (compressed.length >= assetLimit) {
      throw new Error(`${rel} is ${compressed.length} bytes after gzip, still over 25 MiB`);
    }
    await writeFile(`${path}.gz`, compressed);
    await rm(path);
    process.stdout.write(`[cloudflare] gzipped ${rel}: ${size} -> ${compressed.length}\n`);
  }
};

await walk(dist);

await writeFile(join(dist, '_headers'), `/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: credentialless
  X-Content-Type-Options: nosniff
`);

const index = await stat(join(dist, 'index.html')).catch(() => null);
if (!index?.isFile()) throw new Error('vite build did not write dist/index.html');
process.stdout.write('[cloudflare] dist is ready\n');
