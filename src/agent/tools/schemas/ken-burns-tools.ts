import type { AgentToolSchema } from '../../tool-schema';
import { KEN_BURNS_DIRECTIONS } from '../../../editor/kenBurns';

export const KEN_BURNS_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'apply_ken_burns',
    description:
      'Give a photo motion: a slow zoom in, a zoom out, a pan in one of four directions, or a seeded random move, '
      + 'written as scale/x/y keyframes over the whole clip. Preview and export both sample those keyframes, so no render step is needed. '
      + 'One call is one undo step. It replaces earlier x, y and scale keyframes on that clip and leaves the static transform alone. '
      + 'Use it on stills (images); for video push-ins use edit_item with explicit keyframes. '
      + 'Defaults to the selected clip and a 12% push in.',
    input_schema: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'Image clip to animate. Defaults to the selected clip.' },
        direction: {
          type: 'string',
          enum: [...KEN_BURNS_DIRECTIONS],
          description: 'in, out, left, right, up, down, or random (a stable pick from the clip id unless seed is given). Default in.',
        },
        strength: {
          type: 'number',
          minimum: 0.02,
          maximum: 0.5,
          description: 'Zoom travel as a fraction: 0.12 means 100% to 112%. Pans keep that scale and travel 40% of it. Default 0.12.',
        },
        seed: { type: 'integer', description: 'Only for direction random: the same seed always picks the same move.' },
      },
    },
  },
];

export const KEN_BURNS_TOOL_NAMES = new Set(KEN_BURNS_TOOL_SCHEMAS.map((t) => t.name));
