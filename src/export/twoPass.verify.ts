// Runnable check: `npx tsx src/export/twoPass.verify.ts`.
//
// Two-pass export is only correct if both passes describe the same stream and
// only if it is refused where it cannot work. Both are argv/validation facts,
// so they are asserted directly instead of by rendering a file.
import assert from 'node:assert/strict';
import {
  TWO_PASS_CODECS,
  TWO_PASS_INTERMEDIATE_CRF,
  isTwoPassCodec,
  twoPassArgs,
  twoPassUnavailableReason,
} from './twoPass';

const common = {
  input: '/tmp/render.mp4',
  output: '/tmp/out.mp4',
  bitrate: 12_000_000,
  passLogFile: '/tmp/out.passlog',
};

const pass1 = twoPassArgs({ ...common, codec: 'h264', pass: 1 });
const pass2 = twoPassArgs({ ...common, codec: 'h264', pass: 2 });

// ── pass 1 discards its output and carries no audio ───────────────────────
assert.deepEqual(pass1.slice(-4), ['-an', '-f', 'null', '-'], 'pass 1 writes statistics only');
assert.ok(pass1.includes('-pass') && pass1[pass1.indexOf('-pass') + 1] === '1');
assert.ok(!pass1.includes('/tmp/out.mp4'), 'pass 1 must not write the deliverable');
assert.ok(!pass1.includes('-c:a'), 'pass 1 has no audio stream to encode');

// ── pass 2 writes the file, with audio and faststart ─────────────────────
assert.equal(pass2[pass2.length - 1], '/tmp/out.mp4');
assert.ok(pass2.includes('-movflags') && pass2[pass2.indexOf('-movflags') + 1] === '+faststart');
assert.ok(pass2.includes('-c:a'), 'pass 2 keeps the audio track');

// ── both passes agree on everything that affects the statistics ──────────
const rateControl = (args: string[]) => {
  const pick = (flag: string) => {
    const index = args.indexOf(flag);
    return index < 0 ? undefined : args[index + 1];
  };
  return {
    encoder: pick('-c:v'),
    bitrate: pick('-b:v'),
    passlog: pick('-passlogfile'),
    pixFmt: pick('-pix_fmt'),
    filters: pick('-vf'),
  };
};
assert.deepEqual(rateControl(pass1), rateControl(pass2), 'identical stream description in both passes');
assert.equal(rateControl(pass1).bitrate, '12000000');
assert.equal(rateControl(pass1).encoder, 'libx264');

// Filters must land on both passes or the stats describe a different stream.
const filtered = twoPassArgs({ ...common, codec: 'h264', pass: 1, filters: ['fps=30', 'scale=1920:1080'] });
assert.equal(rateControl(filtered).filters, 'fps=30,scale=1920:1080');
const filtered2 = twoPassArgs({ ...common, codec: 'h264', pass: 2, filters: ['fps=30', 'scale=1920:1080'] });
assert.equal(rateControl(filtered2).filters, rateControl(filtered).filters);

// ── HEVC uses x265 and tags the stream so players pick it up ─────────────
const hevc = twoPassArgs({ ...common, codec: 'h265', pass: 2 });
assert.equal(rateControl(hevc).encoder, 'libx265');
assert.ok(hevc.includes('-tag:v') && hevc[hevc.indexOf('-tag:v') + 1] === 'hvc1');

// ── fractional / negative bitrates never reach ffmpeg raw ────────────────
assert.equal(rateControl(twoPassArgs({ ...common, codec: 'h264', pass: 1, bitrate: 1_500_000.7 })).bitrate, '1500001');
assert.equal(rateControl(twoPassArgs({ ...common, codec: 'h264', pass: 1, bitrate: -5 })).bitrate, '1');

// ── codec support ────────────────────────────────────────────────────────
assert.deepEqual([...TWO_PASS_CODECS], ['h264', 'h265']);
assert.equal(isTwoPassCodec('h264'), true);
assert.equal(isTwoPassCodec('h265'), true);
assert.equal(isTwoPassCodec('prores'), false);
assert.equal(isTwoPassCodec('vp8'), false);

// ── refusals ─────────────────────────────────────────────────────────────
assert.equal(twoPassUnavailableReason({ codec: 'h264', videoBitrate: 8_000_000 }), null);
assert.match(twoPassUnavailableReason({ codec: 'prores', videoBitrate: 8_000_000 }) ?? '', /h264 and h265/);
assert.match(twoPassUnavailableReason({ codec: 'h264', crf: 20, videoBitrate: 8_000_000 }) ?? '', /cannot be combined with CRF/);
assert.match(twoPassUnavailableReason({ codec: 'h264' }) ?? '', /needs a target video bitrate/);

// The intermediate must be visually lossless enough that the two encoding
// passes are the only meaningful generation loss.
assert.ok(TWO_PASS_INTERMEDIATE_CRF <= 20, 'intermediate stays high quality');

console.log('twoPass.verify: pass argv, shared stream flags, HEVC tagging and refusals');
