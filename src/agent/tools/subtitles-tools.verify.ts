// import_subtitles: an ASS file on disk becomes a caption track whose words keep
// the karaoke timings. The host reader is injected, so this runs headless: the
// file is read with fs here exactly as the offline host reads it.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentContext } from '../context';
import type { CaptionsData } from '../../captions/types';
import type { TimelineState, TrackId } from '../../editor/types';
import { newManualCaptions } from '../../captions/manualCaptions';
import { execImportSubtitlesTool, type SubtitleTextSource } from './subtitles-tools';

const ASS = [
  '[Script Info]',
  'ScriptType: v4.00+',
  '',
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  'Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\k100}Can{\\k100}to',
  'Dialogue: 0,0:00:03.50,0:00:05.50,Default,,0,0,0,,{\\kf100}Y a{\\kf100}hora',
].join('\n');

const dir = await mkdtemp(join(tmpdir(), 'corteo-subs-'));
const assPath = join(dir, 'coro.ass');
await writeFile(assPath, ASS, 'utf8');
const textPath = join(dir, 'letra.txt');
await writeFile(textPath, 'una letra suelta', 'utf8');

const source: SubtitleTextSource = { readTextFile: (path) => readFile(path, 'utf8') };

interface Capture {
  created: Array<{ captions: CaptionsData; name?: string }>;
  set: Array<{ captions: CaptionsData; track?: TrackId }>;
}

function context(state: TimelineState): { ctx: AgentContext; capture: Capture } {
  const capture: Capture = { created: [], set: [] };
  const ctx = {
    getState: () => state,
    commands: {
      createCaptionTrack: (captions: CaptionsData, opts?: { name?: string }) => {
        capture.created.push({ captions, name: opts?.name });
        return 'C1' as TrackId;
      },
      setCaptions: (captions: CaptionsData, track?: TrackId) => {
        capture.set.push({ captions, track });
      },
    },
  } as unknown as AgentContext;
  return { ctx, capture };
}

const emptyState = {
  fps: 30, width: 1920, height: 1080, items: [], tracks: {},
} as unknown as TimelineState;

// ── A new track, named after the file, with the karaoke word timings ─────────
{
  const { ctx, capture } = context(emptyState);
  const result = await execImportSubtitlesTool('import_subtitles', { path: assPath }, ctx, source);
  assert.equal(result.ok, true, `import failed: ${String(result.error)}`);
  assert.equal(result.format, 'ass');
  assert.equal(result.name, 'coro');
  assert.equal(result.captionTrackId, 'C1');
  assert.equal(result.createdTrack, true);
  assert.equal(result.wordCount, 3);
  assert.equal(result.startMs, 1000);
  assert.equal(result.endMs, 5500, 'the last word ends at the end of its cue');

  assert.equal(capture.created.length, 1);
  const captions = capture.created[0]!.captions;
  assert.equal(capture.created[0]!.name, 'coro');
  assert.equal(captions.enabled, true);
  assert.equal(captions.sourceEntries?.length, 1);
  const lane = captions.sourceEntries![0]!;
  assert.equal(lane.label, 'coro');
  assert.ok(lane.itemId?.startsWith('manual:'), 'the lane uses the manual item sentinel');
  // Karaoke syllables merge back into words: "Can"+"to" is one word, and the
  // tag inside "ahora" splits it into "Y" and "ahora".
  assert.deepEqual(
    lane.words?.map((word) => [word.text, word.start, word.end]),
    [['Canto', 1000, 3000], ['Y', 3500, 3833], ['ahora', 4167, 5500]],
  );
  assert.ok(lane.words?.every((word) => typeof word.id === 'string' && word.id.length > 0), 'every cue has a stable id');
}

// ── An existing caption track gets the subtitles as another lane ─────────────
{
  const existing = newManualCaptions();
  existing.sourceEntries![0]!.words = [{ text: 'antes', start: 0, end: 500 }];
  const state = {
    fps: 30, width: 1920, height: 1080, items: [],
    tracks: { C1: { id: 'C1', kind: 'caption', captions: existing } },
  } as unknown as TimelineState;
  const { ctx, capture } = context(state);
  const result = await execImportSubtitlesTool(
    'import_subtitles',
    { path: assPath, captionTrackId: 'C1' },
    ctx,
    source,
  );
  assert.equal(result.ok, true, `import failed: ${String(result.error)}`);
  assert.equal(result.addedTo, 'C1');
  assert.equal(capture.created.length, 0, 'no second track');
  assert.equal(capture.set.length, 1);
  const captions = capture.set[0]!.captions;
  assert.equal(capture.set[0]!.track, 'C1');
  assert.equal(captions.sourceEntries?.length, 2, 'the existing lane stays and a subtitle lane joins it');
  assert.deepEqual(captions.sourceEntries![0]!.words?.map((word) => word.text), ['antes']);
  assert.equal(captions.sourceEntries![1]!.words?.length, 3);
}

// ── Refusals carry a reason ──────────────────────────────────────────────────
{
  const { ctx, capture } = context(emptyState);
  assert.match(String((await execImportSubtitlesTool('import_subtitles', {}, ctx, source)).error), /path is required/);
  assert.match(
    String((await execImportSubtitlesTool('import_subtitles', { path: assPath, format: 'txt' }, ctx, source)).error),
    /format must be srt, ass or vtt/,
  );
  assert.match(
    String((await execImportSubtitlesTool('import_subtitles', { path: textPath }, ctx, source)).error),
    /无法识别的字幕格式/,
  );
  assert.match(
    String((await execImportSubtitlesTool('import_subtitles', { path: join(dir, 'nope.srt') }, ctx, source)).error),
    /ENOENT/,
  );
  assert.match(
    String((await execImportSubtitlesTool(
      'import_subtitles',
      { path: assPath, captionTrackId: 'C9' },
      ctx,
      source,
    )).error),
    /no caption track C9/,
  );
  assert.match(
    String((await execImportSubtitlesTool('import_subtitles', { path: assPath }, ctx, null)).error),
    /needs a host that can read a local file/,
  );
  assert.equal(capture.created.length, 0, 'a refused import writes nothing');
}

await rm(dir, { recursive: true, force: true });
console.log('subtitles-tools.verify: ok');
