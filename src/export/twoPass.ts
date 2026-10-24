// Two-pass H.264/H.265 encoding for strict bitrate delivery.
//
// Remotion renders single-pass (CRF or bitrate), which is the right default:
// CRF gives better quality per byte. Two-pass exists for the cases where the
// DELIVERED BITRATE is a hard requirement — broadcast specs, upload caps, a
// fixed-size slot — because only a real first pass can distribute the budget
// across the timeline.
//
// The pipeline is: Remotion renders a high-quality intermediate, then ffmpeg
// encodes it twice against a target bitrate. The intermediate is lossless-ish
// (CRF 18), so the double generation does not compound into visible loss.
//
// This module is pure argument building so the command line can be asserted in
// tests without spawning ffmpeg.

/** Codecs with a real two-pass mode in the bundled ffmpeg. */
export const TWO_PASS_CODECS = ['h264', 'h265'] as const;
export type TwoPassCodec = typeof TWO_PASS_CODECS[number];

export function isTwoPassCodec(codec: string): codec is TwoPassCodec {
  return (TWO_PASS_CODECS as readonly string[]).includes(codec);
}

export interface TwoPassArgsOptions {
  input: string;
  /** Pass 2 destination. Ignored by pass 1, which writes to the null muxer. */
  output: string;
  codec: TwoPassCodec;
  /** Target video bitrate in bits per second. */
  bitrate: number;
  /** Prefix for ffmpeg's stats log; the same value must be used by both passes. */
  passLogFile: string;
  pass: 1 | 2;
  /** Filter chain (fps resampling, scaling) applied identically to both passes. */
  filters?: readonly string[];
  /** Audio arguments, applied on pass 2 only (pass 1 has no audio). */
  audioArgs?: readonly string[];
  /** Extra video arguments appended after the rate control flags. */
  videoArgs?: readonly string[];
}

const BASE = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y'];

/** Encoder name per codec: software x265 for HEVC, x264 for H.264. */
function encoderFor(codec: TwoPassCodec): string {
  return codec === 'h265' ? 'libx265' : 'libx264';
}

/** Pixel format the mp4 container and both encoders agree on. */
function pixFmt(codec: TwoPassCodec): string[] {
  return codec === 'h265' ? ['-pix_fmt', 'yuv420p', '-tag:v', 'hvc1'] : ['-pix_fmt', 'yuv420p'];
}

/**
 * ffmpeg argv for one pass. Pass 1 discards the output (null muxer) and only
 * writes statistics; pass 2 re-encodes with the same flags and produces the
 * file. Both passes MUST receive identical filters and rate-control flags, or
 * the statistics describe a different stream than the one being written.
 */
export function twoPassArgs(options: TwoPassArgsOptions): string[] {
  const filters = options.filters?.length ? ['-vf', options.filters.join(',')] : [];
  const video = [
    '-c:v', encoderFor(options.codec),
    '-preset', 'medium',
    ...pixFmt(options.codec),
    '-b:v', String(Math.max(1, Math.round(options.bitrate))),
    '-pass', String(options.pass),
    '-passlogfile', options.passLogFile,
    ...(options.videoArgs ?? []),
  ];
  if (options.pass === 1) {
    return [...BASE, '-i', options.input, ...filters, ...video, '-an', '-f', 'null', '-'];
  }
  return [
    ...BASE,
    '-i', options.input,
    ...filters,
    ...video,
    ...(options.audioArgs ?? ['-c:a', 'copy']),
    '-movflags', '+faststart',
    options.output,
  ];
}

/** Why two-pass cannot be used for this export, or null when it can. */
export function twoPassUnavailableReason(options: {
  codec: string;
  videoBitrate?: number | undefined;
  crf?: number | undefined;
}): string | null {
  if (!isTwoPassCodec(options.codec)) {
    return `two-pass encoding supports ${TWO_PASS_CODECS.join(' and ')} only`;
  }
  if (options.crf !== undefined) {
    return 'two-pass encoding targets a bitrate and cannot be combined with CRF';
  }
  if (options.videoBitrate === undefined) {
    return 'two-pass encoding needs a target video bitrate';
  }
  return null;
}

/**
 * Quality the intermediate is rendered at. High enough that the two encoding
 * passes are the only meaningful generation loss (CRF 18 ≈ visually lossless
 * for this purpose), while still far cheaper than a lossless mezzanine.
 */
export const TWO_PASS_INTERMEDIATE_CRF = 18;
