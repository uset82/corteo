// P2-4: HEVC maps to hvc1-tagged MP4, and the two export presets exist.
// Run: npx tsx src/export/hevc-export.verify.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXPORT_MEDIA, planExport } from '../../server/plugins/export-plan.ts';
import { exportMediaExtension } from './exportMediaExtension.ts';
import { EXPORT_PRESETS, exportPresetFor } from './exportPresets.ts';

assert.deepEqual(EXPORT_MEDIA.h265, { codec: 'h265', ext: 'mp4', mime: 'video/mp4' });
assert.equal(exportMediaExtension('video', 'h265'), 'mp4');
assert.equal(exportMediaExtension('video', 'h264'), 'mp4', 'h264 stays exactly as it was');
assert.equal(exportMediaExtension('video', 'prores'), 'mov', 'ProRes stays exactly as it was');

const planState = {
  fps: 30,
  width: 1920,
  height: 1080,
  selectedId: null,
  items: [{ id: 'clip', name: 'clip', kind: 'video', track: 'V1', src: '/media/uploads/clip.mp4', startFrame: 0, durationInFrames: 90 }],
} as const;
const plan = planExport({ state: planState, format: 'video', codec: 'h265', resolution: '4k' });
assert.equal(plan.media.codec, 'h265');
assert.equal(plan.media.ext, 'mp4');
assert.match(plan.filename, /\.mp4$/, 'HEVC downloads as an MP4');
assert.equal(plan.retimeFps, undefined, 'HEVC keeps the timeline fps on the server path');

const hevc = readFileSync(new URL('../../remotion/hevc-tag.mjs', import.meta.url), 'utf8');
assert.match(hevc, /'-tag:v', 'hvc1'/, 'the HEVC MP4 must be tagged hvc1, never hev1');
assert.match(hevc, /transcodeHevc/, 'a missing Remotion HEVC encoder falls back to ffmpeg x265');

assert.deepEqual(EXPORT_PRESETS.map((preset) => preset.id), ['youtube-1080p-h264', 'videoclip-4k-hevc']);
assert.equal(exportPresetFor('h264', '1080p')?.id, 'youtube-1080p-h264');
assert.equal(exportPresetFor('h265', '4k')?.id, 'videoclip-4k-hevc');
assert.equal(exportPresetFor('vp8', '1080p'), undefined, 'a custom combination matches no preset');
const dialog = readFileSync(new URL('./ExportDialogTabs.tsx', import.meta.url), 'utf8');
assert.match(dialog, /EXPORT_PRESETS\.map\(/, 'the export dialog renders both presets');
const cli = readFileSync(new URL('../../cli/commands/render.ts', import.meta.url), 'utf8');
assert.match(cli, /'h265'/, 'occ render accepts --codec h265');

console.log('hevc-export.verify: h265 maps to hvc1-tagged MP4, presets and CLI are wired');
