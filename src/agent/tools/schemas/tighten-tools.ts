import type { AgentToolSchema } from '../../tool-schema';

export const TIGHTEN_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'tighten_speech',
    description:
      'Tighten a transcribed clip: remove filler words ("eh", "este", "o sea", "¿no?"), false starts and long '
      + 'pauses, the way OpusClip\'s Speech Cleanup does. Two steps, always: the first call returns the review list '
      + '(which words and which pauses, with timestamps and the time recovered) and edits NOTHING; only after the user '
      + 'approves, call again with apply:true. The edit runs through clean_script, so it is ONE undo step, and it never '
      + 'lengthens a pause beyond the silence already in the recording. '
      + 'Use when the user says "aprieta el habla", "quita las muletillas", "tighten this", "remove the ums". '
      + 'For silence only, prefer remove_silence; for word-level cuts, read_script / apply_script.',
    input_schema: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'Transcribed clip to tighten. Defaults to the clip with the most transcript words.' },
        apply: { type: 'boolean', description: 'Omit (or false) for the review list. true applies it after the user approves.' },
        minPauseMs: { type: 'number', description: 'Pauses longer than this are compressed to it. Default 400.' },
        extraFillers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Extra filler words for this speaker, matched case- and punctuation-insensitively.',
        },
        cutPadMs: { type: 'number', minimum: 0, maximum: 500, description: 'Breathing room kept around each removed word. Default 0 (cut on the boundary).' },
      },
    },
  },
];

export const TIGHTEN_TOOL_NAMES = new Set(TIGHTEN_TOOL_SCHEMAS.map((t) => t.name));
