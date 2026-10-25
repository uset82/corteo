// Pixel check for a rendered frame. cover: top and bottom 5% are picture.
// blur: those rows are blurred picture. black: those rows are black, not the
// preview checkerboard (rgb 36,36,36 / 28,28,28).
import { execFileSync } from 'node:child_process';

const file = process.argv[2];
const mode = process.argv[3];
if (!file || !['cover', 'blur', 'black'].includes(mode)) {
  process.stderr.write('usage: frame-bars.mjs <video> <cover|blur|black>\n');
  process.exit(2);
}

const size = execFileSync('ffprobe', [
  '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file,
], { encoding: 'utf8' }).trim().replace(/,+$/, '');
const [width, height] = size.split(',').map((part) => Number(part));
if (!width || !height) {
  process.stderr.write(`bad size ${size}\n`);
  process.exit(1);
}
const buf = execFileSync('ffmpeg', [
  '-v', 'error', '-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1',
], { maxBuffer: 32 * 1024 * 1024 });
if (buf.length < width * height * 3) {
  process.stderr.write(`short frame ${buf.length} for ${width}x${height}\n`);
  process.exit(1);
}

function band(y0, y1) {
  let count = 0;
  let sum = 0;
  let peak = 0;
  let checker = 0;
  const colors = new Set();
  for (let y = y0; y < y1; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 3;
      const r = buf[index];
      const g = buf[index + 1];
      const b = buf[index + 2];
      peak = Math.max(peak, r, g, b);
      sum += r + g + b;
      count += 1;
      colors.add((r << 16) | (g << 8) | b);
      const near = (value, target) => Math.abs(value - target) <= 3;
      if ((near(r, 36) && near(g, 36) && near(b, 36)) || (near(r, 28) && near(g, 28) && near(b, 28))) checker += 1;
    }
  }
  return {
    unique: colors.size,
    max: peak,
    mean: Number((sum / (count * 3)).toFixed(2)),
    checker: Number((checker / count).toFixed(4)),
  };
}

const rows = Math.max(1, Math.floor(height * 0.05));
const top = band(0, rows);
const bottom = band(height - rows, height);
const report = { mode, width, height, rows, top, bottom };
process.stdout.write(`${JSON.stringify(report)}\n`);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

for (const [name, stats] of [['top', top], ['bottom', bottom]]) {
  if (mode === 'cover' && (stats.unique < 8 || stats.max < 40 || stats.checker > 0.05)) {
    fail(`${name} is not a filled picture`);
  }
  if (mode === 'blur' && (stats.mean < 12 || stats.max < 24 || stats.unique < 4 || stats.checker > 0.05)) {
    fail(`${name} is not blurred picture`);
  }
  if (mode === 'black' && (stats.max > 24 || stats.checker > 0.02)) {
    fail(`${name} is not a black bar`);
  }
}
