import type { AgentToolSchema } from '../../tool-schema';

export const SOCIAL_COPY_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'write_social_copy',
    description:
      'Write the copy a finished clip needs to be posted: a title, a short description and a few hashtags, per platform, '
      + 'each clamped to that platform\u2019s real limits. Read-only: it never edits the timeline and never publishes. '
      + 'Use after the clip exists and before publish_to_social, then pass the chosen title and description straight into '
      + 'publish_to_social. Prefer the clip\u2019s own word range so the copy is about that moment and not the whole source. '
      + 'Without a model it still returns the clip\u2019s opening sentence as the title, with modelUsed:false, so a publish '
      + 'is never blocked by copy generation.',
    input_schema: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'Transcribed clip the copy is about. Defaults to the clip with the most transcript words.' },
        startWord: { type: 'integer', minimum: 0, description: 'First word of the moment (inclusive). Omit for the whole clip.' },
        endWord: { type: 'integer', minimum: 0, description: 'Last word of the moment (inclusive). Omit for the whole clip.' },
        platforms: {
          type: 'array',
          items: { type: 'string', enum: ['tiktok', 'instagram', 'youtube', 'linkedin', 'facebook', 'x', 'threads', 'pinterest', 'bluesky'] },
          minItems: 1,
          description: 'Platforms to write for. Defaults to tiktok, instagram and youtube.',
        },
        direction: { type: 'string', description: 'Tone and call to action in the user\u2019s words (for example "tono cercano, invita a comentar").' },
        language: { type: 'string', description: 'Language for the copy. Default: the language of the transcript.' },
      },
    },
  },
];

export const SOCIAL_COPY_TOOL_NAMES = new Set(SOCIAL_COPY_TOOL_SCHEMAS.map((t) => t.name));
