// Pure DSP measurements shared by the server, the browser and the verifies.
// Nothing here touches the DOM, Node or the model packs.

export interface EnergyFrame {
  readonly timeMs: number;
  readonly rms: number;
  /** Mean magnitude of 20–250 Hz. */
  readonly bass: number;
  /** Mean magnitude of 250–2000 Hz, where most vocals live. */
  readonly mid: number;
  /** Mean magnitude of 2000–8000 Hz. */
  readonly brightness: number;
  /** Power-weighted spectral centroid, Hz. */
  readonly centroid: number;
}

export interface OnsetPoint {
  readonly timeMs: number;
  /** Relative to the strongest onset in the song, 0–1. */
  readonly strength: number;
}

export type MomentKind = 'drop' | 'break' | 'build' | 'stop' | 'vocals-in' | 'vocals-out';

export interface Moment {
  readonly kind: MomentKind;
  readonly timeMs: number;
  readonly strength: number;
}

export interface KeyEstimate {
  readonly tonic: string;
  readonly mode: 'major' | 'minor';
  readonly confidence: number;
}

export interface SongMeasurements {
  readonly durationMs: number;
  readonly frameMs: number;
  readonly frames: readonly EnergyFrame[];
  readonly onsets: readonly OnsetPoint[];
  readonly accents: readonly OnsetPoint[];
  readonly moments: readonly Moment[];
  readonly key: KeyEstimate | null;
}
