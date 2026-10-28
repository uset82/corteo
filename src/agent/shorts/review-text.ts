import type { Dimensions } from './types';

export interface ReviewMoment {
  startSeconds: number;
  endSeconds: number;
  seconds: number;
  score: number;
  subscores: Dimensions;
  reason: string;
  risks: readonly string[];
}

function clock(seconds: number): string {
  const value = Math.max(0, Math.round(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function shortsReviewEs(moments: readonly ReviewMoment[], { max = 5 }: { max?: number } = {}): string {
  const ending = 'Tendencia: no disponible (no hay datos de plataforma).';
  const selected = moments.slice(0, Math.max(0, Math.min(5, Math.floor(max))));
  const budget = Math.floor((3000 - ending.length - selected.length * 2) / Math.max(1, selected.length));
  const entries = selected.map((moment, index) => {
    const { hook, flow, value, sound } = moment.subscores;
    const heading = `${index + 1}. ${moment.score}/99 · ${clock(moment.startSeconds)}–${clock(moment.endSeconds)} (${moment.seconds} s) — Gancho ${hook} · Flujo ${flow} · Valor ${value} · Sonido ${sound}`;
    const risk = moment.risks.join(', ') || 'ninguno';
    const available = Math.max(0, budget - heading.length - '\n   Por qué: \n   Riesgos: '.length);
    const reasonMax = Math.ceil(available / 2);
    return `${heading}\n   Por qué: ${moment.reason.slice(0, reasonMax)}\n   Riesgos: ${risk.slice(0, available - reasonMax)}`;
  });
  return [...entries, ending].join('\n');
}
