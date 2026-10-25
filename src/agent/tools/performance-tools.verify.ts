// Contract check for score_performance (Plan 5, OP-15): it reads a CSV, reports bands, and
// refuses politely on an empty or unusable file.
import assert from 'node:assert';
import { execPerformanceTool } from './performance-tools';
import type { AgentContext } from '../context';

const ctx = {} as AgentContext;

interface Result {
  ok?: boolean; error?: string; rows?: number; skipped?: number; confident?: boolean;
  suggestedMinScore?: number | null; bestBand?: string | null; note?: string;
  bands?: Array<{ label: string; clips: number }>;
}

const header = 'Title,Score,Views,Average view percentage\n';
const rows = Array.from({ length: 12 }, (_, i) => {
  const score = i < 6 ? 42 + i : 74 + i;
  const views = i < 6 ? 120 : 900;
  return `Clip ${i},${score},${views},${i < 6 ? 30 : 60}`;
}).join('\n');

// ── 1) A usable CSV produces a report with a recommendation ─────────────────────────
{
  const result = await execPerformanceTool('score_performance', { csv: header + rows }, ctx) as Result;
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.rows, 12);
  assert.strictEqual(result.skipped, 0);
  assert.strictEqual(result.confident, true, 'twelve clips is enough to say something');
  assert.ok(typeof result.suggestedMinScore === 'number', 'a threshold is suggested');
  assert.ok(result.bands && result.bands.length === 5, 'five bands are reported');
  assert.ok(/minScore/.test(result.note ?? ''), 'the note says where to use it');
}

// ── 2) Too few rows: a report, but no recommendation ────────────────────────────────
{
  const result = await execPerformanceTool('score_performance', { csv: header + 'A,80,1000,50\nB,40,100,20' }, ctx) as Result;
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.rows, 2);
  assert.strictEqual(result.confident, false);
  assert.strictEqual(result.suggestedMinScore, null);
  assert.ok(/Solo 2 clips/.test(result.note ?? ''));
}

// ── 3) Rows with no score are skipped and counted, not treated as zero ─────────────
{
  const csv = header + 'Sin nota,,900,30\nCon nota,70,1200,45';
  const result = await execPerformanceTool('score_performance', { csv }, ctx) as Result;
  assert.strictEqual(result.rows, 1);
  assert.strictEqual(result.skipped, 1, 'the blank row is reported, not silently zeroed');
}

// ── 4) Empty and unusable inputs are refusals with a reason ────────────────────────
{
  const empty = await execPerformanceTool('score_performance', { csv: '   ' }, ctx) as Result;
  assert.ok(empty.error && /CSV/.test(empty.error));

  const wrong = await execPerformanceTool('score_performance', { csv: 'nombre,ciudad\nAna,Madrid' }, ctx) as Result;
  assert.ok(wrong.error && /puntuación|puntuacion/i.test(wrong.error));
  assert.strictEqual(wrong.skipped, 1, 'and it says how many rows it could not use');
}

// ── 5) Unknown tool ────────────────────────────────────────────────────────────────
{
  const unknown = await execPerformanceTool('performance_everything', {}, ctx) as Result;
  assert.ok(unknown.error);
}

console.log('performance-tools.verify: ok');
