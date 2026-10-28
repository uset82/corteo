import type { AgentToolSchema } from '../../tool-schema';

export const SUBTITLES_TOOL_SCHEMAS: AgentToolSchema[] = [{
  name: 'import_subtitles',
  description: [
    'Import a subtitle file from disk as a manual caption track: SRT, ASS/SSA or WebVTT.',
    'The format comes from the file extension unless `format` says otherwise.',
    'ASS/SSA karaoke lines (\\k, \\kf, \\K, \\ko) keep their per-syllable timings, so the captions light up word by word; SRT and VTT cues become one timed caption per cue.',
    'Without captionTrackId the subtitles get a new caption track named after the file; with one they are added to that track as another lane. Captions are turned on either way.',
    'Use it when the user brings their own subtitles or lyrics file instead of transcribing the song; read the result with read_captions.',
  ].join(' '),
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path of the subtitle file.' },
      format: {
        type: 'string',
        enum: ['srt', 'ass', 'vtt'],
        description: 'Subtitle format. Default: from the file extension (.ssa counts as ass).',
      },
      captionTrackId: {
        type: 'string',
        description: 'Existing caption track to add the subtitles to. Omit to create a new caption track.',
      },
    },
    required: ['path'],
    additionalProperties: false,
  },
}];

export const SUBTITLES_TOOL_NAMES = new Set(SUBTITLES_TOOL_SCHEMAS.map((tool) => tool.name));
