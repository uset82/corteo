// Song events mapped onto clips (Plan 2 › L-09): the event pickers for every
// timing and the BGM trim/speed mapping. Kept apart from the curve generators so
// each file stays under the 500-line ceiling.
import type { MusicAnalysis } from '../audio/intelligence/types';
import { localFrameForSourceMs } from './sourceLimit';
import type { MusicReactionTiming, TimelineItem } from './types';

export type ReactionAnalysis = Pick<MusicAnalysis, 'durationMs' | 'beatsMs' | 'downbeatsMs' | 'sections'>;

export interface ReactionEventFrame {
  /** Frame inside the target clip. */
  readonly frame: number;
  readonly strength: number;
}

export interface ReactionEvent {
  readonly timeMs: number;
  readonly strength: number;
}

export const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);

export function energyAt(analysis: ReactionAnalysis, timeMs: number): number {
  let previous: number | undefined;
  for (const section of analysis.sections) {
    if (timeMs >= section.fromMs && timeMs < section.toMs) return clamp01(section.energy);
    if (section.toMs <= timeMs) previous = section.energy;
  }
  return previous === undefined ? 0.5 : clamp01(previous);
}

function withStrength(analysis: ReactionAnalysis, timesMs: readonly number[]): ReactionEvent[] {
  return timesMs.map((timeMs) => ({ timeMs, strength: 0.35 + 0.65 * energyAt(analysis, timeMs) }));
}

export function reactionEvents(analysis: ReactionAnalysis, timing: MusicReactionTiming): ReactionEvent[] {
  if (timing === 'beats') return withStrength(analysis, analysis.beatsMs);
  if (timing === 'downbeats') return withStrength(analysis, analysis.downbeatsMs);

  const starts = analysis.sections.map((section, index) => ({
    timeMs: section.fromMs,
    energy: clamp01(section.energy),
    previousEnergy: index > 0 ? clamp01(analysis.sections[index - 1]!.energy) : 0,
    role: section.role,
  }));

  if (timing === 'sections') {
    return starts.map((start) => ({ timeMs: start.timeMs, strength: 0.3 + 0.7 * start.energy }));
  }
  if (timing === 'accents') {
    const events: ReactionEvent[] = withStrength(analysis, analysis.downbeatsMs)
      .filter((event) => event.strength >= 0.6);
    for (const start of starts) {
      if (start.energy >= 0.7) events.push({ timeMs: start.timeMs, strength: start.energy });
    }
    return dedupeEvents(events);
  }
  if (timing === 'drops') {
    const events: ReactionEvent[] = [];
    for (const start of starts) {
      const increase = start.energy - start.previousEnergy;
      if (start.role === 'peak' || increase >= 0.12) {
        events.push({ timeMs: start.timeMs, strength: clamp01(0.45 + Math.max(0, increase) * 1.2) });
      }
    }
    return dedupeEvents(events);
  }
  const stepMs = Math.max(500, Math.ceil(analysis.durationMs / 240 / 500) * 500);
  const events: ReactionEvent[] = [];
  for (let timeMs = 0; timeMs < analysis.durationMs; timeMs += stepMs) {
    events.push({ timeMs, strength: energyAt(analysis, timeMs) });
  }
  return events;
}

function dedupeEvents(events: readonly ReactionEvent[]): ReactionEvent[] {
  const byTime = new Map<number, ReactionEvent>();
  for (const event of events) {
    const key = Math.round(event.timeMs);
    const existing = byTime.get(key);
    if (!existing || event.strength > existing.strength) byTime.set(key, event);
  }
  return [...byTime.values()].sort((left, right) => left.timeMs - right.timeMs);
}

/** Maps song events into a clip, keeping the trim/speed mapping of the BGM item. */
export function clipEventFrames(
  events: readonly ReactionEvent[],
  target: TimelineItem,
  musicItem: TimelineItem,
  fps: number,
  range: { readonly fromFrame: number; readonly toFrame: number },
): ReactionEventFrame[] {
  const seen = new Set<number>();
  const frames: ReactionEventFrame[] = [];
  for (const event of events) {
    const local = localFrameForSourceMs(musicItem, event.timeMs, fps);
    if (local === null) continue;
    const timelineFrame = musicItem.startFrame + local;
    if (timelineFrame < range.fromFrame || timelineFrame >= range.toFrame) continue;
    const frame = timelineFrame - target.startFrame;
    if (frame < 1 || frame >= target.durationInFrames || seen.has(frame)) continue;
    seen.add(frame);
    frames.push({ frame, strength: clamp01(event.strength) });
  }
  return frames;
}
