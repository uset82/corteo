import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./evolution-acceptance.sh', import.meta.url));
const source = readFileSync(script, 'utf8');
execFileSync('bash', ['-n', script]);
for (const name of ['profiles', 'roundtrip', 'song-film', 'shorts', 'router', 'delegate', 'ide-door', 'brain-live', 'clean']) {
  assert.ok(source.includes(`step ${name}`), `missing ${name} step`);
}
for (const required of ['EVOLUTION=PASS', 'EVOLUTION=FAIL', 'mktemp -d', 'git -C "$REPO" status --porcelain', 'CORTEO_STORE_DIR', 'CORTEO_MEDIA_INBOX', 'CORTEO_EXPORT_DIR', 'CC_RENDER_GL=swangle']) assert.ok(source.includes(required), required);
assert.doesNotMatch(source, /API_KEY|BEGIN [A-Z ]*PRIVATE KEY|sk-[A-Za-z0-9]{8,}|Bearer [A-Za-z0-9_-]{20,}/);
console.log('evolution-acceptance.verify: syntax, steps and secret guards passed');
