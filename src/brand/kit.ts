/**
 * Brand kit (Plan 5, OP-10) — the `renderPref` equivalent: one saved bundle that makes every
 * clip from a batch look like the same channel.
 *
 * This first step is deliberately only the data half: the type, the defaults, a normalizer for
 * untrusted input (a kit arrives from JSON, from the model, or from an old project) and a
 * validator that reports what is wrong instead of throwing. Persisting the kit on
 * `ProjectDoc` and applying it to sequences are the next two commits of the same card.
 */

export interface BrandWatermark {
  /** Pool asset id of the logo, when one is set. */
  assetId?: string;
  /** `top-left` … `bottom-right`; the existing watermark tool uses the same vocabulary. */
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  /** 0..1 of the canvas width. */
  scale: number;
  opacity: number;
}

export interface BrandKit {
  name: string;
  /** Caption preset id from `src/captions/styles.ts`. */
  captionPreset: string;
  /** Canvas ratios the batch is expected to ship in; informational for now. */
  ratios: string[];
  /** Body face for captions and headlines. */
  fontFamily?: string;
  /** Two to five hex colours: first is the accent, second is the text colour. */
  palette: string[];
  /** Safe margins as a fraction of the canvas (0..0.2). */
  safeMargin: number;
  watermark?: BrandWatermark;
  /** Measured in seconds; 0 disables. */
  introSeconds: number;
  outroSeconds: number;
  /** Caption motion preset id, when the kit wants one. */
  captionMotion?: string;
}

export const DEFAULT_BRAND_KIT: BrandKit = {
  name: 'Marca',
  captionPreset: 'tiktok',
  ratios: ['9:16'],
  palette: ['#FF2E63', '#FFFDF7'],
  safeMargin: 0.06,
  introSeconds: 0,
  outroSeconds: 0,
};

const MARKS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

function num(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
}

function str(value: unknown, fallback: string, maxLength = 80): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

/**
 * Coerce anything into a usable kit. Unknown or malformed fields fall back to the defaults
 * one by one, so a half-written kit still applies its good half instead of failing whole.
 */
export function normalizeBrandKit(raw: unknown, fallback: BrandKit = DEFAULT_BRAND_KIT): BrandKit {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const palette = Array.isArray(input.palette)
    ? input.palette.filter((c): c is string => typeof c === 'string' && HEX.test(c.trim())).slice(0, 5)
    : [];
  const ratios = Array.isArray(input.ratios)
    ? input.ratios.filter((r): r is string => typeof r === 'string' && /^\d{1,2}:\d{1,2}$/.test(r.trim())).slice(0, 5)
    : [];
  const watermarkRaw = input.watermark && typeof input.watermark === 'object'
    ? input.watermark as Record<string, unknown>
    : null;
  const position = MARKS.find((mark) => mark === watermarkRaw?.position);

  const kit: BrandKit = {
    name: str(input.name, fallback.name, 40),
    captionPreset: str(input.captionPreset, fallback.captionPreset, 40),
    ratios: ratios.length ? ratios : [...fallback.ratios],
    palette: palette.length ? palette : [...fallback.palette],
    safeMargin: num(input.safeMargin, fallback.safeMargin, 0, 0.2),
    introSeconds: num(input.introSeconds, fallback.introSeconds, 0, 10),
    outroSeconds: num(input.outroSeconds, fallback.outroSeconds, 0, 10),
  };
  // Optional fields are omitted, never set to undefined: a normalized kit has to deep-equal
  // the defaults when nothing was supplied, and `{ x: undefined }` does not equal `{}`.
  const fontFamily = typeof input.fontFamily === 'string' ? input.fontFamily.trim().slice(0, 60) : '';
  if (fontFamily) kit.fontFamily = fontFamily;
  else if (fallback.fontFamily) kit.fontFamily = fallback.fontFamily;
  if (watermarkRaw && position) {
    kit.watermark = {
      assetId: typeof watermarkRaw.assetId === 'string' && watermarkRaw.assetId.trim()
        ? watermarkRaw.assetId.trim()
        : undefined,
      position,
      scale: num(watermarkRaw.scale, 0.12, 0.02, 0.6),
      opacity: num(watermarkRaw.opacity, 0.85, 0.05, 1),
    };
  }
  const captionMotion = typeof input.captionMotion === 'string' ? input.captionMotion.trim().slice(0, 40) : '';
  if (captionMotion) kit.captionMotion = captionMotion;
  return kit;
}

export interface BrandKitIssue {
  field: string;
  problem: string;
}

/**
 * What is wrong with a kit, in the user's words. `normalizeBrandKit` repairs; this reports, so
 * the UI can say "el logo no está en la biblioteca" instead of silently dropping it.
 */
export function brandKitIssues(raw: unknown, knownCaptionPresets: readonly string[] = []): BrandKitIssue[] {
  const issues: BrandKitIssue[] = [];
  const input = (raw && typeof raw === 'object' ? raw : null) as Record<string, unknown> | null;
  if (!input) return [{ field: 'kit', problem: 'El kit no es un objeto.' }];

  if (typeof input.captionPreset === 'string'
    && knownCaptionPresets.length
    && !knownCaptionPresets.includes(input.captionPreset)) {
    issues.push({ field: 'captionPreset', problem: `No existe el estilo de subtítulos "${input.captionPreset}".` });
  }
  if (Array.isArray(input.palette)) {
    const bad = input.palette.filter((c) => typeof c !== 'string' || !HEX.test(String(c).trim()));
    if (bad.length) issues.push({ field: 'palette', problem: `${bad.length} color(es) no son hexadecimales y se ignoran.` });
  }
  const watermark = input.watermark && typeof input.watermark === 'object'
    ? input.watermark as Record<string, unknown>
    : null;
  if (watermark && !MARKS.find((mark) => mark === watermark.position)) {
    issues.push({ field: 'watermark.position', problem: 'El logo no tiene una esquina válida y se ignora.' });
  }
  return issues;
}
