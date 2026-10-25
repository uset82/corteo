import type { AgentToolSchema } from '../../tool-schema';

export const SHORTS_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'score_moments',
    description:
      'Score candidate moments in one transcribed long video so the best ones can be cut into shorts. '
      + 'Segments the transcript into chapters, builds sentence-aligned windows inside each chapter, measures them '
      + '(hook, flow, value, sound) and has the model judge hook/flow/value, then returns one ranked list with a '
      + '0-99 score, four sub-scores, a reason and risk flags per moment, plus the candidates it rejected and why. '
      + 'Use before find_highlights, or when the user asks "which parts are worth posting", "puntúa los momentos", '
      + '"find the best moments" or wants a ranking rather than clips. '
      + 'This is a transparent rubric, NOT a model trained on platform performance: treat the score as a ranking '
      + 'signal and prefer the reasons. Read-only: it never edits the timeline. '
      + 'The clip must be transcribed first with transcribe_track. Needs a browser tab (reads the live project).',
    input_schema: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          description: 'Transcribed video/audio clip to analyse. Defaults to the clip with the most transcript words.',
        },
        count: {
          type: 'integer',
          description: 'How many passing moments to return, best first. Default 8, max 20.',
        },
        minSeconds: { type: 'number', description: 'Shortest acceptable moment. Default 12.' },
        maxSeconds: { type: 'number', description: 'Longest acceptable moment. Default 90.' },
        direction: {
          type: 'string',
          description: 'Free-text steering from the user, in their words (for example "lo más divertido" or '
            + '"the part about pricing"). It steers which moments win, never the render settings.',
        },
        topic: { type: 'string', description: 'Optional: only moments about this topic.' },
        genre: {
          type: 'string',
          enum: ['auto', 'podcast', 'interview', 'tutorial', 'vlog', 'livestream'],
          description: 'Content-type prior for the rubric. Default auto (the model classifies it first).',
        },
      },
    },
  },
];

export const SHORTS_TOOL_NAMES = new Set(SHORTS_TOOL_SCHEMAS.map((t) => t.name));
