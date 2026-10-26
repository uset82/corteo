// A seeing model reads two pictures: a drawn map and an ffmpeg spectrogram.
// This verify generates both from one synthetic song and proves they are real
// images — right size, real pixel variance — with the mm:ss axis and the
// Spanish labels the prompt promises.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const { buildSongMap } = await import('../../src/audio/listen/songMap.ts');
const { measureSong } = await import('../../src/audio/listen/index.ts');
const {
  MAP_HEIGHT,
  MAP_WIDTH,
  SPECTROGRAM_HEIGHT,
  SPECTROGRAM_WIDTH,
  buildSongMapSvg,
  buildSpectrogramArgs,
  escapeXml,
  formatClock,
  renderSongMapPng,
  renderSpectrogramPng,
} = await import('./pictures.ts');

const SAMPLE_RATE = 22_050;
const SONG_SECONDS = 30;
const TOTAL_SAMPLES = SAMPLE_RATE * SONG_SECONDS;

/** A sweep with a pulsing bass and a deterministic hiss so the spectrogram has real structure. */
function synthSong(): Float32Array {
  const samples = new Float32Array(TOTAL_SAMPLES);
  let seed = 123_456_789;
  const noise = () => {
    seed = (Math.imul(1_103_515_245, seed) + 12_345) >>> 0;
    return (seed / 4_294_967_296) * 2 - 1;
  };
  for (let index = 0; index < TOTAL_SAMPLES; index += 1) {
    const seconds = index / SAMPLE_RATE;
    const sweepHz = 100 * 30 ** (seconds / SONG_SECONDS);
    const sweep = 0.32 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.25 * seconds)) * Math.sin(2 * Math.PI * sweepHz * seconds);
    const pulse = Math.sin(2 * Math.PI * 2 * seconds) > 0.6 ? 0.28 * Math.sin(2 * Math.PI * 55 * seconds) : 0;
    samples[index] = Math.max(-1, Math.min(1, sweep + pulse + 0.02 * noise()));
  }
  return samples;
}

function wavBuffer(samples: Float32Array, sampleRate: number): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  for (let index = 0; index < samples.length; index += 1) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[index]!)) * 32_767), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface PngSize {
  readonly width?: number;
  readonly height?: number;
  readonly minWidth?: number;
  readonly minHeight?: number;
}

async function pngFacts(png: Buffer, size: PngSize, label: string) {
  assert.equal(png.subarray(0, 8).compare(PNG_SIGNATURE), 0, `${label}: PNG signature`);
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.format, 'png', `${label}: format`);
  if (size.width !== undefined) assert.equal(metadata.width, size.width, `${label}: width`);
  if (size.height !== undefined) assert.equal(metadata.height, size.height, `${label}: height`);
  if (size.minWidth !== undefined) {
    assert.ok((metadata.width ?? 0) >= size.minWidth, `${label}: at least ${size.minWidth}px wide, got ${metadata.width}`);
  }
  if (size.minHeight !== undefined) {
    assert.ok((metadata.height ?? 0) >= size.minHeight, `${label}: at least ${size.minHeight}px tall, got ${metadata.height}`);
  }
  const stats = await sharp(png).stats();
  const rgb = stats.channels.slice(0, 3);
  const contrast = rgb.map((channel) => channel.max - channel.min);
  assert.ok(
    contrast.every((range) => range > 40),
    `${label}: every channel must carry real contrast, got ${contrast.join(', ')}`,
  );
  assert.ok(
    Math.max(...rgb.map((channel) => channel.stdev)) > 5,
    `${label}: pixel variance must clear a blank image`,
  );
  return { contrast, stdev: rgb.map((channel) => channel.stdev) };
}

const analysis = {
  schemaVersion: 1 as const,
  assetId: 'asset-pictures',
  sourceRevision: 'rev-pictures',
  createdAt: 1,
  durationMs: SONG_SECONDS * 1_000,
  modelPacks: { rhythm: 'rhythm', semantic: 'semantic' },
  bpm: 120,
  meter: 4,
  beatConfidence: 0.9,
  beatsMs: Array.from({ length: 60 }, (_, index) => index * 500),
  downbeatsMs: Array.from({ length: 15 }, (_, index) => index * 2_000),
  sections: [
    { fromMs: 0, toMs: 10_000, role: 'intro-like' as const, energy: 0.2, boundaryConfidence: 0.5 },
    {
      fromMs: 10_000,
      toMs: 20_000,
      role: 'peak' as const,
      energy: 0.9,
      boundaryConfidence: 0.6,
      mood: { kind: 'mood' as const, label: 'festive', score: 0.82 },
    },
    { fromMs: 20_000, toMs: 30_000, role: 'outro-like' as const, energy: 0.35, boundaryConfidence: 0.4 },
  ],
  tags: [],
  embedding: new Array(512).fill(0),
};

function wordsAt(text: string, startMs: number) {
  return text.split(' ').map((word, index) => ({
    text: word,
    startMs: startMs + index * 220,
    endMs: startMs + index * 220 + 180,
  }));
}

const songMap = buildSongMap({
  analysis,
  transcriptWords: [
    ...wordsAt('Rock & Roll en la noche.', 1_000),
    ...wordsAt('un coro distinto.', 6_000),
    ...wordsAt('otra linea final.', 11_000),
    ...wordsAt('Rock & Roll en la noche.', 21_000),
  ],
  createdAt: 7,
});
assert.equal(songMap.lines.length, 4, 'four display lines');
assert.equal(songMap.chorusGroups.length, 1, 'the repeated line is one chorus candidate');
assert.deepEqual(songMap.chorusGroups[0]!.lineIndexes, [0, 3]);

