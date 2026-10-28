import type { AgentToolSchema } from '../../tool-schema';

export const PLATFORM_IMPORT_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'import_from_platform',
    description:
      'Import a YouTube, Vimeo or Bilibili video page into the media pool using the pinned yt-dlp. Real operation: downloads the highest-quality video/audio and streams download progress. Optional startSeconds/endSeconds download only that section; name overrides the asset title. Non-allowlisted hosts are rejected. Use download_media for a direct media file URL.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Platform page URL (youtube.com, youtu.be, vimeo.com, bilibili.com, b23.tv).' },
        startSeconds: { type: 'number', minimum: 0, description: 'Download only from this second (optional).' },
        endSeconds: { type: 'number', minimum: 0, description: 'Download only to this second; must be greater than startSeconds.' },
        name: { type: 'string', description: 'Optional asset name; defaults to the platform title.' },
      },
      required: ['url'],
    },
  },
];

export const PLATFORM_IMPORT_TOOL_NAMES = new Set(PLATFORM_IMPORT_TOOL_SCHEMAS.map((tool) => tool.name));
