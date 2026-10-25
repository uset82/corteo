// Runnable contract check for the calibration ledger (Plan 5, OP-04). A fake storage stands
// in for localStorage; the math must stay honest with thin data and must actually move the
// weights once both sides have decisions.
import assert from 'node:assert';
import {
  IDENTITY_WEIGHTS,
  MIN_DECISIONS,
  clearDecisions,
  computeCalibration,
  loadDecisions,
  recordDecision,
  setCalibrationStorage,
  type CalibrationEntry,
  type StorageLike,
} from './calibration';
import { composite } from './score';
import type { Dimensions } from './types';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

const dims = (hook: number, flow: number, value: number, sound: number): Dimensions => ({ hook, flow, value, sound });

function entry(index: number, decision: 'approved' | 'rejected', subscores: Dimensions): CalibrationEntry {
  return {
    at: 1_700_000_000_000 + index,
    projectId: 'p1',
    sourceId: 'talk',
    startWord: index * 10,
    endWord: index * 10 + 8,
    startMs: index * 10_000,
    endMs: index * 10_000 + 8_000,
    score: Math.round((subscores.hook + subscores.flow + subscores.value + subscores.sound) / 4),
    subscores,
    decision,
  };
}

// ── 1) No storage → no crash, empty ledger, neutral weights ────────────────────────────
setCalibrationStorage(null);
const none = computeCalibration([]);
assert.deepStrictEqual(none.weights, IDENTITY_WEIGHTS, 'no decisions → identity weights');
assert.strictEqual(none.confident, false);
assert.strictEqual(none.suggestedMinScore, 55, 'the default line stands until there is data');
assert.deepStrictEqual(loadDecisions(), [], 'no storage reads as an empty ledger');

// ── 2) Recording: durable in the profile, deduped per span, capped by the ledger ───────
const store = fakeStorage();
setCalibrationStorage(store);
const first = recordDecision(entry(0, 'approved', dims(90, 80, 85, 70)));
assert.strictEqual(first.recorded, true);
assert.strictEqual(first.kept, 1);
assert.strictEqual(loadDecisions().length, 1, 'the decision survives a reload from storage');

recordDecision(entry(0, 'rejected', dims(10, 20, 15, 30)) as CalibrationEntry);
assert.strictEqual(loadDecisions().length, 1, 'the same span is replaced, not duplicated');
assert.strictEqual(loadDecisions()[0].decision, 'rejected', 'the newer decision wins');

clearDecisions();
assert.deepStrictEqual(loadDecisions(), [], 'clear empties the ledger');

// ── 3) Thin data stays honest: below MIN_DECISIONS the weights do not move ─────────────
for (let i = 0; i < MIN_DECISIONS - 1; i += 1) recordDecision(entry(i, 'approved', dims(90, 70, 70, 60)));
const thin = computeCalibration();
assert.strictEqual(thin.decisions, MIN_DECISIONS - 1);
assert.strictEqual(thin.confident, false, 'one short of the minimum is still not confident');
assert.deepStrictEqual(thin.weights, IDENTITY_WEIGHTS, 'thin data does not move the weights');
assert.match(thin.note, /Pocas decisiones/);

// ── 4) Real data: the dimension that separates approved from rejected gains weight ─────
clearDecisions();
for (let i = 0; i < 8; i += 1) recordDecision(entry(i, 'approved', dims(90, 50, 55, 50)));
for (let i = 0; i < 8; i += 1) recordDecision(entry(100 + i, 'rejected', dims(20, 55, 50, 50)));
const learned = computeCalibration();
assert.strictEqual(learned.confident, true, `${MIN_DECISIONS} decisions on both sides are enough`);
assert.ok(learned.weights.hook > learned.weights.flow, 'hook separates the two groups, so hook gains weight');
assert.ok(learned.weights.hook > 1 && learned.weights.flow < 1.05, `weights move in the right direction: ${JSON.stringify(learned.weights)}`);
const sum = learned.weights.hook + learned.weights.flow + learned.weights.value + learned.weights.sound;
assert.ok(Math.abs(sum - 4) < 0.01, 'weights are renormalised, so the 0-99 scale keeps its meaning');
assert.ok(learned.suggestedMinScore >= 40 && learned.suggestedMinScore <= 85, 'the suggestion stays inside the sane band');
assert.match(learned.note, /Calibrado con 16 decisiones/);

// ── 5) The identity vector reproduces the unweighted composite exactly ─────────────────
const sample = dims(80, 60, 70, 50);
assert.strictEqual(composite(sample), composite(sample, IDENTITY_WEIGHTS), 'identity weights change nothing');
assert.strictEqual(composite(dims(100, 100, 100, 100), IDENTITY_WEIGHTS), 99, 'the 99 cap survives weighting');
assert.notStrictEqual(composite(sample, learned.weights), composite(sample), 'learned weights actually change the score');

setCalibrationStorage(null);
console.log('shorts/calibration.verify: ok');
