// Runnable contract check for the reusable confirm gate (Plan 5, OP-13). The derivation is
// stubbed: what matters is that a mismatch, a missing id and an unreadable source all refuse.
import assert from 'node:assert';
import { previewMatches } from './preview-gate';
import type { PublishRequest } from '../plugins/upload-post.ts';

const request: PublishRequest = {
  source: '/media/uploads/a.mp4',
  platforms: ['tiktok'],
  title: 'Clip',
  confirm: true,
  previewId: 'ocut-abc',
};

const deps = {
  identity: async () => 'account-1',
  source: async () => ({ name: 'a.mp4', sizeBytes: 10, contentHash: 'abc' }),
};

// ── 1) A matching id passes, and the derived id is reported ─────────────────────────
{
  const { publishRequestId } = await import('../plugins/upload-post-source.ts');
  const derived = publishRequestId('account-1', '', { name: 'a.mp4', sizeBytes: 10, contentHash: 'abc' }, request);
  const ok = await previewMatches(request, derived, deps);
  assert.strictEqual(ok.ok, true, 'the id the request derives to is accepted');
  assert.strictEqual(ok.matches, true);
  assert.strictEqual(ok.derived, derived);
  assert.strictEqual(ok.error, undefined);
}

// ── 2) Anything else refuses, with a sentence worth showing ────────────────────────
{
  const wrong = await previewMatches(request, 'ocut-inventado', deps);
  assert.strictEqual(wrong.ok, false, 'an invented id is refused');
  assert.strictEqual(wrong.matches, false);
  assert.ok(/no corresponde/i.test(wrong.error ?? ''), 'and the message says the preview does not match');
  assert.ok(wrong.derived.startsWith('ocut-'), 'the id it should have been is reported, so a bug is diagnosable');

  const empty = await previewMatches(request, '   ', deps);
  assert.strictEqual(empty.ok, false);
  assert.ok(/Falta/.test(empty.error ?? ''));
}

// ── 3) A source that cannot be read refuses instead of guessing ────────────────────
{
  const broken = await previewMatches(request, 'ocut-whatever', {
    identity: deps.identity,
    source: async () => { throw new Error('archivo no encontrado'); },
  });
  assert.strictEqual(broken.ok, false);
  assert.ok(/no encontrado/.test(broken.error ?? ''), 'the reason is passed through');
  assert.strictEqual(broken.derived, '', 'no id is invented when the source is unreadable');
}

// ── 4) A missing account identity refuses too ──────────────────────────────────────
{
  const noAccount = await previewMatches(request, 'ocut-whatever', {
    identity: async () => { throw new Error('falta la clave de Upload-Post'); },
    source: deps.source,
  });
  assert.strictEqual(noAccount.ok, false);
  assert.ok(/clave/.test(noAccount.error ?? ''));
}

// ── 5) The same request twice derives the same id (stable, not random) ─────────────
{
  const a = await previewMatches(request, 'x', deps);
  const b = await previewMatches(request, 'x', deps);
  assert.strictEqual(a.derived, b.derived, 'derivation is deterministic');
}

console.log('server/publish/preview-gate.verify: ok');
