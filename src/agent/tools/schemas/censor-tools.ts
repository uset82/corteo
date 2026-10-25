import type { AgentToolSchema } from '../../tool-schema';

export const CENSOR_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'censor_words',
    description:
      'Find and mute profanity in a transcribed clip. Two steps, always: the first call returns the hit list '
      + '(word, time, how long the mute lasts) and edits NOTHING; after the user approves, call again with apply:true. '
      + 'Applying writes volume keyframes (0 across the word, back to the clip volume after it) as ONE undo step, so the '
      + 'cut is untouched and the mute can be removed later. '
      + 'Use when the user says "censura las palabrotas", "censor this", "bleep the swearing". '
      + 'Only the mute mode exists: a bleep tone or burned-in **** would need a tone asset or a caption run, which this '
      + 'tool does not create. The clip must be transcribed first.',
    input_schema: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'Transcribed clip. Defaults to the clip with the most transcript words.' },
        apply: { type: 'boolean', description: 'Omit (or false) for the hit list. true applies the mutes after the user approves.' },
        extraWords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Extra words to censor for this speaker or context.',
        },
        padMs: {
          type: 'number',
          minimum: 0,
          maximum: 500,
          description: 'Extra mute on each side of the word, for a hard consonant the ASR clipped. Default 0.',
        },
      },
    },
  },
];

export const CENSOR_TOOL_NAMES = new Set(CENSOR_TOOL_SCHEMAS.map((t) => t.name));
