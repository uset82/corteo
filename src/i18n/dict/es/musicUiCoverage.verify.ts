// Spanish coverage guard for the music UI surfaces (L-11). The Spanish locale falls
// back to English, so an unmigrated key silently renders English inside the Spanish
// editor; this keeps the shipped music controls from drifting back.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EN } from '../en';
import ES from './index';

const ROOT = process.cwd();
const SURFACES = [
  'src/audio/intelligence/MusicAnalysisBadge.tsx',
  'src/audio/intelligence/SongMapDialog.tsx',
  'src/audio/intelligence/useMusicAnalysisCards.ts',
  'src/components/inspector/MusicReactionSection.tsx',
  'src/components/timeline/MusicMapStrip.tsx',
];
const CJK = /[\u3400-\u9fff]/;

const keys = new Set<string>();
for (const file of SURFACES) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const match of text.matchAll(/'((?:[^'\\\n]|\\.)+)'/g)) {
    const literal = match[1];
    if (CJK.test(literal) && EN[literal]) keys.add(literal);
  }
}

const es = ES as unknown as Record<string, string>;
const missing = [...keys].filter((key) => !es[key]).sort((a, b) => a.localeCompare(b));
assert.deepEqual(missing, [], `Spanish music UI dictionary is missing ${missing.length} keys:\n${missing.join('\n')}`);

console.log(`musicUiCoverage.verify: ${keys.size} music UI keys are Spanish`);
