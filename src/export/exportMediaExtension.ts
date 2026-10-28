export type ExportMediaCodec = 'h264' | 'h265' | 'vp8' | 'prores' | 'mp3';
export type ExportMediaFormat = 'video' | 'audio';

export function exportMediaExtension(
  format: ExportMediaFormat,
  codec: ExportMediaCodec,
): 'mp4' | 'webm' | 'mov' | 'mp3' {
  if (format === 'audio') return 'mp3';
  if (codec === 'vp8') return 'webm';
  if (codec === 'prores') return 'mov';
  if (codec === 'h265') return 'mp4';
  return 'mp4';
}
