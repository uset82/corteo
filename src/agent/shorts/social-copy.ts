import { generateAgentText } from '../client';

/**
 * Social copy for a finished clip: title, description and hashtags, clamped to each
 * platform's real limits. OpusClip's `create_social_copy_job`, without a paid model.
 *
 * The output is deliberately not stored on the sequence here: `publish_to_social` already
 * takes `title` and `description`, so the copy goes straight into that call instead of
 * inventing a second place for it to drift.
 */

export const COPY_PLATFORMS = [
  'tiktok', 'instagram', 'youtube', 'linkedin', 'facebook', 'x', 'threads', 'pinterest', 'bluesky',
] as const;
export type CopyPlatform = (typeof COPY_PLATFORMS)[number];

interface Limits {
  title: number;
  description: number;
  hashtags: number;
}

/** Documented limits, kept in one table so a test can prove we never exceed them. */
export const PLATFORM_LIMITS: Record<CopyPlatform, Limits> = {
  tiktok: { title: 100, description: 2200, hashtags: 8 },
  instagram: { title: 100, description: 2200, hashtags: 12 },
  youtube: { title: 100, description: 5000, hashtags: 5 },
  linkedin: { title: 200, description: 3000, hashtags: 5 },
  facebook: { title: 200, description: 5000, hashtags: 5 },
  x: { title: 280, description: 280, hashtags: 3 },
  threads: { title: 500, description: 500, hashtags: 5 },
  pinterest: { title: 100, description: 500, hashtags: 8 },
  bluesky: { title: 300, description: 300, hashtags: 3 },
};

export interface PlatformCopy {
  platform: CopyPlatform;
  title: string;
  description: string;
  hashtags: string[];
  /** Characters actually used, so the caller can see how close a platform is to its limit. */
  titleLength: number;
  descriptionLength: number;
}

export interface SocialCopyInput {
  /** What the clip says (or the user's own summary). */
  text: string;
  platforms: readonly CopyPlatform[];
  /** Free-text steering: tone, audience, language, call to action. */
  direction?: string;
  /** Language the copy should be written in. Default: match the transcript's language. */
  language?: string;
}

const SYSTEM = `You write social media copy for short vertical video clips.

For each requested platform, write:
- title: a hook a person would stop for. No clickbait the clip does not deliver, no emoji spam, no hashtags inside the title.
- description: one to three short sentences that add context or a call to action. Plain text, no markdown.
- hashtags: 0-6 short tags without the # symbol. Only tags the clip actually supports; return [] rather than inventing popularity tags.

Rules:
- Write in the requested language. If none is given, use the language of the transcript.
- Never claim something the clip does not say.
- Keep every field inside the platform's limits; they are given per platform.
- Output strict JSON only, no prose and no Markdown fence:
{"copy":[{"platform":"tiktok","title":"...","description":"...","hashtags":["..."]}]}`;

export type SocialCopyScorer = (input: SocialCopyInput) => Promise<unknown>;

function buildPrompt(input: SocialCopyInput): string {
  const limits = input.platforms
    .map((platform) => {
      const limit = PLATFORM_LIMITS[platform];
      return `- ${platform}: title <= ${limit.title} chars, description <= ${limit.description} chars, up to ${limit.hashtags} hashtags`;
    })
    .join('\n');
  const steer = [
    input.direction ? `User direction: ${input.direction}` : '',
    input.language ? `Language: ${input.language}` : 'Language: match the transcript.',
  ].filter(Boolean).join('\n');
  return `${steer}\n\nPlatform limits:\n${limits}\n\nClip transcript:\n${input.text.slice(0, 6000)}\n\nJSON only.`;
}

async function llmCopy(input: SocialCopyInput): Promise<unknown> {
  const text = await generateAgentText({ maxOutputTokens: 1200, system: SYSTEM, prompt: buildPrompt(input) });
  return parseCopyJson(text);
}

let scorer: SocialCopyScorer = llmCopy;

/** Tests inject a stub here; null restores the real model path. */
export function setSocialCopyScorer(fn: SocialCopyScorer | null): void {
  scorer = fn ?? llmCopy;
}

export function parseCopyJson(text: string): unknown {
  const cleaned = text.replace(/^\s*```[a-zA-Z]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('model reply had no JSON object');
  return JSON.parse(cleaned.slice(start, end + 1));
}

const isPlatform = (value: unknown): value is CopyPlatform =>
  typeof value === 'string' && (COPY_PLATFORMS as readonly string[]).includes(value);

/** Cut at a word boundary when possible, so a clamp never splits a word in half. */
export function clampText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trim();
}

/** "#foo", "  #Foo " and "foo" all become "foo"; duplicates and empties go away. */
export function normalizeHashtags(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const tag = item.replace(/#/g, '').replace(/[^\p{L}\p{N}_]/gu, '').trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

export function clampCopy(
  platform: CopyPlatform,
  raw: { title?: unknown; description?: unknown; hashtags?: unknown },
): PlatformCopy {
  const limit = PLATFORM_LIMITS[platform];
  const title = clampText(typeof raw.title === 'string' ? raw.title : '', limit.title);
  const description = clampText(typeof raw.description === 'string' ? raw.description : '', limit.description);
  const hashtags = normalizeHashtags(raw.hashtags, limit.hashtags);
  return {
    platform,
    title,
    description,
    hashtags,
    titleLength: title.length,
    descriptionLength: description.length,
  };
}

/** No model: the first sentences of the clip, clamped. Better than an empty caption. */
export function fallbackCopy(input: SocialCopyInput): PlatformCopy[] {
  const sentences = input.text.replace(/\s+/g, ' ').trim();
  const firstSentence = sentences.split(/(?<=[.!?])\s+/)[0] ?? sentences;
  return input.platforms.map((platform) => clampCopy(platform, {
    title: firstSentence,
    description: firstSentence,
    hashtags: [],
  }));
}

/**
 * Generate copy for every requested platform. A platform the model skipped gets the
 * fallback, so the caller always receives one entry per platform it asked for.
 */
export async function generateSocialCopy(
  input: SocialCopyInput,
): Promise<{ copy: PlatformCopy[]; modelUsed: boolean }> {
  let raw: unknown = null;
  try {
    raw = await scorer(input);
  } catch {
    raw = null;
  }
  const list = (raw as { copy?: unknown } | null)?.copy;
  const byPlatform = new Map<CopyPlatform, Record<string, unknown>>();
  if (Array.isArray(list)) {
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      if (isPlatform(record.platform)) byPlatform.set(record.platform, record);
    }
  }
  const fallback = new Map(fallbackCopy(input).map((copy) => [copy.platform, copy]));
  const copy = input.platforms.map((platform) => {
    const recorded = byPlatform.get(platform);
    return recorded ? clampCopy(platform, recorded) : fallback.get(platform)!;
  });
  return { copy, modelUsed: byPlatform.size > 0 };
}