// 1. Pure SVG: the axis, the Spanish section labels and the escaping are all text.
const svg = buildSongMapSvg({
  analysis,
  songMap,
  measurements: {
    frames: [{ timeMs: 0, rms: 0.1, bass: 0.2, mid: 0.1, brightness: 0.1, centroid: 500 }],
    moments: [
      { kind: 'drop', timeMs: 15_000, strength: 0.9 },
      { kind: 'break', timeMs: 5_000, strength: 0.5 },
    ],
  },
});
for (const tick of ['>0:00<', '>0:15<', '>0:30<']) {
  assert.ok(svg.includes(tick), `the axis shows ${tick.slice(1, -1)}`);
}
assert.ok(svg.includes('>intro<'), 'intro label');
assert.ok(svg.includes('>clímax · festiva<'), 'peak role and its Spanish mood');
assert.ok(svg.includes('>salida<'), 'outro label');
assert.ok(svg.includes('90%'), 'peak energy percentage');
assert.ok(svg.includes('>onda<') && svg.includes('>energía<') && svg.includes('>graves<'), 'curve labels');
assert.ok(svg.includes('>drop<') && svg.includes('stroke-dasharray="6 4"'), 'drop line');
assert.ok(svg.includes('>break<'), 'other moments are labelled');
assert.ok((svg.match(/<polyline /g) ?? []).length >= 3, 'waveform, energy and bass are polylines');
assert.ok(svg.includes('0:01  · Rock &amp; Roll en la noche.'), 'chorus line one at mm:ss');
assert.ok(svg.includes('0:21  · Rock &amp; Roll en la noche.'), 'chorus line two at mm:ss');
assert.ok(!svg.includes('sin letra transcrita'), 'a transcribed song has no empty-lyrics note');
assert.ok(svg.includes('>0:30<') && svg.includes('font-size="14"'), 'duration in the header');

const titled = buildSongMapSvg({ analysis, songMap, title: 'Rock & Roll — Mapa' });
assert.ok(titled.includes('Rock &amp; Roll — Mapa'), 'titles are XML-escaped');

const wordless = buildSongMapSvg({ analysis, songMap: { lines: [], sections: songMap.sections } });
assert.ok(wordless.includes('sin letra transcrita'), 'an empty map says so instead of drawing nothing');

// 2. Clock and escaping helpers are what the labels rely on.
assert.equal(formatClock(0), '0:00');
assert.equal(formatClock(59_999), '0:59');
assert.equal(formatClock(60_000), '1:00');
assert.equal(formatClock(65_400), '1:05');
assert.equal(formatClock(-5), '0:00');
assert.equal(formatClock(Number.NaN), '0:00');
assert.equal(
  escapeXml(`a & b < c > "d" 'e'`),
  'a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;',
);

// 3. The real song: measure it, draw the map, and prove the PNG has pixels.
const fixture = await mkdtemp(join(tmpdir(), 'occ-pictures-'));
const samples = synthSong();
const wavPath = join(fixture, 'song.wav');
await writeFile(wavPath, wavBuffer(samples, SAMPLE_RATE));
const measurements = measureSong(samples, SAMPLE_RATE);
assert.ok(measurements.frames.length >= SONG_SECONDS * 15, 'at least 15 frames per second');

const mapPng = await renderSongMapPng({ analysis, songMap, measurements });
const mapFacts = await pngFacts(mapPng, { width: MAP_WIDTH, height: MAP_HEIGHT }, 'song map');
assert.ok(mapPng.length > 20_000, `a drawn map is not a flat colour, got ${mapPng.length} bytes`);

// 4. ffmpeg draws the spectrogram from the same file, legend and axis included.
const args = buildSpectrogramArgs('/tmp/in.wav', '/tmp/out.png');
assert.ok(
  args.includes(`showspectrumpic=s=${SPECTROGRAM_WIDTH}x${SPECTROGRAM_HEIGHT}:legend=1:scale=log:color=intensity`),
  'spectrogram filter exposes the time axis and the dB legend',
);
assert.deepEqual(args.slice(0, 5), ['-v', 'error', '-nostdin', '-y', '-i']);
assert.deepEqual(args.slice(-3), ['-frames:v', '1', '/tmp/out.png']);

const spectrogramPng = await renderSpectrogramPng(wavPath);
const spectrogramFacts = await pngFacts(
  spectrogramPng,
  { minWidth: SPECTROGRAM_WIDTH, minHeight: SPECTROGRAM_HEIGHT },
  'spectrogram',
);
const spectrogramMeta = await sharp(spectrogramPng).metadata();
assert.ok(
  (spectrogramMeta.width ?? 0) > SPECTROGRAM_WIDTH,
  `the time axis and dB legend widen the plot past ${SPECTROGRAM_WIDTH}px, got ${spectrogramMeta.width}`,
);
assert.ok(spectrogramPng.length > 10_000, `a spectrogram is not a flat colour, got ${spectrogramPng.length} bytes`);

await assert.rejects(renderSpectrogramPng(''), /local audio path/);
await assert.rejects(
  renderSpectrogramPng(join(fixture, 'missing.wav'), { timeoutMs: 20_000 }),
  /ffmpeg exited with code/,
  'a missing file is reported, not silently drawn',
);

console.log(
  `pictures.verify: ${MAP_WIDTH}x${MAP_HEIGHT} map (channels ±${mapFacts.contrast.join(', ')}, σ ${mapFacts.stdev.map((value) => value.toFixed(1)).join(', ')}) and `
  + `${SPECTROGRAM_WIDTH}x${SPECTROGRAM_HEIGHT} spectrogram (channels ±${spectrogramFacts.contrast.join(', ')}, σ ${spectrogramFacts.stdev.map((value) => value.toFixed(1)).join(', ')}) `
  + 'both non-blank with the mm:ss axis',
);
