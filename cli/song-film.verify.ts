import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SONG_SECONDS = 12;
const SAMPLE_RATE = 22050;
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

const root = fileURLToPath(new URL('..', import.meta.url));
const home = mkdtempSync(join(tmpdir(), 'occ-song-film-'));
const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, OPENCHATCUT_DATA_DIR: join(home, 'library') };
delete env.OPENCHATCUT_DEV_PROFILE_ID;
function run(args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', join(root, 'cli/main.ts'), ...args], { cwd: root, env, encoding: 'utf8' });
}
try {
  const audio = join(home, 'song.wav');
  writeFileSync(audio, wavFile(synthSong(), SAMPLE_RATE));
  writeFileSync(join(home, 'song.txt'), 'uno\ndos\ntres\ncuatro\n');
  const output = run(['song-film', '--audio', audio, '--to', '12s', '--json']);
  assert.equal(output.status, 0, output.stderr);
  const report = JSON.parse(output.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.lyricsSource, 'txt');
  assert.equal(report.textIds.length, 4);
  assert.equal(report.cutGrid, 'downbeat');
  const beats = run(['tools', 'call', 'detect_beats', '--project', report.projectId,
    '--args', JSON.stringify({ itemId: report.audioItemId }), '--json']);
  assert.equal(beats.status, 0, beats.stderr);
  const downbeats: number[] = JSON.parse(beats.stdout).ops[0].result.timelineDownbeatFrames;
  const docPath = join(home, 'doc.json');
  const show = run(['project', 'show', report.projectId, '--doc', '--out', docPath]);
  assert.equal(show.status, 0, show.stderr);
  const doc = JSON.parse(readFileSync(docPath, 'utf8'));
  const items = doc.timelines.flatMap((timeline: { items: { id: string; startFrame: number }[] }) => timeline.items);
  for (const id of report.visualIds) {
    const visual = items.find((item: { id: string }) => item.id === id);
    assert.ok(visual.startFrame === 0 || downbeats.some((beat) => Math.abs(beat - visual.startFrame) <= 1));
  }
  const pasted = run(['song-film', '--audio', audio, '--to', '12s', '--lyrics-text', 'texto propio', '--json']);
  assert.equal(pasted.status, 0, pasted.stderr);
  assert.equal(JSON.parse(pasted.stdout).lyricsSource, 'pasted');
  const missing = run(['song-film', '--audio', join(home, 'missing.wav'), '--json']);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /song-film needs an absolute --audio path that exists/);
  console.log('song-film.verify: ok');
} finally {
  rmSync(home, { recursive: true, force: true });
}
