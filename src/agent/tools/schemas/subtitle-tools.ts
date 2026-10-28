import type { AgentToolSchema } from '../../tool-schema';

export const SUBTITLE_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'import_subtitles',
    description:
      'Import SRT, ASS/SSA or WebVTT subtitles into a new caption track on the active sequence. ASS karaoke tags (\\k, \\kf, \\ko) become word-level timing, so the verse/chorus styles light up word by word in preview and export. One undo step. Pass the file content as text; format is inferred when omitted.',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The subtitle file text (SRT, ASS/SSA or VTT).' },
        format: { type: 'string', enum: ['srt', 'ass', 'vtt'], description: 'Explicit format; inferred from the content when omitted.' },
        name: { type: 'string', description: 'Caption track name (default "Subtítulos").' },
      },
      required: ['content'],
    },
  },
];

export const SUBTITLE_TOOL_NAMES = new Set(SUBTITLE_TOOL_SCHEMAS.map((tool) => tool.name));
