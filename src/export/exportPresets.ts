// Export size estimation (Phase 3.6): the dialog shows the user what the chosen
// bitrate and duration will cost on disk before the render starts.
//
// The estimate is derived from the resolved target bitrate (video + audio) so it
// tracks the actual encoder settings instead of a per-resolution lookup table.
export interface FileSizeEstimate {
  megabytes: number;
  /** Human string for the UI, e.g. "12.4 MB" or "1.21 GB". */
  label: string;
}

/** Bytes per second for a bitrate in bits per second. */
export function bytesPerSecond(bitrateBps: number): number {
  return Math.max(0, bitrateBps) / 8;
}

/**
 * Estimated file size for a render. Returns null when there is no bitrate to
 * estimate from (ProRes mezzanine, where Remotion ignores the bitrate) or the
 * duration is not a positive number.
 */
export function estimateFileSize(bitrateBps: number | undefined, seconds: number): FileSizeEstimate | null {
  if (bitrateBps === undefined || !Number.isFinite(bitrateBps) || bitrateBps <= 0) return null;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const megabytes = (bytesPerSecond(bitrateBps) * seconds) / 1_000_000;
  return { megabytes, label: formatFileSize(megabytes) };
}

/** "12.4 MB" below a gigabyte, "1.21 GB" above it. */
export function formatFileSize(megabytes: number): string {
  if (!Number.isFinite(megabytes) || megabytes <= 0) return '0 MB';
  if (megabytes < 1000) return `${megabytes.toFixed(1)} MB`;
  return `${(megabytes / 1024).toFixed(2)} GB`;
}
