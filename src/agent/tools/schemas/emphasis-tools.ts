import type { AgentToolSchema } from '../../tool-schema';

export const EMPHASIS_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'emphasize_keywords',
    description:
      'Emphasise the words that carry the numbers: figures, names and shouted words get the caption highlight colour, '
      + 'so the eye lands on "300" and "Valeria" instead of on every adjective. This is OpusClip\u2019s AI Keywords, '
      + 'decided from the transcript rather than guessed by a model. '
      + 'Works on the caption data of the active timeline; one undo step. Call with apply:false first when the user has not '
      + 'seen the list \u2014 it returns the candidates and their reasons and changes nothing. '
      + 'Captions must be on (edit_captions action=enable). Emphasis composes with existing per-word overrides and never '
      + 'overrides the active-word highlight while a word is being spoken.',
    input_schema: {
      type: 'object',
      properties: {
        max: { type: 'integer', minimum: 1, maximum: 30, description: 'How many words to emphasise at most. Default 8.' },
        apply: { type: 'boolean', description: 'Default true. false only returns the candidates, for a preview.' },
      },
    },
  },
];

export const EMPHASIS_TOOL_NAMES = new Set(EMPHASIS_TOOL_SCHEMAS.map((t) => t.name));
