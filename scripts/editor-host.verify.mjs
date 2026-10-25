import assert from 'node:assert/strict';
import { editorHostUrl, pickProjectId } from './editor-host.mjs';

assert.equal(
  editorHostUrl('http://127.0.0.1:5199/', 'proj/1'),
  'http://127.0.0.1:5199/#/editor/proj%2F1',
);

const projects = [
  { id: 'new', updatedAt: 20 },
  { id: 'old', updatedAt: 10 },
  { id: 'gone', updatedAt: 30, deletedAt: 1 },
];
assert.equal(pickProjectId(projects), 'new', 'without --project the newest live project wins');
assert.equal(pickProjectId(projects, 'old'), 'old');
assert.throws(() => pickProjectId(projects, 'gone'), /No hay un proyecto/);
assert.throws(() => pickProjectId([]), /No hay proyectos/);

console.log('editor-host.verify: url and project pick pass');
