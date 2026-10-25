// Inspection projection shared by the browser music tools and the headless
// MCP/CLI runner. Keeping one implementation means analyze_music answers with
// the same fields whether a tab is open or not.
import type { TimelineItem } from '../../editor/types';
import {
  sourceFramesToTimelineFrames,
  sourceWindowForTimelineRange,
} from '../../editor/sourceLimit';
import type { MusicAnalysis } from './types';

const MAX_INSPECT_BEATS = 48;
const MAX_INSPECT_DOWNBEATS = 24;
const MAX_INSPECT_SECTIONS = 16;
const MAX_INSPECT_TAGS = 12;

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function inspectRange(args: Record<string, unknown>, durationMs: number): { fromMs: number; toMs: number } {
  const fromMs = Math.max(0, Math.round(finiteNumber(args.fromMs) ?? 0));
  const toMs = Math.min(durationMs, Math.round(finiteNumber(args.toMs) ?? durationMs));
  if (toMs <= fromMs) throw new Error('toMs must be greater than fromMs after clamping to the analyzed duration');
  return { fromMs, toMs };
}

function inMsRange(value: number, range: { fromMs: number; toMs: number }): boolean {
  return value >= range.fromMs && value < range.toMs;
}

function roundedTags(analysis: MusicAnalysis): Array<Record<string, unknown>> {
  return [...analysis.tags]
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, MAX_INSPECT_TAGS)
    .map((tag) => ({ kind: tag.kind, label: tag.label, score: Number(tag.score.toFixed(3)) }));
}

function listedSections(analysis: MusicAnalysis, range: { fromMs: number; toMs: number }) {
  return analysis.sections
    .filter((section) => section.toMs > range.fromMs && section.fromMs < range.toMs)
    .slice(0, MAX_INSPECT_SECTIONS)
    .map((section) => ({
      fromMs: section.fromMs,
      toMs: section.toMs,
      role: section.role,
      energy: Number(section.energy.toFixed(3)),
      confidence: Number(section.boundaryConfidence.toFixed(3)),
    }));
}

export function mapSourceMsToTimelineFrame(ms: number, item: TimelineItem, fps: number): number | null {
  const window = sourceWindowForTimelineRange(item, 0, item.durationInFrames);
  const sourceFrame = (ms / 1000) * fps;
  if (sourceFrame <= window.startFrame || sourceFrame >= window.endFrame) return null;
  const local = Math.round(sourceFramesToTimelineFrames(item, sourceFrame - window.startFrame));
  if (local <= 0 || local >= item.durationInFrames) return null;
  return item.startFrame + local;
}

export function mapSourcePoints(pointsMs: readonly number[], item: TimelineItem, fps: number): number[] {
  const frames = pointsMs.flatMap((ms) => {
    const frame = mapSourceMsToTimelineFrame(ms, item, fps);
    return frame === null ? [] : [frame];
  });
  return [...new Set(frames)].sort((a, b) => a - b);
}

function inspectPointList(
  values: readonly number[],
  item: TimelineItem | undefined,
  fps: number,
  range: { fromMs: number; toMs: number },
  cap: number,
): number[] {
  const filtered = values.filter((value) => inMsRange(value, range));
  return item ? mapSourcePoints(filtered, item, fps).slice(0, cap) : filtered.slice(0, cap);
}

export interface InspectMusicAnalysisInput {
  readonly analysis: MusicAnalysis;
  readonly analysisRef: string;
  readonly args: Record<string, unknown>;
  readonly item?: TimelineItem;
  readonly fps: number;
}

export function inspectMusicAnalysis(input: InspectMusicAnalysisInput): Record<string, unknown> {
  const { analysis, analysisRef, args, item, fps } = input;
  const range = inspectRange(args, analysis.durationMs);
  const beatPoints = analysis.beatsMs.filter((value) => inMsRange(value, range));
  const downbeatPoints = analysis.downbeatsMs.filter((value) => inMsRange(value, range));
  return {
    assetId: analysis.assetId,
    ...(item ? { itemId: item.id } : {}),
    analysisRef,
    bpm: Number(analysis.bpm.toFixed(2)),
    meter: analysis.meter,
    confidence: Number(analysis.beatConfidence.toFixed(3)),
    durationMs: analysis.durationMs,
    range,
    pointUnit: item ? 'timelineFrame' : 'sourceMs',
    beatCount: beatPoints.length,
    downbeatCount: downbeatPoints.length,
    beats: inspectPointList(analysis.beatsMs, item, fps, range, MAX_INSPECT_BEATS),
    downbeats: inspectPointList(analysis.downbeatsMs, item, fps, range, MAX_INSPECT_DOWNBEATS),
    sections: listedSections(analysis, range),
    sectionCount: analysis.sections.filter((section) => section.toMs > range.fromMs && section.fromMs < range.toMs).length,
    tags: roundedTags(analysis),
    truncated: beatPoints.length > MAX_INSPECT_BEATS
      || downbeatPoints.length > MAX_INSPECT_DOWNBEATS
      || analysis.sections.length > MAX_INSPECT_SECTIONS
      || analysis.tags.length > MAX_INSPECT_TAGS,
  };
}
