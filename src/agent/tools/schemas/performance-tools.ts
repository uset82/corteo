import type { AgentToolSchema } from '../../tool-schema';

export const PERFORMANCE_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'score_performance',
    description:
      'Close the loop on the shorts rubric: paste the CSV a platform exports (score/views/retention per clip) and this '
      + 'reports how each score band actually performed, which band did best, and the lowest score that still beat the '
      + 'average \u2014 the honest candidate for `minScore`. Read-only. '
      + 'It refuses to recommend a threshold from fewer than 12 clips: with six data points the numbers are noise. '
      + 'Use when the user asks "¿acertó la puntuación?", "did the score pick well", or after publishing a batch. '
      + 'Column names are matched loosely (score/potential, views/plays, retention/average view percentage); rows with no '
      + 'score or no views are skipped and counted, never treated as zero.',
    input_schema: {
      type: 'object',
      properties: {
        csv: {
          type: 'string',
          description: 'The CSV text, header included. Comma or semicolon separated, quoted fields supported.',
        },
      },
      required: ['csv'],
    },
  },
];

export const PERFORMANCE_TOOL_NAMES = new Set(PERFORMANCE_TOOL_SCHEMAS.map((t) => t.name));
