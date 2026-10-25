/** Names that show up in project JSON and the CLI. The product language is Spanish. */
export const DEFAULT_SEQUENCE_NAME = 'Secuencia 1';

export function sequenceName(index: number): string {
  return `Secuencia ${index}`;
}

export function sequenceCopyName(name: string | undefined): string {
  const base = name?.trim() || 'Secuencia';
  return `${base} copia`;
}

export const DEFAULT_TEXT_ITEM_NAME = 'Texto';
export const DEFAULT_TEXT_BODY = 'Texto';
export const DEFAULT_SOLID_NAME = 'Color';
export const DEFAULT_OVERLAY_TRACK_NAME = 'Títulos';
