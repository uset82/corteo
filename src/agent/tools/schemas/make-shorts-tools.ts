import type { AgentToolSchema } from '../../tool-schema';

export const MAKE_SHORTS_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'make_shorts',
    description:
      'Turn one transcribed long video into finished short clips in a single call: score the strongest moments, '
      + 'cut each into its own sequence at the target ratio, optionally turn captions on and apply a caption style, '
      + 'optionally reframe on the subject, and optionally queue a 480p preview render per clip. '
      + 'Use when the user says "hazme shorts", "corta esto en clips", "saca 5 clips de este vídeo", '
      + '"turn this into shorts" or wants clips rather than a ranking. '
      + 'For the ranking alone (no cutting) use score_moments; for a single clip use find_highlights. '
      + 'Each returned clip carries its 0-99 score, sequence id, caption and reframe state, and a renderId when a '
      + 'render was queued — poll those with track_export. The source clip must be transcribed first with transcribe_track. '
      + 'Reframe needs a browser tab; without one the clips are cut and centred instead, and the result says so.',
    input_schema: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'Transcribed video/audio clip to cut. Defaults to the clip with the most transcript words.' },
        count: { type: 'integer', description: 'How many clips to create. Default 5, max 10.' },
        minSeconds: { type: 'number', description: 'Shortest clip. Default 12.' },
        maxSeconds: { type: 'number', description: 'Longest clip. Default 90.' },
        ratio: { type: 'string', enum: ['9:16', '16:9', '1:1', '4:3', '3:4'], description: 'Target canvas. Default 9:16.' },
        minScore: { type: 'number', description: 'Only cut moments at or above this score (0-99). Default 55, the publishable line.' },
        direction: {
          type: 'string',
          description: 'Free-text steering in the user\u2019s words (for example "lo más divertido"). It steers which moments win, never the render settings.',
        },
        topic: { type: 'string', description: 'Optional: only moments about this topic.' },
        genre: {
          type: 'string',
          enum: ['auto', 'podcast', 'interview', 'tutorial', 'vlog', 'livestream'],
          description: 'Content-type prior for the rubric. Default auto.',
        },
        calibration: {
          type: 'boolean',
          description: 'Apply the weights learned from this profile\'s approve/reject decisions (default false). '
            + 'Needs 12 decisions; otherwise it is a no-op.',
        },
        captionsPreset: { type: 'string', description: 'Caption preset to turn on for every clip (omit to leave captions untouched).' },
        captionMotion: {
          type: 'string',
          enum: ['none', 'fade-up', 'pop', 'word-pop', 'karaoke-pulse'],
          description: 'Optional caption motion preset applied after the style.',
        },
        reframe: { type: 'boolean', description: 'Reframe on the subject per clip (default true). False keeps the source framing.' },
        render: {
          type: 'string',
          enum: ['none', 'previews'],
          description: 'none (default) cuts only; previews also queues a 480p MP4 per clip and returns renderIds.',
        },
      },
    },
  },
];

export const MAKE_SHORTS_TOOL_NAMES = new Set(MAKE_SHORTS_TOOL_SCHEMAS.map((t) => t.name));
