export { SOCIAL_COPY_TOOL_SCHEMAS, SOCIAL_COPY_TOOL_NAMES } from './schemas/social-copy-tools';
import type { AgentContext } from '../context';
import { pickTranscribedItem } from '../shorts/transcript-item';
import {
  COPY_PLATFORMS,
  generateSocialCopy,
  setSocialCopyScorer,
  type CopyPlatform,
} from '../shorts/social-copy';

// write_social_copy — OpusClip's create_social_copy_job, local.
//
// Read-only on purpose: the copy is returned for the caller to pass into publish_to_social,
// which already takes title and description. Storing it on the sequence would create a second
// source of truth that drifts the moment the user edits the clip.

export { setSocialCopyScorer };

type Args = Record<string, unknown>;

const DEFAULT_PLATFORMS: CopyPlatform[] = ['tiktok', 'instagram', 'youtube'];
const MAX_TEXT_CHARS = 6000;

const asPlatform = (value: unknown): CopyPlatform | null =>
  typeof value === 'string' && (COPY_PLATFORMS as readonly string[]).includes(value)
    ? value as CopyPlatform
    : null;

export async function execSocialCopyTool(name: string, args: Args, ctx: AgentContext): Promise<unknown> {
  if (name !== 'write_social_copy') return { error: `unknown tool ${name}` };

  const requested = Array.isArray(args.platforms) ? args.platforms : DEFAULT_PLATFORMS;
  const platforms: CopyPlatform[] = [];
  const unknown: string[] = [];
  for (const value of requested) {
    const platform = asPlatform(value);
    if (platform) platforms.push(platform);
    else unknown.push(String(value));
  }
  if (!platforms.length) {
    return {
      error: `Ninguna plataforma válida. Usa una de: ${COPY_PLATFORMS.join(', ')}.`,
      unknown,
    };
  }

  const state = ctx.getState();
  const item = pickTranscribedItem(state.items, typeof args.itemId === 'string' ? args.itemId : undefined);
  if (!item || !item.transcript?.length) {
    return {
      error: 'No hay ningún clip transcrito en esta secuencia. Transcribe primero con transcribe_track '
        + 'o pasa el texto del clip y vuelve a pedir el copy.',
    };
  }

  const words = item.transcript;
  const hasRange = Number.isInteger(args.startWord) && Number.isInteger(args.endWord);
  const from = hasRange ? Math.max(0, Math.min(words.length - 1, Number(args.startWord))) : 0;
  const to = hasRange ? Math.max(from, Math.min(words.length - 1, Number(args.endWord))) : words.length - 1;
  const text = words
    .slice(from, to + 1)
    .map((word) => word.text.trim())
    .join(' ')
    .slice(0, MAX_TEXT_CHARS);

  const { copy, modelUsed } = await generateSocialCopy({
    text,
    platforms,
    direction: typeof args.direction === 'string' ? args.direction : undefined,
    language: typeof args.language === 'string' ? args.language : undefined,
  });

  return {
    ok: true,
    sourceItemId: item.id,
    wordRange: hasRange ? { startWord: from, endWord: to } : null,
    modelUsed,
    copy,
    unknown,
    note: modelUsed
      ? 'Pasa el title y el description elegidos a publish_to_social.'
      : 'Sin modelo: el copy usa la primera frase del clip. Revisa el texto antes de publicar.',
  };
}
