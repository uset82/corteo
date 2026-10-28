import assert from 'node:assert/strict';
import type { MediaAsset } from '../editor/types';
import { t } from '../i18n/locale';
import { creditsText, mediaCreditEntries } from './mediaCredits';

const asset = (id: string, name: string, source?: MediaAsset['source']): MediaAsset => ({
  id, name, kind: 'video', src: `/media/uploads/${id}.mp4`, durationInFrames: 90, source,
});

// Locally imported assets carry no source and must stay out of the credits.
assert.deepEqual(mediaCreditEntries([asset('a', 'clip.mp4'), asset('b', 'photo.jpg', {})]), []);

// A stored source becomes one entry; the page title names the credit, not the file.
const entries = mediaCreditEntries([
  asset('a', 'VID_0042.mp4', {
    provider: 'youtube.com',
    title: '  Amanecer en la costa  ',
    uploader: 'Marta Ríos',
    pageUrl: 'https://www.youtube.com/watch?v=abc123',
    license: 'CC BY 4.0',
  }),
  asset('b', 'foto.jpg', { searchQuery: 'atardecer en la playa' }),
]);
assert.equal(entries.length, 2);
assert.equal(entries[0]?.name, 'Amanecer en la costa', 'the source title wins over the file name and is trimmed');
assert.equal(entries[0]?.uploader, 'Marta Ríos');
assert.equal(entries[0]?.license, 'CC BY 4.0');
assert.equal(entries[0]?.provider, 'youtube.com');
assert.equal(entries[1]?.name, 'foto.jpg', 'without a title the asset name stands in');

// The same page imported twice is one credit, and a blank field never renders.
const deduped = mediaCreditEntries([
  asset('a', 'one.mp4', { provider: 'vimeo.com', pageUrl: 'https://vimeo.com/1', uploader: '  ' }),
  asset('b', 'two.mp4', { title: 'Another take', provider: 'vimeo.com', pageUrl: 'https://vimeo.com/1' }),
  asset('c', 'three.mp4', { title: 'Another take', provider: 'vimeo.com' }),
  asset('d', 'four.mp4', { title: 'Another take', provider: 'vimeo.com' }),
]);
assert.equal(deduped.length, 2, 'page URL dedupes; same metadata without a URL dedupes too');
assert.equal(deduped[0]?.uploader, undefined, 'whitespace-only fields are dropped');

// The exported file is deterministic and ends with one newline.
const text = creditsText(entries, new Date('2026-10-28T23:30:00Z'));
assert.equal(
  text,
  [
    `${t('素材来源')} · corteo`,
    '2026-10-28',
    '',
    '1. Amanecer en la costa',
    `   ${t('作者')}: Marta Ríos`,
    `   ${t('来源')}: youtube.com — https://www.youtube.com/watch?v=abc123`,
    `   ${t('许可证')}: CC BY 4.0`,
    '',
    '2. foto.jpg',
    `   ${t('搜索词')}: atardecer en la playa`,
    '',
  ].join('\n'),
);

const lyrics = mediaCreditEntries([
  asset('lyric', 'still.jpg', { title: 'Photo', lyricLine: 'y el mar se abrió', searchQuery: 'marea' }),
]);
assert.match(creditsText(lyrics, new Date('2026-10-28T00:00:00Z')), new RegExp(`   ${t('歌词片段')}: y el mar se abrió`), 'the lyric line is credited');
assert.doesNotMatch(creditsText(entries), /2026-10-28/, 'without a date the file has just the credit lines');

assert.equal(
  creditsText([], new Date('2026-10-28T00:00:00Z')),
  [`${t('素材来源')} · corteo`, '2026-10-28', '', `${t('还没有需要署名的来源。')}`, ''].join('\n'),
  'an empty pool still exports a well-formed file',
);
assert.equal(creditsText([]), `${t('素材来源')} · corteo\n\n${t('还没有需要署名的来源。')}\n`);

console.log('mediaCredits.verify: only sourced assets are credited, once each, and creditos.txt is exportable');
