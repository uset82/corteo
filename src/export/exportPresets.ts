import type { ExportResolution } from './mediaSettings';
import type { ExportVideoCodec } from './useExportDialogModel';

export type ExportPresetId = 'youtube-1080p-h264' | 'videoclip-4k-hevc';

export interface ExportPreset {
  id: ExportPresetId;
  /** Chinese original for t(); the value is the product name. */
  label: string;
  codec: ExportVideoCodec;
  resolution: ExportResolution;
}

export const EXPORT_PRESETS: readonly ExportPreset[] = [
  { id: 'youtube-1080p-h264', label: 'YouTube 1080p H.264 预设', codec: 'h264', resolution: '1080p' },
  { id: 'videoclip-4k-hevc', label: 'Videoclip 4K HEVC 预设', codec: 'h265', resolution: '4k' },
];

/** The preset whose codec and resolution match the current settings, if any. */
export function exportPresetFor(
  codec: ExportVideoCodec,
  resolution: ExportResolution,
): ExportPreset | undefined {
  return EXPORT_PRESETS.find((preset) => preset.codec === codec && preset.resolution === resolution);
}
