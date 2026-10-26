import type { AgentToolSchema } from '../../tool-schema';
import { MUSIC_REACTIONS, MUSIC_REACTION_TIMINGS } from '../../../editor/musicReactions';

const TARGET_PROPERTIES = {
  itemId: {
    type: 'string',
    description: 'Timeline audio/video clip id (unique prefix accepted). Its media-pool asset and trim/speed mapping are used.',
  },
  assetId: {
    type: 'string',
    description: 'Media-pool asset id (unique prefix accepted). Use itemId instead when timeline mapping is needed.',
  },
} as const;

const PLAN_PROPERTIES = {
  itemId: {
    type: 'string',
    description: 'BGM timeline audio/video clip id (unique prefix accepted).',
  },
  timing: {
    type: 'string',
    enum: ['auto', 'beat', 'downbeat', 'section'],
    description: 'Cut timing. auto chooses section/downbeat/beat deterministically from density and available analysis.',
  },
  density: {
    type: 'string',
    enum: ['sparse', 'medium', 'dense'],
    description: 'How many analyzed timing points to retain.',
  },
  fromFrame: {
    type: 'number',
    minimum: 0,
    description: 'Optional inclusive timeline-frame range start; defaults to the BGM clip start.',
  },
  toFrame: {
    type: 'number',
    minimum: 1,
    description: 'Optional exclusive timeline-frame range end; defaults to the BGM clip end.',
  },
  targetItemIds: {
    type: 'array',
    items: { type: 'string' },
    maxItems: 64,
    description: 'Optional video clip ids/prefixes to constrain targets. Defaults to video clips overlapping the range.',
  },
} as const;

const IMAGE_PLAN_PROPERTIES = {
  itemId: {
    type: 'string',
    description: 'BGM timeline audio/video clip id (unique prefix accepted).',
  },
  timing: {
    type: 'string',
    enum: ['auto', 'beat', 'downbeat', 'section'],
    description: 'Photo-change timing. auto chooses section/downbeat/beat deterministically from density and available analysis.',
  },
  density: {
    type: 'string',
    enum: ['sparse', 'medium', 'dense'],
    description: 'How many analyzed timing points to retain.',
  },
  fromFrame: {
    type: 'number',
    minimum: 0,
    description: 'Optional inclusive timeline-frame range start; defaults to the BGM clip start.',
  },
  toFrame: {
    type: 'number',
    minimum: 1,
    description: 'Optional exclusive timeline-frame range end; defaults to the BGM clip end.',
  },
  imageAssetIds: {
    type: 'array',
    items: { type: 'string' },
    maxItems: 64,
    description: 'Optional image asset ids/prefixes in display order. Defaults to all image assets in media-pool order and cycles when needed.',
  },
  track: {
    type: 'string',
    description: 'Optional target video track id or alias, default V1. The target range must be empty and unlocked.',
  },
} as const;

const REACTION_PROPERTIES = {
  itemId: {
    type: 'string',
    description: 'BGM timeline audio/video clip id (unique prefix accepted). Its trim and speed map song time onto the target clips.',
  },
  targetItemIds: {
    type: 'array',
    items: { type: 'string' },
    maxItems: 64,
    description: 'Optional visual clip ids/prefixes to animate. Defaults to every non-audio clip overlapping the BGM range.',
  },
  reaction: {
    type: 'string',
    enum: [...MUSIC_REACTIONS],
    description: 'pulso (scale bump on beats), golpe (punch-in on drops), temblor (shake on accents), destello (brightness flash), respirar (saturation/blur follow energy), ken-burns-al-ritmo (zoom whose speed follows section energy).',
  },
  timing: {
    type: 'string',
    enum: [...MUSIC_REACTION_TIMINGS],
    description: 'Analysis points that drive the reaction. Defaults per reaction: pulso=beats, golpe=drops, temblor=accents, destello=downbeats, respirar=energy, ken-burns-al-ritmo=sections.',
  },
  intensity: {
    type: 'number',
    minimum: 0,
    maximum: 1,
    description: 'Motion amount, 0..1. Default 0.5; amplitudes scale with the local section energy too.',
  },
  fromFrame: {
    type: 'number',
    minimum: 0,
    description: 'Optional inclusive timeline-frame range start; defaults to the BGM clip start.',
  },
  toFrame: {
    type: 'number',
    minimum: 1,
    description: 'Optional exclusive timeline-frame range end; defaults to the BGM clip end.',
  },
  seed: {
    type: ['string', 'number'],
    description: 'Optional deterministic seed for ken-burns-al-ritmo direction. Defaults to the songMapRef.',
  },
} as const;

