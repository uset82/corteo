// Runnable contract check for the performance loop (Plan 5, OP-15). Pure: parsing a messy CSV,
// banding, and the refusal to recommend a threshold from too little data.
import assert from 'node:assert';
import { MIN_ROWS, parsePerformanceCsv, reportPerformance } from './performance';

// ── 1) Parsing: forgiving headers, messy numbers, skipped rows ────────────────────────
{
  const csv = [
    'Title,Score,Views,Average view percentage',
    '"Clip, con coma",72,1500,45',
    'Otro,55,"2,300",40',
    'Sin puntuación,,900,',
    'Negativo,90,-5,0',
    'Perfecto,120,100,101',
  ].join('\n');
  const { rows, skipped } = parsePerformanceCsv(csv);
  assert.strictEqual(rows.length, 3, 'three usable rows');
  assert.strictEqual(skipped, 2, 'the unparseable and the negative-views row are skipped, not guessed');
  assert.strictEqual(rows[0].clipId, 'Clip, con coma', 'quoted commas survive');
  assert.strictEqual(rows[0].score, 72);
  assert.strictEqual(rows[0].retention, 45);
  assert.strictEqual(rows[1].views, 2300, 'thousands separators are stripped');
  assert.strictEqual(rows[2].score, 99, 'an out-of-range score is clamped');
  assert.strictEqual(rows[2].retention, 100, 'an out-of-range retention is clamped');
}

// ── 2) No usable columns → no rows, and the caller is told ──────────────────────────
{
  assert.deepStrictEqual(parsePerformanceCsv(''), { rows: [], skipped: 0 });
  assert.deepStrictEqual(parsePerformanceCsv('solo una linea'), { rows: [], skipped: 0 });
  const wrong = parsePerformanceCsv('nombre,ciudad\nAna,Madrid\nLuis,Sevilla');
  assert.deepStrictEqual(wrong.rows, [], 'no score column means no rows');
  assert.strictEqual(wrong.skipped, 2, 'and the rows are accounted for');
}

// ── 3) Bands, and the average that says nothing at low volume ───────────────────────
{
  const rows = [
    { clipId: 'a', score: 80, views: 1000 },
    { clipId: 'b', score: 82, views: 3000 },
    { clipId: 'c', score: 40, views: 500 },
  ];
  const report = reportPerformance(rows);
  assert.strictEqual(report.rows, 3);
  assert.strictEqual(report.confident, false, 'three clips are not a signal');
  assert.strictEqual(report.suggestedMinScore, null, 'and no threshold is recommended');
  const band80 = report.bands.find((band) => band.label === '70-84')!;
  assert.strictEqual(band80.clips, 2);
  assert.strictEqual(band80.averageViews, 2000, 'the band averages, it does not sum');
  assert.strictEqual(report.bestBand, '70-84');
  assert.match(report.note, /Solo 3 clips/);
}

// ── 4) With enough data it recommends the lowest band that beats the average ────────
{
  const rows = Array.from({ length: MIN_ROWS }, (_, i) => ({
    clipId: `c${i}`,
    score: i < 6 ? 40 + i : 70 + i,
    views: i < 6 ? 100 : 900,
  }));
  const report = reportPerformance(rows);
  assert.strictEqual(report.confident, true);
  assert.strictEqual(report.suggestedMinScore, 70, 'the lowest band above average, not the best band');
  assert.strictEqual(report.bestBand, '70-84', 'while the best band is reported separately');
  assert.match(report.note, /banda 70-84/);
}

// ── 5) An empty report says why, not just "no data" ─────────────────────────────────
{
  const report = reportPerformance([]);
  assert.strictEqual(report.rows, 0);
  assert.strictEqual(report.confident, false);
  assert.match(report.note, /CSV/);
  assert.ok(report.bands.every((band) => band.clips === 0 && band.averageViews === 0));
}

console.log('shorts/performance.verify: ok');
