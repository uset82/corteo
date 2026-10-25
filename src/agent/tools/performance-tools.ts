export { PERFORMANCE_TOOL_SCHEMAS, PERFORMANCE_TOOL_NAMES } from './schemas/performance-tools';
import type { AgentContext } from '../context';
import { parsePerformanceCsv, reportPerformance } from '../shorts/performance';

// score_performance — Plan 5, OP-15.
//
// Read-only, and deliberately not a model: it joins the scores we already gave those clips
// against what the audience did, so the user can see whether the rubric agreed with reality.
// The judgement (banding, when a threshold is worth suggesting) lives in shorts/performance.ts
// and is tested without any of this.

type Args = Record<string, unknown>;

export async function execPerformanceTool(name: string, args: Args, _ctx: AgentContext): Promise<unknown> {
  if (name !== 'score_performance') return { error: `unknown tool ${name}` };

  const csv = typeof args.csv === 'string' ? args.csv : '';
  if (!csv.trim()) {
    return {
      error: 'Falta el CSV. Pega el export de la plataforma (columnas de puntuación y de reproducciones, con cabecera).',
    };
  }

  const parsed = parsePerformanceCsv(csv);
  if (!parsed.rows.length) {
    return {
      error: 'El CSV no tiene filas utilizables: hacen falta una columna de puntuación y otra de reproducciones.',
      skipped: parsed.skipped,
    };
  }

  const report = reportPerformance(parsed.rows, parsed.skipped);
  return {
    ok: true,
    ...report,
    note: report.confident
      ? `${report.note} Puedes usar ${report.suggestedMinScore ?? 'el umbral actual'} como minScore en make_shorts.`
      : report.note,
  };
}
