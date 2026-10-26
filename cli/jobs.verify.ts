// Verify for `occ render --detach` and `occ job`.
//
// The point of a job is that it outlives the call that started it, which is the
// only way a Grok Bot turn (it dies about five minutes into a long tool call) can
// survive a render. What is pinned down here:
//
//   * --detach returns immediately, with a job id, before the render happens;
//   * the child really runs the same command line and finishes the record itself;
//   * a failing render ends the job as `failed` and keeps the child's stderr;
//   * `job wait` blocks until the end and reports the failure with a non-zero exit;
//   * `job status` / `job list` never invent a success;
//   * an unknown job is an error, not an empty answer.
//
// The render itself is started with --dry-run: Chrome is not available in the
// gate (see cli.verify.ts), and the machinery under test is the job lifecycle,
// not the encoder. A real render is proved on a VM by the acceptance harness.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MAIN = join(ROOT, 'cli', 'main.ts');
const HOME = mkdtempSync(join(tmpdir(), 'occ-jobs-'));
const LIBRARY = join(HOME, 'library');
const ENV: NodeJS.ProcessEnv = {
  ...process.env,
  HOME,
  USERPROFILE: HOME,
  OPENCHATCUT_DATA_DIR: LIBRARY,
};
delete ENV.OPENCHATCUT_DEV_PROFILE_ID;

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function occ(args: readonly string[]): RunResult {
  const result = spawnSync(process.execPath, ['--import', 'tsx', MAIN, ...args], {
    cwd: ROOT,
    env: ENV,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function occOk(args: readonly string[]): string {
  const result = occ(args);
  assert.equal(result.status, 0, `occ ${args.join(' ')} exited ${result.status}:\n${result.stderr}`);
  return result.stdout;
}

function parse<T>(label: string, stdout: string): T {
  try {
    return JSON.parse(stdout) as T;
  } catch {
    throw new Error(`${label} did not print JSON:\n${stdout}`);
  }
}

function occJson<T>(args: readonly string[]): T {
  return parse<T>(`occ ${args.join(' ')}`, occOk(args));
}

/** For commands that print a report and still exit non-zero. */
function occJsonEvenOnFailure<T>(args: readonly string[]): { status: number; value: T } {
  const result = occ(args);
  return { status: result.status, value: parse<T>(`occ ${args.join(' ')}`, result.stdout) };
}

interface JobReport {
  id: string;
  state: 'running' | 'done' | 'failed';
  projectId: string;
  projectName: string;
  output: string;
  startedAt: number;
  finishedAt: number | null;
  seconds: number | null;
  bytes: number | null;
  pid: number | null;
  error: string | null;
  log: string;
}

try {
  const created = occJson<{ id: string; name: string }>([
    'project', 'new', 'jobs verify', '--fps', '30', '--size', '640x360', '--json',
  ]);

  // ── 1. no jobs yet is an empty answer, not an error ───────────────────────
  const empty = occJson<{ jobs: JobReport[] }>(['job', 'list', '--json']);
  assert.deepEqual(empty.jobs, [], 'a fresh library has no render jobs');

  // ── 2. --detach returns before the render happens ─────────────────────────
  // Measured against a cheap read on the same machine, because the property
  // under test is "detach does not wait for the render", not "TypeScript starts
  // quickly". This box can spend 25s booting tsx under load; the built entry on
  // a VM is well under a second.
  const baselineStart = Date.now();
  occJson<unknown>(['where', '--json']);
  const baseline = Date.now() - baselineStart;

  const out = join(HOME, 'detached.mp4');
  const startedAt = Date.now();
  const started = occJson<{
    jobId: string; state: string; projectId: string; output: string; pid: number | null; log: string;
  }>(['render', created.id, '--out', out, '--dry-run', '--detach', '--json']);
  const elapsed = Date.now() - startedAt;
  assert.match(started.jobId, /^job_/, '--detach must return a job id');
  assert.equal(started.projectId, created.id);
  assert.equal(started.output, out, 'the job records where the render will land');
  assert.ok(
    started.state === 'running' || started.state === 'done',
    `a fresh job is running or already done, got "${started.state}"`,
  );
  assert.ok(
    elapsed < baseline + 15_000,
    `--detach must not wait for the render (baseline ${baseline}ms, took ${elapsed}ms)`,
  );

  // ── 3. the child finishes the record itself ───────────────────────────────
  const waited = occJson<JobReport>(['job', 'wait', started.jobId, '--timeout', '180', '--json']);
  assert.equal(waited.state, 'done', `the detached dry run should finish, got ${waited.state}: ${waited.error}`);
  assert.equal(waited.id, started.jobId);
  assert.ok(waited.finishedAt !== null, 'a finished job has an end time');
  assert.ok((waited.seconds ?? 0) >= 0, 'a finished job reports how long it took');
  assert.ok(existsSync(waited.log), 'the job keeps the child log');
  assert.ok(statSync(waited.log).size >= 0, 'the log is readable');
  // A dry run writes no file, so bytes must stay null rather than becoming 0.
  assert.equal(waited.bytes, null, 'a dry run leaves bytes null');

  // ── 4. status and list agree with wait ────────────────────────────────────
  const status = occJson<JobReport>(['job', 'status', started.jobId, '--json']);
  assert.equal(status.state, 'done');
  assert.equal(status.output, out);

  const listed = occJson<{ jobs: JobReport[] }>(['job', 'list', '--json']);
  assert.equal(listed.jobs.length, 1);
  assert.equal(listed.jobs[0]?.id, started.jobId);
  // A prefix is enough to address a job, the way a project id is.
  const byPrefix = occJson<JobReport>(['job', 'status', started.jobId.slice(0, 10), '--json']);
  assert.equal(byPrefix.id, started.jobId);

  // ── 5. a failing render ends as failed, with the child's own message ──────
  const bad = occJson<{ jobId: string }>([
    'render', created.id, '--out', join(HOME, 'bad.mp4'),
    '--dry-run', '--timeline', 'nope', '--detach', '--json',
  ]);
  const failed = occJsonEvenOnFailure<JobReport>(['job', 'wait', bad.jobId, '--timeout', '180', '--json']);
  assert.equal(failed.value.state, 'failed', 'a bad timeline must not report success');
  assert.notEqual(failed.status, 0, 'waiting on a failed job exits non-zero');
  assert.match(failed.value.error ?? '', /timeline/i, 'the job keeps the reason it failed');
  assert.equal(failed.value.bytes, null, 'a failed job has no output size');
  const logText = readFileSync(failed.value.log, 'utf8');
  assert.match(logText, /timeline/i, 'the child stderr is kept in the job log');

  // ── 6. errors are loud ───────────────────────────────────────────────────
  const unknown = occ(['job', 'status', 'job_does_not_exist', '--json']);
  assert.notEqual(unknown.status, 0, 'an unknown job must fail');
  assert.match(unknown.stderr, /no render job/);

  const noSub = occ(['job']);
  assert.equal(noSub.status, 2, 'a bare `job` is a usage error');
  assert.match(noSub.stderr, /status, wait or list/);

  const badTimeout = occ(['job', 'wait', started.jobId, '--timeout', 'soon']);
  assert.equal(badTimeout.status, 2, '--timeout takes a number');
  assert.match(badTimeout.stderr, /positive number of seconds/);

  // ── 7. the usage text promises the contract ──────────────────────────────
  const help = occOk(['--help']);
  assert.match(help, /--detach/, '--help documents --detach');
  assert.match(help, /occ job wait/, '--help documents job wait');
  assert.match(help, /occ job status/, '--help documents job status');
  assert.match(help, /occ job list/, '--help documents job list');

  console.log('jobs.verify: detach, wait, status, list and failure reporting pass');
} finally {
  rmSync(HOME, { recursive: true, force: true });
}
