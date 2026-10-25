// P-CL-14. A 16:9 clip in a 1080x1920 project: cover fills the frame, contain
// renders black bars (not the checkerboard), contain+blur paints blurred picture.
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(join(tmpdir(), 'corteo-vertical-fit-'));
const store = join(work, 'library');
const env = {
  ...process.env,
  OPENCHATCUT_DATA_DIR: store,
  OPENCHATCUT_PROVIDERS: 'off',
  CC_RENDER_GL: 'swangle',
  OPENCHATCUT_RENDER_CONCURRENCY: '1',
};
delete env.OPENCHATCUT_DEV_PROFILE_ID;
delete env.CORTEO_STORE_DIR;
delete env.CORTEO_PORT;

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status || 1);
  }
  if (command === 'node') process.stdout.write(result.stdout || '');
  return result.stdout;
}

function corteo(args) {
  return run('npm', ['run', '--silent', 'corteo', '--', ...args]);
}

run('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-f', 'lavfi', '-i', "color=c=black:s=1920x1080:r=30:d=1,geq=r='X/8':g='Y/4':b=128",
  '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(work, 'wide.mp4'),
]);
corteo(['project', 'new', 'Vertical fit', '--size', '1080x1920', '--fps', '30', '--json']);
const imported = JSON.parse(corteo(['media', 'import', join(work, 'wide.mp4'), '--apply', '--json']));
const assetId = imported.ops[0].result.imported[0].id;
const placed = JSON.parse(corteo([
  'tools', 'call', 'edit_item',
  '--args', JSON.stringify({ adds: [{ type: 'video', assetId, fromFrame: 0, durationInFrames: 8 }] }),
  '--apply', '--json',
]));
const itemId = placed.ops[0].result.results[0].placed.itemId;

function render(name, mode) {
  const out = join(work, `${name}.mp4`);
  corteo(['render', '--out', out, '--to', '5', '--resolution', '1080p', '--quiet']);
  run('node', [join(root, 'remotion/frame-bars.mjs'), out, mode]);
}

corteo(['item', 'fit', itemId, '--mode', 'cover', '--apply', '--json']);
render('cover', 'cover');
corteo(['item', 'fit', itemId, '--mode', 'contain', '--apply', '--json']);
render('black', 'black');
corteo(['item', 'fit', itemId, '--mode', 'contain', '--background', 'blur', '--apply', '--json']);
render('blur', 'blur');
process.stdout.write('vertical-fit.verify: cover, black bars, and blur pass\n');
