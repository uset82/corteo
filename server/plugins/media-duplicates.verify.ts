// P2-3: duplicate detector — identical/near-identical images group, a different
// image does not, video frames are sampled at 10/50/90% of the clip's own
// duration, a reused timeline range is flagged, and the route stays read-only.
// Run: npx tsx server/plugins/media-duplicates.verify.ts
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ffmpegBin } from '../media-binaries.ts';
import {
  analyzeMediaDuplicates,
  clearDuplicateFrameCache,
  duplicateSampleTimes,
} from '../media-duplicates.ts';
import { parseDuplicateRouteBody } from './media-duplicates.ts';

const dir = await mkdtemp(join(tmpdir(), 'occ-media-duplicates-'));
const ffmpeg = (args: string[]) => execFileSync(ffmpegBin(), ['-y', '-hide_banner', '-loglevel', 'error', ...args]);

try {
  const base = join(dir, 'base.png');
  const same = join(dir, 'same.png');
  const near = join(dir, 'near.png');
  const different = join(dir, 'different.png');
  ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=s=320x240:d=1', '-frames:v', '1', base]);
  await copyFile(base, same);
  ffmpeg(['-i', base, '-vf', 'gblur=sigma=1.4', near]);
  ffmpeg(['-f', 'lavfi', '-i', 'smptebars=s=320x240:d=1', '-frames:v', '1', different]);

  const images = [
    { id: 'base', name: 'base.png', kind: 'image', path: base, durationSeconds: 0 },
    { id: 'same', name: 'same.png', kind: 'image', path: same, durationSeconds: 0 },
    { id: 'near', name: 'near.png', kind: 'image', path: near, durationSeconds: 0 },
    { id: 'different', name: 'different.png', kind: 'image', path: different, durationSeconds: 0 },
  ];
  clearDuplicateFrameCache();
  const visual = await analyzeMediaDuplicates(images, [], { includeThumbnails: true });
  assert.equal(visual.groups.length, 1, 'identical and slightly blurred copies form one group');
  const group = visual.groups[0]!;
  assert.deepEqual([...group.assetIds].sort(), ['base', 'near', 'same']);
  assert.equal(group.kind, 'visual');
  assert.ok(group.maxDistance !== undefined && group.maxDistance <= visual.threshold);
  assert.equal(group.assetIds.includes('different'), false, 'a different image must not join the group');
  assert.ok(group.thumbnails?.[0]?.startsWith('data:image/jpeg;base64,'), 'the group has a preview thumbnail');

  // Real imports all carry a content hash: a near copy must still join the exact pair.
  clearDuplicateFrameCache();
  const mixedHash = 'cd'.repeat(32);
  const mixed = await analyzeMediaDuplicates([
    { ...images[0]!, contentHash: mixedHash },
    { ...images[1]!, contentHash: mixedHash },
    images[2]!,
    images[3]!,
  ], [], { includeThumbnails: false });
  assert.equal(mixed.groups.length, 1, 'exact copies and their blurred copy are one group');
  assert.deepEqual([...mixed.groups[0]!.assetIds].sort(), ['base', 'near', 'same']);
  assert.equal(mixed.groups[0]!.kind, 'visual', 'the group is visual because near.png has a different hash');

  // A rename must reuse the content-hash cache instead of sampling again.
  const renamed = join(dir, 'renamed.png');
  await copyFile(base, renamed);
  const sharedHash = 'ab'.repeat(32);
  clearDuplicateFrameCache();
  const exact = await analyzeMediaDuplicates([
    { id: 'base', name: 'base.png', kind: 'image', path: base, contentHash: sharedHash, durationSeconds: 0 },
    { id: 'renamed', name: 'renamed.png', kind: 'image', path: renamed, contentHash: sharedHash, durationSeconds: 0 },
    { id: 'different', name: 'different.png', kind: 'image', path: different, durationSeconds: 0 },
  ], [], { includeThumbnails: false });
  assert.equal(exact.groups.length, 1);
  assert.equal(exact.groups[0]!.kind, 'exact', 'the same SHA-256 is an exact copy, not a visual match');
  assert.deepEqual([...exact.groups[0]!.assetIds].sort(), ['base', 'renamed']);
  assert.equal(exact.groups[0]!.assetIds.includes('different'), false);
  assert.ok(exact.checked.cached >= 1, 'the renamed copy hits the content-hash frame cache');

  // Video: sample 10/50/90% of the clip's own 4s duration, not the file middle.
  assert.deepEqual(duplicateSampleTimes('video', 4), [0.4, 2, 3.6]);
  assert.deepEqual(duplicateSampleTimes('video', 0.1), [0]);
  assert.deepEqual(duplicateSampleTimes('image', 4), [0], 'images are one frame');
  const clip = join(dir, 'clip.mp4');
  const clipCopy = join(dir, 'clip-copy.mp4');
  const clipOther = join(dir, 'clip-other.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=s=320x240:r=30:d=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clip]);
  ffmpeg(['-i', clip, '-c:v', 'libx264', '-crf', '30', '-preset', 'veryfast', clipCopy]);
  ffmpeg(['-f', 'lavfi', '-i', 'smptebars=s=320x240:r=30:d=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clipOther]);
  clearDuplicateFrameCache();
  const videos = await analyzeMediaDuplicates([
    { id: 'clip', name: 'clip.mp4', kind: 'video', path: clip, durationSeconds: 4 },
    { id: 'clip-copy', name: 'clip-copy.mp4', kind: 'video', path: clipCopy, durationSeconds: 4 },
    { id: 'clip-other', name: 'clip-other.mp4', kind: 'video', path: clipOther, durationSeconds: 4 },
  ], [], { includeThumbnails: false });
  assert.equal(videos.groups.length, 1, 'the re-encoded video is a visual duplicate');
  assert.deepEqual([...videos.groups[0]!.assetIds].sort(), ['clip', 'clip-copy']);

  // The same source range placed twice on the timeline is flagged.
  const reused = await analyzeMediaDuplicates(images, [
    { id: 'place-1', assetId: 'base', name: 'base 1', startFrame: 0, srcInFrame: 0, durationInFrames: 60 },
    { id: 'place-2', assetId: 'base', name: 'base 2', startFrame: 300, srcInFrame: 60, durationInFrames: 60 },
  ], { includeThumbnails: false });
  assert.equal(reused.reused.length, 1);
  const reuse = reused.reused[0]!;
  assert.equal(reuse.assetId, 'base');
  assert.deepEqual(reuse.occurrences.map((occurrence) => occurrence.itemId), ['place-1', 'place-2']);
  assert.equal(reuse.occurrences.every((occurrence) => occurrence.sameRange === false), true, 'different source in-points are not the same range');

  // The route parses the same shape, keeps items, and skips missing uploads.
  const parsed = parseDuplicateRouteBody({
    assets: [{ id: 'gone', name: 'gone.mp4', kind: 'video', src: '/media/uploads/does-not-exist.mp4' }],
    items: [{ id: 'item-1', assetId: 'gone', name: 'gone', startFrame: 0, srcInFrame: 0, durationInFrames: 30 }],
    threshold: 7,
    includeThumbnails: false,
  });
  assert.deepEqual(parsed.assets, [], 'an offline upload is skipped, not fatal');
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.options.threshold, 7);
  assert.equal(parsed.options.includeThumbnails, false);
  assert.throws(() => parseDuplicateRouteBody(null), /JSON object/);

  // Read-only route: no file writes, and the request-shape gate runs first.
  const route = await readFile(new URL('./media-duplicates.ts', import.meta.url), 'utf8');
  const registry = await readFile(new URL('./index.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(route, /writeFile|appendFile|unlink|rm\(/, 'the duplicate route must not write files');
  assert.match(route, /req\.method !== 'POST'/, 'the duplicate route is a POST body reader');
  assert.ok(
    registry.indexOf('requestShapeGatePlugin()') < registry.indexOf('mediaDuplicatesPlugin()'),
    'the global request-shape gate is registered before the duplicate route',
  );

  const toolbar = await readFile(new URL('../../src/media/MediaPoolToolbar.tsx', import.meta.url), 'utf8');
  const dialog = await readFile(new URL('../../src/media/MediaDuplicatesDialog.tsx', import.meta.url), 'utf8');
  assert.match(toolbar, /Detectar duplicados/, 'the media pool menu opens the detector');
  for (const label of ['Duplicados', 'Ir al clip', 'Quitar']) {
    assert.match(dialog, new RegExp(label), `the dialog shows ${label}`);
  }
  assert.match(dialog, /\/api\/media-duplicates/, 'the dialog asks the read-only route');

  console.log('media-duplicates.verify: identical/near-identical grouping, 10/50/90 video sampling, reuse and read-only route OK');
} finally {
  await rm(dir, { recursive: true, force: true });
}