const SONG_MAP_REF_PROPERTY = {
  type: 'string',
  description: 'Opaque songMapRef from music_reaction_plan. Applying rejects a missing or stale ref.',
} as const;

export const MUSIC_INTELLIGENCE_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'analyze_music',
    description: [
      'Run the installed on-device Beat This + CLAP models for a media-pool asset or timeline clip and wait for completion.',
      'Returns compact BPM, meter, confidence, tags, sections, and bounded beat/downbeat points; embeddings are never exposed.',
      'Reuses a valid cache by default; set force to recompute. This tool never downloads model packs or edits the timeline.',
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: {
        ...TARGET_PROPERTIES,
        force: { type: 'boolean', description: 'Recompute even when a valid cached analysis exists. Defaults to false.' },
        optional: { type: 'boolean', description: 'When true, missing packs or an analysis failure returns available=false so a larger edit can continue with simpler audio evidence. Invalid targets still fail.' },
      },
    },
  },
  {
    name: 'inspect_music',
    description: [
      'Read an already-cached local Beat This + CLAP analysis for a media-pool asset or timeline clip.',
      'Returns compact BPM, meter, confidence, tags, sections, and bounded beat/downbeat points; embeddings are never exposed.',
      'This tool never starts analysis or downloads models. If no cache exists it explains how to install the required packs and analyze first.',
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: {
        ...TARGET_PROPERTIES,
        fromMs: { type: 'number', minimum: 0, description: 'Optional source-millisecond range start.' },
        toMs: { type: 'number', minimum: 1, description: 'Optional exclusive source-millisecond range end.' },
      },
    },
  },
  {
    name: 'listen_to_song',
    description: [
      'Listen to a song and report what it sounds like: a Spanish summary plus compact JSON with tempo, key, sections and moods, drops/breaks/accents, energy and bass curves, lyric lines and chorus candidates.',
      'Returns a saved songMapRef and, when the server runtime can draw them, the song-map PNG and a spectrogram as images. Text and pictures still answer without the model packs, using DSP beats and energy sections.',
      'Reuses a cached Beat This + CLAP analysis and never edits the timeline. Use it before choosing music-driven cuts, reactions or looks.',
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: {
        ...TARGET_PROPERTIES,
        fromMs: { type: 'number', minimum: 0, description: 'Optional source-millisecond range start; the whole song by default.' },
        toMs: { type: 'number', minimum: 1, description: 'Optional exclusive source-millisecond range end.' },
        pictures: { type: 'boolean', description: 'Include the song-map and spectrogram images. Defaults to true; text data is still returned when a picture cannot be drawn.' },
        relay: { type: 'boolean', description: 'Run the optional real-ear relay: one paid OpenRouter call that asks a hearing model for timbre, vocal emotion, arrangement and the emotional arc. Defaults to false and only works when OPENCHATCUT_LISTEN_RELAY=openrouter and OPENROUTER_API_KEY are set.' },
      },
    },
  },
  {
    name: 'music_edit_plan',
    description: [
      'Build a deterministic, read-only cut plan from cached music analysis, the BGM clip trim/speed mapping, and overlapping video clips.',
      'Returns a bounded frame plan and opaque analysisRef without embeddings or unbounded analysis arrays.',
      'Call this to inspect the proposed rhythm edit before sync_cuts_to_music.',
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: PLAN_PROPERTIES,
      required: ['itemId', 'timing', 'density'],
    },
  },
  {
    name: 'sync_cuts_to_music',
    description: [
      'Recompute a cached music cut plan at execution time and split only unlocked video clips at its planned frames.',
      'Pass the analysisRef returned by music_edit_plan to reject stale analysis. All splits are one EditorCommands batch and one undo step.',
      'This never starts analysis and never edits the BGM clip itself.',
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: {
        ...PLAN_PROPERTIES,
        analysisRef: {
          type: 'string',
          description: 'Opaque ref from music_edit_plan. Execution rejects missing or stale analysis.',
        },
      },
      required: ['itemId', 'timing', 'density', 'analysisRef'],
    },
  },
  {
    name: 'music_image_plan',
    description: [
      'Build a deterministic, read-only photo placement plan from cached music analysis and the BGM clip trim/speed mapping.',
      'The plan fills the requested range with media-pool images, changing images at beat/downbeat/section boundaries and cycling the selected image order.',
      'Call this before sync_images_to_music so the user can review the bounded placement plan. This tool never starts analysis.',
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: IMAGE_PLAN_PROPERTIES,
      required: ['itemId', 'timing', 'density'],
    },
  },
  {
    name: 'sync_images_to_music',
    description: [
      'Recompute a cached music image plan and add one image clip per planned beat interval.',
      'Pass the analysisRef returned by music_image_plan to reject stale analysis. All image additions are one EditorCommands batch and one undo step.',
      'The target video track must be unlocked and empty in the requested range; this never starts analysis and never edits the BGM clip.',
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: {
        ...IMAGE_PLAN_PROPERTIES,
        analysisRef: {
          type: 'string',
          description: 'Opaque ref from music_image_plan. Execution rejects missing or stale analysis.',
        },
      },
      required: ['itemId', 'timing', 'density', 'analysisRef'],
    },
  },
  {
    name: 'music_reaction_plan',
    description: [
      'Build a deterministic, read-only plan for music-driven motion on visual clips: keyframe counts and sample frames, without editing the timeline.',
      'The BGM clip trim and speed map song beats, downbeats, accents, drops, sections or the energy curve onto each target clip, and amplitudes follow the local section energy.',
      'Returns the songMapRef that apply_music_reaction requires. This tool never starts analysis.',
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: { ...REACTION_PROPERTIES },
      required: ['itemId', 'reaction'],
    },
  },
  {
    name: 'apply_music_reaction',
    description: [
      'Recompute a music reaction plan and write its transform or filter keyframes on the target visual clips as one EditorCommands batch (one undo step).',
      'Pass the songMapRef returned by music_reaction_plan to reject stale analysis; locked tracks are skipped and reported.',
      'Applying a reaction replaces earlier music reactions that animate the same properties on those clips. This never starts analysis and never edits the BGM clip.',
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: { ...REACTION_PROPERTIES, songMapRef: SONG_MAP_REF_PROPERTY },
      required: ['itemId', 'reaction', 'songMapRef'],
    },
  },
  {
    name: 'clear_music_reaction',
    description: [
      'Remove music-driven motion from the target clips in one EditorCommands batch: the reaction metadata goes away and the keyframe properties it owned are cleared unless another remaining reaction still uses them.',
      'Omit reaction to clear every music reaction on the targets. Pass songMapRef to reject a stale song map; clearing still works without it.',
      'Locked tracks are skipped and reported.',
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: {
        itemId: REACTION_PROPERTIES.itemId,
        targetItemIds: REACTION_PROPERTIES.targetItemIds,
        reaction: {
          type: 'string',
          enum: [...MUSIC_REACTIONS],
          description: 'Optional reaction to remove. Omit to remove every music reaction from the targets.',
        },
        fromFrame: REACTION_PROPERTIES.fromFrame,
        toFrame: REACTION_PROPERTIES.toFrame,
        songMapRef: {
          type: 'string',
          description: 'Optional songMapRef from music_reaction_plan; when present it must match the current map.',
        },
      },
      required: ['itemId'],
    },
  },
];

export const MUSIC_INTELLIGENCE_TOOL_NAMES = new Set(
  MUSIC_INTELLIGENCE_TOOL_SCHEMAS.map((tool) => tool.name),
);
