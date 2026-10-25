// Exercises the headless music runner without model packs: ffmpeg decode of a
// generated WAV, the injected fake core, the shared cache record in SQLite, and
// the server-direct tools that MCP clients call with no editor tab open.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const fixture = await mkdtemp(join(tmpdir(), 'occ-music-listen-'));
const previousDataDir = process.env.OPENCHATCUT_DATA_DIR;
process.env.OPENCHATCUT_DATA_DIR = join(fixture, 'data');
await mkdir(process.env.OPENCHATCUT_DATA_DIR, { recursive: true });

// The project store captures its SQLite path at import time; keep it isolated.
const { getStoredEntry, setStoredEntry } = await import('../plugins/project-store.ts');
const { decodeAudioFile } = await import('./decode.ts');
const { resolveMusicMediaPath } = await import('./media-path.ts');
const { inspectMusicPacks } = await import('./packs.ts');
const { analyzeServerMusicAsset, MissingMusicPacksError } = await import('./runner.ts');
const { loadStoredMusicAnalysis, saveStoredMusicAnalysis } = await import('./cache.ts');
const { musicInferenceWorkerPath } = await import('./inference.ts');
const { execServerMusicTool } = await import('./tool.ts');
const { isExternalServerDirectTool } = await import('../../src/agent/external-tool-policy.ts');
const { MUSIC_INTELLIGENCE_TOOL_SCHEMAS } = await import('../../src/agent/tools/schemas/music-intelligence-tools.ts');
const { inspectMusicAnalysis } = await import('../../src/audio/intelligence/inspect.ts');
const { BEAT_THIS_SAMPLE_RATE } = await import('../../src/audio/intelligence/beatThisPreprocess.ts');
const { modelPackDefinition } = await import('../../shared/model-packs/catalog.ts');
const {
  musicAnalysisCacheKey,
  musicAnalysisRemoteKey,
} = await import('../../shared/music-inference/analysis-record.ts');
const {
  sourceWindowStarts,
  CLAP_WINDOW_SECONDS,
} = await import('../../shared/music-inference/clapWindows.ts');
const { CLAP_INFERENCE_CONTRACT } = await import('../../shared/vector-inference-contract.ts');

const SONG_SECONDS = 4;

function wavFile(sampleRate: number, seconds: number, frequency = 440): Buffer {
  const samples = Math.round(sampleRate * seconds);
  const data = Buffer.alloc(samples * 2);
  for (let index = 0; index < samples; index += 1) {
    data.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 0.5 * 32767),
      index * 2,
    );
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

