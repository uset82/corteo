import type { Dimensions, DimensionKey } from './types';

/**
 * Calibration: the honest version of OpusClip's "learns what your team publishes".
 *
 * Opus trains on platform performance. We have no such feed, so this learns from the one
 * signal a local editor really has — the user's own approve/reject decisions on scored
 * moments — and it only nudges the four weights the rubric already uses. Under twelve
 * decisions it returns identity weights and says it is not sure yet.
 *
 * Storage is the browser profile (the same place caption presets live), not a server table:
 * the editor is single-user and local, and a second database for twelve numbers would be
 * infrastructure without a reason.
 */

export type Decision = 'approved' | 'rejected';

export interface CalibrationEntry {
  at: number;
  projectId: string;
  sourceId: string;
  startWord: number;
  endWord: number;
  startMs: number;
  endMs: number;
  score: number;
  subscores: Dimensions;
  decision: Decision;
}

export interface CalibrationWeights {
  hook: number;
  flow: number;
  value: number;
  sound: number;
}

export const IDENTITY_WEIGHTS: CalibrationWeights = { hook: 1, flow: 1, value: 1, sound: 1 };

/** Below this many decisions the weights stay at identity. */
export const MIN_DECISIONS = 12;
/** And each side needs at least this many, or the gap is noise. */
const MIN_PER_SIDE = 5;
const MAX_ENTRIES = 500;
const STORAGE_KEY = 'cc.shorts.calibration';

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Private mode or a hardened profile: calibration is optional, never fatal.
  }
  return null;
}

let storageOverride: StorageLike | null = null;

/** Tests inject a fake storage here; null restores the browser's. */
export function setCalibrationStorage(storage: StorageLike | null): void {
  storageOverride = storage;
}

function storage(): StorageLike | null {
  return storageOverride ?? defaultStorage();
}

export function loadDecisions(): CalibrationEntry[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is CalibrationEntry => (
      !!entry
      && typeof entry === 'object'
      && typeof (entry as CalibrationEntry).decision === 'string'
      && typeof (entry as CalibrationEntry).score === 'number'
      && !!(entry as CalibrationEntry).subscores
    ));
  } catch {
    return [];
  }
}

export interface RecordResult {
  recorded: boolean;
  kept: number;
  approved: number;
  rejected: number;
  /** True once both sides have enough decisions for the weights to mean something. */
  confident: boolean;
}

export function recordDecision(entry: CalibrationEntry): RecordResult {
  const store = storage();
  const previous = loadDecisions();
  const withoutDuplicate = previous.filter((old) => !(
    old.sourceId === entry.sourceId
    && old.startWord === entry.startWord
    && old.endWord === entry.endWord
  ));
  const next = [...withoutDuplicate, entry].slice(-MAX_ENTRIES);
  if (store) {
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      return { recorded: false, kept: previous.length, approved: 0, rejected: 0, confident: false };
    }
  }
  const approved = next.filter((e) => e.decision === 'approved').length;
  return {
    recorded: Boolean(store),
    kept: next.length,
    approved,
    rejected: next.length - approved,
    confident: next.length >= MIN_DECISIONS && approved >= MIN_PER_SIDE && next.length - approved >= MIN_PER_SIDE,
  };
}

export function clearDecisions(): void {
  const store = storage();
  if (!store) return;
  try {
    if (store.removeItem) store.removeItem(STORAGE_KEY);
    else store.setItem(STORAGE_KEY, '[]');
  } catch {
    // Nothing to do: the ledger is advisory.
  }
}

export interface Calibration {
  weights: CalibrationWeights;
  suggestedMinScore: number;
  decisions: number;
  approved: number;
  rejected: number;
  /** False means identity weights: not enough decisions to learn from. */
  confident: boolean;
  note: string;
}

const DIMENSION_KEYS: readonly DimensionKey[] = ['hook', 'flow', 'value', 'sound'];
const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));

function meanDims(entries: readonly CalibrationEntry[]): Dimensions {
  const out: Dimensions = { hook: 0, flow: 0, value: 0, sound: 0 };
  if (!entries.length) return out;
  for (const entry of entries) {
    for (const key of DIMENSION_KEYS) out[key] += Number(entry.subscores[key]) || 0;
  }
  for (const key of DIMENSION_KEYS) out[key] = out[key] / entries.length;
  return out;
}

export function computeCalibration(entries: readonly CalibrationEntry[] = loadDecisions()): Calibration {
  const approved = entries.filter((e) => e.decision === 'approved');
  const rejected = entries.filter((e) => e.decision === 'rejected');
  const confident = entries.length >= MIN_DECISIONS && approved.length >= MIN_PER_SIDE && rejected.length >= MIN_PER_SIDE;
  if (!confident) {
    return {
      weights: { ...IDENTITY_WEIGHTS },
      suggestedMinScore: 55,
      decisions: entries.length,
      approved: approved.length,
      rejected: rejected.length,
      confident: false,
      note: `Pocas decisiones para calibrar (${entries.length}/${MIN_DECISIONS}, y al menos ${MIN_PER_SIDE} de cada lado). `
        + 'Se usan los pesos neutros.',
    };
  }

  // A dimension that separates approved from rejected moments gets more weight in the
  // composite; one that separates them backwards gets less. tanh keeps one outlier from
  // dominating, and the weights are renormalised so the 0-99 scale keeps its meaning.
  const approvedMeans = meanDims(approved);
  const rejectedMeans = meanDims(rejected);
  const raw: CalibrationWeights = { ...IDENTITY_WEIGHTS };
  for (const key of DIMENSION_KEYS) {
    const gap = approvedMeans[key] - rejectedMeans[key];
    raw[key] = clamp(1 + 0.45 * Math.tanh(gap / 20), 0.6, 1.6);
  }
  const sum = raw.hook + raw.flow + raw.value + raw.sound;
  const scale = 4 / (sum || 4);
  const weights: CalibrationWeights = {
    hook: Number((raw.hook * scale).toFixed(4)),
    flow: Number((raw.flow * scale).toFixed(4)),
    value: Number((raw.value * scale).toFixed(4)),
    sound: Number((raw.sound * scale).toFixed(4)),
  };

  const approvedScores = approved.map((e) => e.score);
  const approvedMean = approvedScores.reduce((a, b) => a + b, 0) / approvedScores.length;
  const suggestedMinScore = clamp(Math.round(approvedMean - 3), 40, 85);

  return {
    weights,
    suggestedMinScore,
    decisions: entries.length,
    approved: approved.length,
    rejected: rejected.length,
    confident: true,
    note: `Calibrado con ${entries.length} decisiones: ${approved.length} aprobadas y ${rejected.length} descartadas.`,
  };
}
