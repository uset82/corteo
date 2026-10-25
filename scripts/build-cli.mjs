// Bundle the occ CLI into a single runnable ESM file with a node shebang, so it
// can be linked (`npm link`, or `bin` on install) instead of only running through
// tsx from a checkout.
//
// packages: 'external' keeps node_modules out of the bundle: @remotion/renderer,
// @modelcontextprotocol/sdk, ffmpeg-static and friends carry native binaries and
// resolved paths that must stay real files on disk — the same reasoning as the
// desktop main build (scripts/…/build-desktop-main inside package.json).
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = resolve(root, 'cli-dist/occ.mjs');
const workerOutfile = resolve(root, 'cli-dist/inference-worker.mjs');

await mkdir(dirname(outfile), { recursive: true });
await build({
  entryPoints: [resolve(root, 'cli/main.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
  banner: { js: '#!/usr/bin/env node' },
});
// analyze_music spawns this worker from beside the CLI bundle
// (server/music-listen/inference.ts).
await build({
  entryPoints: [resolve(root, 'server/music-listen/inference-worker.ts')],
  outfile: workerOutfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
});
process.stdout.write(`[build:cli] ${outfile}\n`);
process.stdout.write(`[build:cli] ${workerOutfile}\n`);
