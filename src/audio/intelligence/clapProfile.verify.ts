import assert from 'node:assert/strict';
import {
  classifyClapEmbedding,
  displayMusicLabel,
  parseClapPrototypeProfile,
  withSectionMoods,
  type ClapPrototypeProfile,
  type SectionWindow,
} from './clapProfile';
import { CLAP_EMBEDDING_DIMENSION } from './clapTypes';
import type { MusicSection, MusicTagKind } from './types';

function axis(index: number): number[] {
  return Array.from({ length: CLAP_EMBEDDING_DIMENSION }, (_, dimension) => dimension === index ? 1 : 0);
}

const labels: Array<{ kind: MusicTagKind; label: string; vector: number[] }> = [
  { kind: 'genre', label: 'zeta', vector: axis(0) },
  { kind: 'genre', label: 'alpha', vector: axis(0) },
  { kind: 'mood', label: 'calm', vector: axis(0) },
  { kind: 'instrument', label: 'piano', vector: axis(0) },
  { kind: 'usage', label: 'vlog', vector: axis(0) },
];
const profile: ClapPrototypeProfile = parseClapPrototypeProfile({ labels });
const embedding = axis(0);

const tags = classifyClapEmbedding(embedding, profile, {
  thresholds: { genre: 0.5, mood: 0.5, instrument: 0.5, usage: 0.5 },
});
assert.equal(tags.length, 4, 'classification returns one top tag per category');
assert.deepEqual(tags[0], { kind: 'genre', label: 'alpha', score: 1 },
  'equal scores use a stable label tie-break');
assert.deepEqual(tags.map((tag) => tag.kind), ['genre', 'mood', 'instrument', 'usage']);

const unknown = classifyClapEmbedding(embedding, profile, {
  thresholds: { genre: 1, mood: 1, instrument: 1, usage: 1 },
});
assert.equal(unknown.every((tag) => tag.label !== 'unknown'), true,
  'a score equal to the threshold remains classified');
const conservativeUnknown = classifyClapEmbedding(embedding, profile, {
  thresholds: { genre: 0.5, mood: 0.5, instrument: 0.5, usage: 0.5 },
});
const orthogonal = classifyClapEmbedding(axis(1), profile, {
  thresholds: { genre: 0.01, mood: 0.01, instrument: 0.01, usage: 0.01 },
});
assert.equal(conservativeUnknown[0]!.score, 1, 'scores are stable rounded cosine values');
assert.equal(orthogonal.every((tag) => tag.label === 'unknown'), true,
  'adjustable thresholds produce explicit unknown tags below threshold');
assert.equal(orthogonal.every((tag) => tag.score === 0), true);

assert.throws(() => parseClapPrototypeProfile({
  labels: labels.map((label, index) => index === 0 ? { ...label, vector: axis(0).slice(1) } : label),
}), /511 dimensions; expected 512/, 'malformed prototype dimensions are rejected');

assert.throws(() => parseClapPrototypeProfile({
  labels: labels.map((label, index) => index === 0 ? { ...label, vector: new Array(512).fill(0) } : label),
}), /zero length/, 'zero prototype vectors are rejected');

const moodProfile: ClapPrototypeProfile = parseClapPrototypeProfile({
  labels: [
    { kind: 'mood', label: 'festive', vector: axis(0) },
    { kind: 'mood', label: 'calm', vector: axis(1) },
    { kind: 'genre', label: 'cumbia', vector: axis(2) },
    { kind: 'instrument', label: 'guitar', vector: axis(3) },
    { kind: 'usage', label: 'vlog', vector: axis(4) },
  ],
});
const sections: MusicSection[] = [
  { fromMs: 0, toMs: 10_000, role: 'intro-like', energy: 0.4, boundaryConfidence: 0.5 },
  { fromMs: 10_000, toMs: 20_000, role: 'peak', energy: 0.9, boundaryConfidence: 0.5 },
];
const windows: SectionWindow[] = [
  { startMs: 0, vector: axis(0) },
  { startMs: 10_000, vector: axis(1) },
];
const scored = withSectionMoods(sections, windows, { profile: moodProfile });
assert.deepEqual(scored.map((section) => section.mood?.label), ['festive', 'calm'],
  'each section is scored on the windows it covers');
assert.equal(sections.every((section) => section.mood === undefined), true,
  'scoring sections does not mutate the input');

const spanning = withSectionMoods(
  [{ fromMs: 0, toMs: 20_000, role: 'steady', energy: 0.5, boundaryConfidence: 0.5 }],
  [{ startMs: 0, vector: axis(0) }, { startMs: 16_000, vector: axis(1) }],
  { profile: moodProfile },
);
assert.equal(spanning[0]!.mood?.label, 'festive', 'overlap weight favors the window covering more of the section');

const unmatched = withSectionMoods(sections.slice(0, 1), [{ startMs: 0, vector: axis(5) }], {
  profile: moodProfile,
  threshold: 0.5,
});
assert.equal(unmatched[0]!.mood, undefined, 'a below-threshold section gets no mood instead of unknown');
assert.deepEqual(withSectionMoods(sections, [], { profile: moodProfile }), sections,
  'no windows leaves sections unchanged');

assert.equal(displayMusicLabel('festive'), 'festiva');
assert.equal(displayMusicLabel('reggaeton'), 'reguetón');
assert.equal(displayMusicLabel('latin rock'), 'rock latino');
assert.equal(displayMusicLabel('huayno'), 'huayno');
assert.equal(displayMusicLabel('unmapped-label'), 'unmapped-label');

console.log('clapProfile.verify: ok');
