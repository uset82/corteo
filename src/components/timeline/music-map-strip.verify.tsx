import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MusicAnalysis } from '../../audio/intelligence/types';
import type { TimelineItem } from '../../editor/types';
import { MusicMapStripView } from './MusicMapStrip';

const item: TimelineItem = { id: 'song', kind: 'audio', name: 'song', track: 'A1', startFrame: 0, durationInFrames: 120, srcInFrame: 60, playbackRate: 2 };
const analysis: MusicAnalysis = {
  schemaVersion: 1, assetId: 'song', sourceRevision: 'test', createdAt: 0, durationMs: 10000,
  modelPacks: { rhythm: 'test', semantic: 'test' }, bpm: 120, meter: 4, beatConfidence: 0.9,
  beatsMs: [], downbeatsMs: [4000, 6000], tags: [], embedding: [],
  sections: [
    { fromMs: 0, toMs: 4000, role: 'intro-like', energy: 0.2, boundaryConfidence: 1, mood: { kind: 'mood', label: 'calm', score: 0.9 } },
    { fromMs: 4000, toMs: 6000, role: 'build', energy: 0.5, boundaryConfidence: 1 },
    { fromMs: 6000, toMs: 10000, role: 'peak', energy: 0.9, boundaryConfidence: 1, mood: { kind: 'mood', label: 'energetic', score: 0.9 } },
  ],
};
const html = renderToStaticMarkup(<MusicMapStripView visible analysis={analysis} item={item} fps={30} px={2} />);
assert.equal((html.match(/data-music-section/g) ?? []).length, 3);
for (const label of ['intro · serena', 'subida', 'clímax · enérgica']) assert.ok(html.includes(label), label);
assert.match(html, /data-music-downbeat="true" style="position:absolute;left:60px/);
assert.match(html, /data-music-downbeat="true" style="position:absolute;left:120px/);
assert.ok(html.includes('data-music-drop'));
assert.equal(renderToStaticMarkup(<MusicMapStripView visible={false} analysis={analysis} item={item} fps={30} px={2} />), '');
assert.equal(renderToStaticMarkup(<MusicMapStripView visible analysis={null} item={item} fps={30} px={2} />), '');
console.log('music-map-strip.verify: Spanish sections and trim/speed positions passed');