function near(actual: number, expected: number, tolerance: number, label: string): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, got ${actual}`,
  );
}

/** Common asset identity for every verify asset below. */
function assetOf(id: string, src: string, name: string) {
  return {
    id,
    kind: 'audio' as const,
    src,
    name,
    durationInFrames: 120,
    sourceRevision: `rev-${id}`,
  };
}

try {
  const mediaDir = join(fixture, 'uploads');
  const cacheDir = join(fixture, 'packs');
  await mkdir(mediaDir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });
  const songPath = join(mediaDir, 'song.wav');
  await writeFile(songPath, wavFile(BEAT_THIS_SAMPLE_RATE, SONG_SECONDS));

  // 1. Media resolution mirrors the upload route the desktop and MCP share.
  assert.equal(resolveMusicMediaPath('/media/uploads/song.wav', { mediaDir }), songPath);
  assert.equal(resolveMusicMediaPath(songPath), songPath);
  assert.equal(resolveMusicMediaPath('/media/uploads/nope.wav', { mediaDir }), undefined);
  assert.equal(resolveMusicMediaPath('relative/song.wav', { mediaDir }), undefined);

  // 2. ffmpeg decodes mono float PCM at both rates.
  const rhythmPcm = await decodeAudioFile(songPath, BEAT_THIS_SAMPLE_RATE);
  near(rhythmPcm.length, SONG_SECONDS * BEAT_THIS_SAMPLE_RATE, BEAT_THIS_SAMPLE_RATE * 0.05, 'rhythm decode length');
  assert.ok(rhythmPcm.some((sample) => Number.isFinite(sample) && sample !== 0), 'decoded audio must not be silent');
  const windowPcm = await decodeAudioFile(songPath, CLAP_INFERENCE_CONTRACT.sampleRate, {
    startSeconds: 0,
    durationSeconds: 1,
    maxSeconds: 2,
  });
  near(windowPcm.length, CLAP_INFERENCE_CONTRACT.sampleRate, CLAP_INFERENCE_CONTRACT.sampleRate * 0.05, 'window decode length');

  // 3. Pack discovery only checks presence and byte size.
  const absent = await inspectMusicPacks(cacheDir);
  assert.equal(absent.installed, false);
  assert.deepEqual(absent.missing.map((pack) => pack.id), ['rhythm-lite', 'music-semantics-lite']);
  for (const id of ['rhythm-lite', 'music-semantics-lite'] as const) {
    const pack = modelPackDefinition(id);
    assert.ok(pack, `model pack ${id} must exist in the catalog`);
    for (const file of pack.files) {
      const path = join(cacheDir, pack.modelId, file.path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, Buffer.alloc(0));
      await truncate(path, file.sizeBytes);
    }
  }
  const installed = await inspectMusicPacks(cacheDir);
  assert.equal(installed.installed, true);
  assert.ok(installed.files);
  assert.ok(installed.files.rhythmModelPath.startsWith(cacheDir), 'rhythm model path must live inside the cache dir');
  assert.ok(installed.files.cacheDir === cacheDir);

  // 4. The fake core feeds the real compose/cache path without any model pack.
  const calls: Array<{ sampleRate: number; options: Record<string, unknown> }> = [];
  const fakeDecode = async (_file: string, sampleRate: number, options: Record<string, unknown>) => {
    calls.push({ sampleRate, options });
    const seconds = typeof options.durationSeconds === 'number' ? options.durationSeconds : SONG_SECONDS;
    return new Float32Array(Math.round(sampleRate * seconds)).fill(0.25);
  };
  const beats = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500];
  const rhythm = {
    bpm: 120,
    meter: 4,
    confidence: 0.87,
    beatsMs: beats,
    downbeatsMs: [0, 2000],
    beatEnergy: beats.map((_, index) => 0.5 + index / 20),
  };
  const unitEmbedding = [1, ...new Array(CLAP_INFERENCE_CONTRACT.embeddingDimension - 1).fill(0)];
  let analyzeInputs = 0;
  const fakeInference = {
    analyze: async (input: { samples: Float32Array; sampleRate: number; windows: Float32Array[] }) => {
      analyzeInputs += 1;
      assert.equal(input.sampleRate, BEAT_THIS_SAMPLE_RATE);
      assert.equal(input.windows.length, sourceWindowStarts(input.samples.length, BEAT_THIS_SAMPLE_RATE).length);
      const expectedWindow = CLAP_INFERENCE_CONTRACT.sampleRate * CLAP_WINDOW_SECONDS;
      assert.ok(input.windows.every((window) => window.length === expectedWindow), 'CLAP windows are padded to 10 s');
      return { rhythm, embedding: unitEmbedding, backends: { rhythm: 'fake', semantic: 'fake' } };
    },
    dispose: async () => undefined,
  };
  const memory = new Map<string, unknown>();
  let writes = 0;
  const fakeStore = {
    read: async (assetId: string, revision: string) => (memory.get(`${assetId}\0${revision}`) ?? null) as never,
    write: async (analysis: { assetId: string; sourceRevision: string }) => {
      writes += 1;
      memory.set(`${analysis.assetId}\0${analysis.sourceRevision}`, analysis);
    },
  };
  const song = assetOf('asset-song', '/media/uploads/song.wav', 'song.wav');
  const options = {
    inference: fakeInference,
    decode: fakeDecode,
    store: fakeStore,
    mediaPath: () => songPath,
    cacheDir,
  };
  const analysis = await analyzeServerMusicAsset(song as never, options as never);
  assert.equal(analysis.bpm, 120);
  assert.equal(analysis.meter, 4);
  assert.equal(analysis.durationMs, SONG_SECONDS * 1000);
  assert.equal(analysis.embedding.length, CLAP_INFERENCE_CONTRACT.embeddingDimension);
  near(Math.hypot(...analysis.embedding), 1, 1e-6, 'embedding norm');
  assert.equal(analysis.beatsMs.length, beats.length);
  assert.ok(analysis.sections.length >= 1, 'sections must be derived');
  assert.equal(analysis.sections[0]!.fromMs, 0);
  assert.equal(analysis.sections[analysis.sections.length - 1]!.toMs, analysis.durationMs);
  assert.ok(analysis.tags.length >= 4, 'one tag per CLAP category');
  assert.equal(writes, 1);
  assert.equal(analyzeInputs, 1);
  assert.equal(calls.filter((call) => call.sampleRate === BEAT_THIS_SAMPLE_RATE).length, 1);
  const windowCalls = calls.filter((call) => call.sampleRate === CLAP_INFERENCE_CONTRACT.sampleRate);
  assert.ok(windowCalls.length >= 1, 'each CLAP window is decoded at 48 kHz');
  assert.equal(windowCalls[0]!.options.durationSeconds, CLAP_WINDOW_SECONDS);

  const decodedCalls = calls.length;
  const cached = await analyzeServerMusicAsset(song as never, options as never);
  assert.equal(cached, analysis, 'second call must return the stored analysis');
  assert.equal(calls.length, decodedCalls, 'a warm cache must not decode again');
  assert.equal(analyzeInputs, 1, 'a warm cache must not run the core again');

  // 5. A full decode is capped by the 15-minute limit, not the source length.
  const fullDecode = calls.find((call) => call.sampleRate === BEAT_THIS_SAMPLE_RATE);
  assert.equal(fullDecode?.options.maxSeconds, 15 * 60);

  // 6. Missing packs fail before decoding and surface their ids.
  const packless = assetOf('asset-packless', '/media/uploads/song.wav', 'song.wav');
  const packlessCalls: number[] = [];
  await assert.rejects(
    analyzeServerMusicAsset(packless as never, {
      decode: async (_file: string, sampleRate: number) => {
        packlessCalls.push(sampleRate);
        return new Float32Array(sampleRate);
      },
      store: fakeStore as never,
      mediaPath: () => songPath,
      cacheDir: join(fixture, 'no-packs'),
    } as never),
    (error: unknown) => {
      assert.ok(error instanceof MissingMusicPacksError);
      assert.deepEqual(error.missing.map((pack) => pack.id), ['rhythm-lite', 'music-semantics-lite']);
      return true;
    },
  );
  assert.equal(packlessCalls.length, 0, 'packs are checked before any decode');

  // 7. The SQLite cache carries the same key and record the browser reads.
  await saveStoredMusicAnalysis(analysis);
  const stored = await loadStoredMusicAnalysis(song.id, song.sourceRevision);
  assert.ok(stored);
  assert.equal(stored.bpm, analysis.bpm);
  const remoteKey = await musicAnalysisRemoteKey(musicAnalysisCacheKey(song.id, song.sourceRevision));
  const row = await getStoredEntry(remoteKey);
  assert.equal(row.found, true);
  const record = row.value as { key: string; analyzerFingerprint: string };
  assert.equal(record.key, musicAnalysisCacheKey(song.id, song.sourceRevision));
  assert.ok(record.analyzerFingerprint.includes('rhythm-lite@'));

  await setStoredEntry(remoteKey, { ...record, analyzerFingerprint: 'stale' });
  assert.equal(await loadStoredMusicAnalysis(song.id, song.sourceRevision), null, 'a stale fingerprint must miss');

  // 8. Server-direct tools answer from that record with no editor tab.
  assert.equal(isExternalServerDirectTool('analyze_music'), true);
  assert.equal(isExternalServerDirectTool('inspect_music'), true);
  const names = new Set(MUSIC_INTELLIGENCE_TOOL_SCHEMAS.map((tool) => tool.name));
  assert.ok(names.has('analyze_music') && names.has('inspect_music'));

  await saveStoredMusicAnalysis(analysis);
  const notes: string[] = [];
  const ctx = {
    getState: () => ({ items: [], fps: 30 }),
    getDoc: () => ({ assets: [song] }),
    onToolProgress: (note: string) => notes.push(note),
  };
  const inspected = await execServerMusicTool('inspect_music', { assetId: song.id }, ctx as never) as Record<string, unknown>;
  assert.equal(inspected.bpm, 120);
  assert.equal(inspected.meter, 4);
  assert.equal(inspected.assetId, song.id);
  assert.equal(inspected.pointUnit, 'sourceMs');
  assert.ok(typeof inspected.analysisRef === 'string' && String(inspected.analysisRef).startsWith('music-analysis:v2:'));
  assert.ok(Array.isArray(inspected.sections) && (inspected.sections as unknown[]).length >= 1);
  assert.ok(Array.isArray(inspected.tags) && (inspected.tags as unknown[]).length >= 1);

  const ranged = await execServerMusicTool('inspect_music', { assetId: song.id, fromMs: 500, toMs: 1500 }, ctx as never) as Record<string, unknown>;
  assert.deepEqual(ranged.range, { fromMs: 500, toMs: 1500 });
  assert.equal(ranged.beatCount, 2);

  // A projection without an item keeps source milliseconds; the browser tool
  // maps to timeline frames only when a clip is supplied.
  const projection = inspectMusicAnalysis({
    analysis,
    analysisRef: 'ref',
    args: {},
    fps: 30,
  });
  assert.equal(projection.pointUnit, 'sourceMs');

  // A song with no resolvable file reports that, not a pack error, when packs exist.
  const missingSource = assetOf('asset-missing', '/media/uploads/missing.wav', 'missing.wav');
  const missingCtx = { ...ctx, getDoc: () => ({ assets: [missingSource] }) };
  const failed = await execServerMusicTool('analyze_music', { assetId: missingSource.id }, missingCtx as never) as Record<string, unknown>;
  assert.match(String(failed.error), /is not available on this machine/);

  // inspect_music without a cache explains the next step and how to install packs.
  const uncached = await execServerMusicTool('inspect_music', { assetId: missingSource.id }, missingCtx as never) as Record<string, unknown>;
  assert.equal(uncached.action, 'missing-model-packs');
  assert.equal(uncached.settingsRoute, 'local/music/packs');
  assert.match(String(uncached.error), /analyze_music|installed/);

  // The worker entry ships beside whichever bundle hosts the runner.
  const workerPath = musicInferenceWorkerPath();
  assert.match(workerPath, /inference-worker\.(mjs|ts)$/);

  // 9. The forked worker protocol starts, reports a core error, and disposes
  //    without any model pack (the cores fail at model load, not at boot).
  const { createWorkerMusicInference } = await import('./inference.ts');
  const forked = createWorkerMusicInference({
    rhythm: {
      platform: process.platform as 'linux',
      preferredBackend: 'native-cpu',
      modelPath: join(fixture, 'absent.onnx'),
      filterbankPath: join(fixture, 'absent.bin'),
    },
    clap: { cacheDir: join(fixture, 'absent-cache'), platform: process.platform as 'linux', preferredBackend: 'native-cpu' },
  });
  const outcome = await Promise.race([
    forked.analyze({
      samples: new Float32Array(BEAT_THIS_SAMPLE_RATE),
      sampleRate: BEAT_THIS_SAMPLE_RATE,
      windows: [new Float32Array(CLAP_INFERENCE_CONTRACT.sampleRate)],
    })
      .then(() => 'resolved' as const, (error: unknown) => error as Error),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 120_000).unref()),
  ]);
  assert.notEqual(outcome, 'resolved', 'the worker must not invent an analysis without models');
  assert.notEqual(outcome, 'timeout', 'the worker must answer instead of hanging');
  assert.ok(outcome instanceof Error && outcome.message.length > 0);
  await forked.dispose();

  process.stdout.write('music-listen verify: ok\n');
} finally {
  if (previousDataDir === undefined) delete process.env.OPENCHATCUT_DATA_DIR;
  else process.env.OPENCHATCUT_DATA_DIR = previousDataDir;
  await rm(fixture, { recursive: true, force: true });
}
