// P3-3: source attribution stays optional, is cleaned before storage, and the
// creditos.txt output lists only credited assets.
// Run: npx tsx src/media/credits.verify.ts
import assert from 'node:assert/strict';
import type { MediaAsset } from '../editor/types';
import {
  CREDITS_FILE_NAME, creditRows, creditsText, readSourceCredits,
} from './credits';

assert.equal(CREDITS_FILE_NAME, 'creditos.txt');
assert.equal(readSourceCredits(null), undefined);
assert.equal(readSourceCredits({ title: '  ' }), undefined);
assert.deepEqual(readSourceCredits({
  title: '  Camión  ', uploader: 'Claudia', pageUrl: 'https://youtu.be/x',
  license: 'CC-BY', lyricLine: '  La noche entera  ', searchQuery: '  faro  ',
  ignored: 'nope',
}), {
  title: 'Camión', uploader: 'Claudia', pageUrl: 'https://youtu.be/x',
  license: 'CC-BY', lyricLine: 'La noche entera', searchQuery: 'faro',
});
assert.equal(readSourceCredits({ title: 'x'.repeat(400) })?.title?.length, 300);

const assets = [
  { id: 'a', name: 'base.png', kind: 'image', src: '/media/uploads/a.png', durationInFrames: 30, source: { title: 'Faro', uploader: 'Claudia', pageUrl: 'https://youtu.be/a', license: 'CC-BY' } },
  { id: 'b', name: 'sin crédito.png', kind: 'image', src: '/media/uploads/b.png', durationInFrames: 30 },
  { id: 'c', name: 'foto.png', kind: 'image', src: '/media/uploads/c.png', durationInFrames: 30, source: { lyricLine: 'La noche entera', searchQuery: 'faro azul' } },
] as unknown as MediaAsset[];
const rows = creditRows(assets);
assert.equal(rows.length, 2);
assert.equal(rows[0]?.name, 'base.png');
assert.equal(rows[0]?.uploader, 'Claudia');
assert.equal(rows[1]?.lyricLine, 'La noche entera');
assert.equal(rows.some((row) => row.name === 'sin crédito.png'), false, 'uncredited media is omitted');

const text = creditsText(rows);
for (const expected of ['Créditos de fuentes', 'Archivo: base.png', 'Título: Faro', 'Autor: Claudia', 'Licencia: CC-BY', 'Enlace: https://youtu.be/a', 'Línea de la letra: La noche entera', 'Búsqueda: faro azul']) {
  assert.ok(text.includes(expected), `creditos.txt contains ${expected}`);
}
assert.match(creditsText([]), /No hay fuentes acreditadas/);
console.log('credits.verify: attribution cleaning, list and creditos.txt OK');
