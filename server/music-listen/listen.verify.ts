// listen_to_song is one call: a cached-or-model analysis when the packs answer,
// DSP measurements and fallback beats when they do not, a saved song map, two
// real pictures and one text result that stays under the MCP 16,000-char limit.
// Everything here is synthesized and the model packs are absent by construction,
// so the verify is deterministic on a machine that has them installed.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fixture = await mkdtemp(join(tmpdir(), 'occ-listen-'));
const previousHome = process.env.HOME;
process.env.HOME = join(fixture, 'home');
const previousDataDir = process.env.OPENCHATCUT_DATA_DIR;
process.env.OPENCHATCUT_DATA_DIR = join(fixture, 'data');
await mkdir(process.env.HOME, { recursive: true });
await mkdir(process.env.OPENCHATCUT_DATA_DIR, { recursive: true });

const { listenToSong } = await import('./listen.ts');
const { execServerMusicTool } = await import('./tool.ts');
const { loadStoredSongMap } = await import('./song-map-cache.ts');
const { MissingMusicPacksError } = await import('./runner.ts');
const { BEAT_THIS_SAMPLE_RATE } = await import('../../src/audio/intelligence/beatThisPreprocess.ts');
const { isExternalReadTool, isExternalServerDirectTool } = await import('../../src/agent/external-tool-policy.ts');
const { MUSIC_INTELLIGENCE_TOOL_SCHEMAS } = await import('../../src/agent/tools/schemas/music-intelligence-tools.ts');
const {
  LISTEN_MAX_CURVE_POINTS,
  LISTEN_TEXT_MAX_CHARS,
  buildListenSnapshot,
  normalizeListenRange,
} = await import('../../shared/music-inference/listen-snapshot.ts');
const { sourceRevisionOf } = await import('../../src/editor/mediaSourceRevision.ts');

const SONG_SECONDS = 12;
const SAMPLE_RATE = BEAT_THIS_SAMPLE_RATE;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** 120 BPM clicks over a quiet first half and a loud second half. */
function synthSong(): Float32Array {
  const total = SAMPLE_RATE * SONG_SECONDS;
  const samples = new Float32Array(total);
  let seed = 987_654_321;
  const noise = () => {
    seed = (Math.imul(1_103_515_245, seed) + 12_345) >>> 0;
    return (seed / 4_294_967_296) * 2 - 1;
  };
  const beats = SONG_SECONDS * 2;
  for (let beat = 0; beat < beats; beat += 1) {
    const start = Math.round(beat * 0.5 * SAMPLE_RATE);
    const loudness = beat < beats / 2 ? 0.35 : 0.9;
    const clickLength = Math.round(0.04 * SAMPLE_RATE);
    for (let index = 0; index < clickLength && start + index < total; index += 1) {
      const t = index / SAMPLE_RATE;
      samples[start + index]! += loudness * 0.7 * Math.exp(-t * 80) * Math.sin(2 * Math.PI * 1_200 * t);
    }
    if (beat % 4 === 0) {
      const bassLength = Math.round(0.25 * SAMPLE_RATE);
      for (let index = 0; index < bassLength && start + index < total; index += 1) {
        const t = index / SAMPLE_RATE;
        samples[start + index]! += loudness * 0.5 * Math.exp(-t * 6) * Math.sin(2 * Math.PI * 55 * t);
      }
    }
  }
  for (let index = 0; index < total; index += 1) {
    samples[index] = Math.max(-1, Math.min(1, samples[index]! + 0.01 * noise()));
  }
  return samples;
}

