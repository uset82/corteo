// P3-4: link classification and direct-file asset creation behind the dialog.
// Run: npx tsx src/media/importLink.verify.ts
import assert from 'node:assert/strict';
import { classifyImportLink, directImportAsset } from './importLink';

assert.deepEqual(classifyImportLink('https://www.youtube.com/watch?v=abc'), {
  kind: 'platform', url: 'https://www.youtube.com/watch?v=abc', host: 'www.youtube.com',
});
assert.equal(classifyImportLink('https://youtu.be/abc').kind, 'platform');
assert.equal(classifyImportLink('https://www.bilibili.com/video/BV1').kind, 'platform');
assert.deepEqual(classifyImportLink('https://cdn.example.com/clip.mp4?token=1'), {
  kind: 'direct', url: 'https://cdn.example.com/clip.mp4?token=1', host: 'cdn.example.com',
});
assert.equal(classifyImportLink('https://example.com/photo.jpg').kind, 'direct');
assert.throws(() => classifyImportLink(''), /Pega un enlace/);
assert.throws(() => classifyImportLink('not a url'), /URL válida/);
assert.throws(() => classifyImportLink('ftp://example.com/a.mp4'), /http/);
assert.throws(() => classifyImportLink('https://user:pass@example.com/a.mp4'), /credenciales/);

const hash = 'ab'.repeat(32);
const asset = directImportAsset({
  ok: true,
  path: '/media/uploads/clip.mp4',
  filename: 'Camión de noche.MP4',
  contentHash: hash,
  probe: { durationSeconds: 2.5, width: 1920, height: 1080 },
}, 'https://cdn.example.com/clip.mp4', 30);
assert.equal(asset.name, 'Camión de noche.MP4');
assert.equal(asset.sourceFilename, 'Camión de noche.MP4');
assert.equal(asset.kind, 'video');
assert.equal(asset.src, '/media/uploads/clip.mp4');
assert.equal(asset.durationInFrames, 75);
assert.equal(asset.sourceContentHash, hash);
assert.equal(asset.width, 1920);
assert.equal(asset.height, 1080);

const image = directImportAsset({ ok: true, path: '/media/uploads/photo.jpg', filename: 'photo.jpg' }, 'https://x.test/photo.jpg', 30);
assert.equal(image.kind, 'image');
assert.equal(image.durationInFrames, 150, 'images get the 5 s pool default');
assert.throws(() => directImportAsset({ ok: false, error: 'upstream 404' }, 'https://x.test/a.mp4', 30), /upstream 404/);
assert.throws(() => directImportAsset({ ok: true, path: '/tmp/a.mp4' }, 'https://x.test/a.mp4', 30), /archivo de medios/);
console.log('importLink.verify: platform/direct routing and pool asset creation OK');
