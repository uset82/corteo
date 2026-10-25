import type { AgentToolSchema } from '../../tool-schema';

export const HEADLINE_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'write_clip_title',
    description:
      'Write the auto headline for a short clip: one hook line of at most six words, added as a title clip on the top '
      + 'video track at the start of the moment. Uses the free model for the wording and falls back to the clip\u2019s own '
      + 'opening phrase, so a publish is never blocked. One undo step removes it. '
      + 'Use when the user says "ponle un titular", "add a headline", "título para el short", or as the last packaging '
      + 'step after make_shorts. Not a summary: the line has to make someone stop. '
      + 'The clip must be transcribed first; pass the word range so the headline is about that moment.',
    input_schema: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'Transcribed clip the headline is about. Defaults to the clip with the most transcript words.' },
        startWord: { type: 'integer', minimum: 0, description: 'First word of the moment (inclusive). Omit for the whole clip.' },
        endWord: { type: 'integer', minimum: 0, description: 'Last word of the moment (inclusive). Omit for the whole clip.' },
        maxWords: { type: 'integer', minimum: 2, maximum: 10, description: 'Longest headline in words. Default 6.' },
        fontSize: { type: 'number', minimum: 24, maximum: 200, description: 'Title size in canvas pixels. Default 72, readable on 9:16.' },
        seconds: { type: 'number', minimum: 1, maximum: 15, description: 'How long the headline stays on screen. Default 4.' },
        apply: { type: 'boolean', description: 'Default true. false only returns the wording, for a preview in chat.' },
      },
    },
  },
];

export const HEADLINE_TOOL_NAMES = new Set(HEADLINE_TOOL_SCHEMAS.map((t) => t.name));