function wavFile(samples: Float32Array, sampleRate: number): Buffer {
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

function wordsAt(text: string, startMs: number) {
  return text.split(' ').map((word, index) => ({
    text: word,
    startMs: startMs + index * 240,
    endMs: startMs + index * 240 + 190,
  }));
}

const modelAnalysis = {
  schemaVersion: 1 as const,
  assetId: 'asset-listen',
  sourceRevision: 'rev-listen',
  createdAt: 5,
  durationMs: SONG_SECONDS * 1_000,
  modelPacks: { rhythm: 'rhythm-lite', semantic: 'music-semantics-lite' },
  bpm: 120,
  meter: 4,
  beatConfidence: 0.91,
  beatsMs: Array.from({ length: SONG_SECONDS * 2 }, (_, index) => index * 500),
  downbeatsMs: [0, 2_000, 4_000, 6_000, 8_000, 10_000],
  sections: [
    { fromMs: 0, toMs: 6_000, role: 'intro-like' as const, energy: 0.25, boundaryConfidence: 0.6 },
    {
      fromMs: 6_000,
      toMs: 12_000,
      role: 'peak' as const,
      energy: 0.9,
      boundaryConfidence: 0.7,
      mood: { kind: 'mood' as const, label: 'festive', score: 0.84 },
    },
  ],
  tags: [{ kind: 'genre' as const, label: 'pop', score: 0.7 }],
  embedding: [] as number[],
};
const transcript = [
  ...wordsAt('la noche llega', 1_000),
  ...wordsAt('otra linea distinta', 3_000),
  ...wordsAt('la noche llega', 7_000),
];
const analyzeModel = async () => modelAnalysis as never;

try {
  const songPath = join(fixture, 'song.wav');
  await writeFile(songPath, wavFile(synthSong(), SAMPLE_RATE));
  const asset = {
    id: 'asset-listen',
    kind: 'audio' as const,
    src: songPath,
    name: 'Noche de prueba',
    durationInFrames: 360,
    sourceRevision: 'rev-listen',
  };

  // 1. Policy and schema: one read-only call, no timeline edits, server-direct.
  assert.equal(isExternalReadTool('listen_to_song'), true, 'listen_to_song is read-only');
  assert.equal(isExternalServerDirectTool('listen_to_song'), true, 'listen_to_song runs without an editor tab');
  const schema = MUSIC_INTELLIGENCE_TOOL_SCHEMAS.find((tool) => tool.name === 'listen_to_song');
  assert.ok(schema, 'listen_to_song is in the music schema set');
  assert.deepEqual(
    Object.keys((schema as { input_schema: { properties: Record<string, unknown> } }).input_schema.properties).sort(),
    ['assetId', 'fromMs', 'itemId', 'pictures', 'toMs'],
    'the schema exposes the shared target, a range and the picture switch',
  );

  // 2. The model path: Spanish summary, saved map, two PNGs, bounded text.
  const model = await listenToSong(asset as never, {
    analyze: analyzeModel,
    transcriptWords: transcript,
  }) as Record<string, unknown>;
  assert.equal(model.ok, true);
  assert.equal(model.source, 'model');
  assert.equal(model.assetName, 'Noche de prueba');
  assert.equal(model.bpm, 120);
  assert.equal(model.meter, 4);
  assert.equal(model.sectionCount, 2);
  assert.deepEqual(
    (model.sections as Array<Record<string, unknown>>).map((section) => section.roleEs),
    ['intro', 'clímax'],
    'section roles are listed in Spanish',
  );
  assert.deepEqual(
    (model.sections as Array<Record<string, unknown>>).map((section) => section.mood ?? null),
    [null, 'festiva'],
    'the peak keeps its Spanish mood',
  );
  const summary = String(model.summary);
  for (const expected of [
    'Canción: «Noche de prueba» · 0:12',
    'Tempo: 120 BPM · compás 4/4 · confianza 0.91',
    'Secciones (2): 0:00–0:06 intro 25%',
    '0:06–0:12 clímax 90%, festiva',
    'Energía: media',
    'Pulso: 24 pulsos y 6 compases',
    'Letra: 3 líneas · 1 estribillo · «la noche llega»',
  ]) {
    assert.ok(summary.includes(expected), `summary must mention "${expected}"\n${summary}`);
  }
  assert.ok(typeof model.songMapRef === 'string' && model.songMapRef.startsWith('song-map:'), 'model maps are saved');
  assert.equal(model.lyrics instanceof Object && (model.lyrics as { source: string }).source, 'transcript');
  const curves = model.curves as { stepMs: number; energy: number[]; bass: number[] } | null;
  assert.ok(curves && curves.energy.length >= 10, 'DSP curves accompany the model analysis');
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const half = Math.floor(curves.energy.length / 2);
  assert.ok(
    mean(curves.energy.slice(half)) > mean(curves.energy.slice(0, half)) * 1.5,
    `the loud second half shows in the energy curve: ${curves.energy.join(',')}`,
  );

  const images = model.__images as Array<{ frame: number; mimeType: string; base64: string }>;
  assert.equal(images.length, 2, 'song map and spectrogram');
  for (const image of images) {
    assert.equal(image.frame, 0);
    assert.equal(image.mimeType, 'image/png', 'MCP must not relabel our PNGs as JPEG');
    const png = Buffer.from(image.base64, 'base64');
    assert.equal(png.subarray(0, 8).compare(PNG_SIGNATURE), 0, 'real PNG bytes');
    assert.ok(png.length > 10_000, `picture is not a flat colour, got ${png.length} bytes`);
  }
  assert.deepEqual(model.pictures, { map: true, spectrogram: true });

  const { __images: modelImages, ...modelText } = model;
  assert.ok(modelImages.length === 2);
  const modelChars = JSON.stringify(modelText).length;
  assert.ok(modelChars < 16_000, `text result stays under the MCP limit, got ${modelChars}`);
  assert.ok(modelChars <= LISTEN_TEXT_MAX_CHARS + 100, `snapshot ceiling holds, got ${modelChars}`);

  const storedMap = await loadStoredSongMap(asset.id, sourceRevisionOf(asset));
  assert.ok(storedMap, 'the model map is readable from the shared cache');
  assert.equal(storedMap.lines.length, 3);
  assert.equal(storedMap.chorusGroups.length, 1);
  assert.deepEqual(storedMap.chorusGroups[0]!.lineIndexes, [0, 2], 'the repeated line is the chorus');

  // 3. A range filters beats, lines and sections together.
  const ranged = await listenToSong(asset as never, {
    analyze: analyzeModel,
    transcriptWords: transcript,
    fromMs: 6_000,
    toMs: 12_000,
    pictures: false,
  }) as Record<string, unknown>;
  assert.deepEqual(ranged.range, { fromMs: 6_000, toMs: 12_000 });
  assert.equal(ranged.sectionCount, 1, 'only the overlapping second section');
  assert.equal((ranged.sections as Array<Record<string, unknown>>)[0]!.fromMs, 6_000);
  assert.equal(ranged.beatCount, 12);
  assert.equal((ranged.lyrics as { lineCount: number }).lineCount, 1);
  assert.equal('__images' in ranged, false, 'pictures:false sends no images');
  assert.deepEqual(ranged.pictures, { map: false, spectrogram: false });
  assert.ok(String(ranged.summary).includes('tramo 0:06–0:12'), 'the summary names the cropped range');
  assert.ok(String(ranged.summary).includes('Sin imágenes en esta respuesta.'));

  assert.throws(
    () => normalizeListenRange(12_000, 12_000, 12_000),
    /toMs must be greater than fromMs/,
    'an empty range is rejected instead of answering with nothing',
  );
  assert.deepEqual(normalizeListenRange(-5, undefined, 12_000), { fromMs: 0, toMs: 12_000 });
  assert.deepEqual(normalizeListenRange(undefined, 99_000, 12_000), { fromMs: 0, toMs: 12_000 });

  // 4. No packs, no file: the call explains what failed instead of answering empty.
  const missingAsset = { ...asset, id: 'asset-listen-missing', src: '/media/uploads/absent-listen.wav' };
  await assert.rejects(
    listenToSong(missingAsset as never, {
      analyze: async () => {
        throw new MissingMusicPacksError([
          { id: 'rhythm-lite', status: 'absent' },
          { id: 'music-semantics-lite', status: 'absent' },
        ]);
      },
    }),
    /no se pudo escuchar el audio/,
  );

  // 5. Over the server tool with no editor tab and no packs: DSP beats, energy
  //    sections, the same two pictures and an honest note about the packs.
  const notes: string[] = [];
  const ctx = {
    getState: () => ({ items: [], fps: 30 }),
    getDoc: () => ({ assets: [asset] }),
    onToolProgress: (note: string) => notes.push(note),
  };
  const fallback = await execServerMusicTool('listen_to_song', { assetId: asset.id }, ctx as never) as Record<string, unknown>;
  assert.equal(fallback.ok, true);
  assert.equal(fallback.source, 'dsp');
  assert.match(String(fallback.note), /Faltan los paquetes de modelos \(rhythm-lite, music-semantics-lite\)/);
  const fallbackBpm = Number(fallback.bpm);
  assert.ok(fallbackBpm >= 114 && fallbackBpm <= 126, `fallback pulse near 120 BPM, got ${fallbackBpm}`);
  assert.ok(Number(fallback.beatCount) >= 20, `fallback beats, got ${fallback.beatCount}`);
  assert.ok(Number(fallback.downbeatCount) >= 1, 'fallback downbeats');
  assert.ok(Number(fallback.sectionCount) >= 1, 'fallback sections');
  assert.ok(Number(fallback.onsetCount) >= 20, 'onsets survive without the model');
  assert.ok(fallback.moments instanceof Array && fallback.moments.length >= 1, 'the quiet-to-loud step is a moment');
  assert.equal(fallback.songMapRef, null, 'a DSP map is not cached');
  const fallbackCurves = fallback.curves as { stepMs: number; energy: number[] } | null;
  assert.ok(
    fallbackCurves && fallbackCurves.stepMs === 1_000 && fallbackCurves.energy.length === SONG_SECONDS,
    'curves come from the DSP measurements at one point per second',
  );
  assert.deepEqual(fallback.pictures, { map: true, spectrogram: true });
  assert.equal((fallback.__images as unknown[]).length, 2);
  assert.ok(String(fallback.summary).includes('estimaciones DSP'));
  assert.ok(String(fallback.summary).includes('Mapa de la canción solo en memoria'));
  for (const phase of ['modelo', 'medidas', 'mapa', 'espectrograma', 'listo']) {
    assert.ok(
      notes.some((note) => note.startsWith(`escuchando: ${phase}`)),
      `progress reports ${phase}: ${notes.join(' | ')}`,
    );
  }

  // 6. The text half alone cannot exceed the limit: a 20-minute, 500-line song
  //    still shrinks to a compact answer instead of a rejected MCP result.
  const frames = Array.from({ length: 2_400 }, (_, index) => ({
    timeMs: index * 500,
    rms: 0.4,
    bass: 0.5,
    mid: 0.3,
    brightness: 0.2,
    centroid: 900,
  }));
  const long = buildListenSnapshot({
    assetName: 'Canción larga de prueba',
    durationMs: 20 * 60_000,
    range: normalizeListenRange(undefined, undefined, 20 * 60_000),
    analysisSource: 'dsp',
    analysisNote: 'estimaciones DSP',
    bpm: 120,
    sections: Array.from({ length: 24 }, (_, index) => ({
      fromMs: index * 50_000,
      toMs: (index + 1) * 50_000,
      role: (['intro-like', 'build', 'peak', 'break', 'steady', 'outro-like'] as const)[index % 6]!,
      energy: 0.5,
      mood: { kind: 'mood' as const, label: 'festive', score: 0.8 },
    })),
    beatsMs: Array.from({ length: 2_400 }, (_, index) => index * 500),
    downbeatsMs: Array.from({ length: 600 }, (_, index) => index * 2_000),
    measurements: {
      frames,
      onsets: [],
      accents: Array.from({ length: 64 }, (_, index) => ({ timeMs: index * 15_000, strength: 0.6 })),
      moments: Array.from({ length: 64 }, (_, index) => ({
        kind: index % 2 ? 'drop' as const : 'break' as const,
        timeMs: index * 15_000,
        strength: 0.7,
      })),
      key: { tonic: 'A', mode: 'minor' as const, confidence: 0.8 },
    },
    songMap: {
      lyricsSource: 'transcript',
      lines: Array.from({ length: 500 }, (_, index) => ({
        text: `línea número ${index} con palabras suficientes para ocupar espacio`,
        startMs: index * 2_000,
        endMs: index * 2_000 + 1_800,
      })),
      chorusGroups: Array.from({ length: 20 }, (_, index) => ({
        index: index + 1,
        text: `estribillo ${index}`,
        lineIndexes: [index * 2, index * 2 + 1],
      })),
    },
    songMapRef: null,
  });
  const longChars = JSON.stringify(long).length;
  assert.ok(longChars <= LISTEN_TEXT_MAX_CHARS, `20-minute snapshot is ${longChars} chars`);
  assert.ok(longChars < 16_000);
  const longLyrics = long.data.lyrics as { lineCount: number; lines: unknown[] };
  assert.equal(longLyrics.lineCount, 500, 'the count stays honest after the listing shrinks');
  assert.ok(longLyrics.lines.length <= 40, `lyric lines are capped, got ${longLyrics.lines.length}`);
  assert.ok(
    (long.data.curves as { energy: number[] }).energy.length <= LISTEN_MAX_CURVE_POINTS,
    'the curve is capped, not sent point by point',
  );
  assert.equal(long.data.sectionCount, 24, 'the section count stays honest');
  assert.ok((long.data.sections as unknown[]).length <= 24, 'the section listing is capped');

  console.log(`listen.verify: model ${modelChars} chars, fallback ${fallbackBpm} BPM, long song ${longChars} chars`);
} finally {
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;
  if (previousDataDir === undefined) delete process.env.OPENCHATCUT_DATA_DIR;
  else process.env.OPENCHATCUT_DATA_DIR = previousDataDir;
}
