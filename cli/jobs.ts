// `occ render --detach` — a render that outlives the call that started it.
//
// A Grok Bot turn dies about five minutes into a long tool call, so a render the
// bot waits for is a render it loses. A job is one JSON file per render under the
// active profile: the parent writes it as `running` before it forks, the child
// rewrites it as `done` or `failed` when it ends, and `job status|wait|list`
// reads it. Nothing here touches the project, and a job that nobody watches
// still finishes.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CliError } from './errors.ts';
import { profileReport } from './profile.ts';

export type JobState = 'running' | 'done' | 'failed';

export interface RenderJob {
  readonly id: string;
  readonly state: JobState;
  readonly pid: number | null;
  readonly projectId: string;
  readonly projectName: string;
  readonly output: string;
  /** Epoch ms. */
  readonly startedAt: number;
  readonly finishedAt: number | null;
  readonly bytes: number | null;
  readonly error: string | null;
  /** The child's stdout and stderr, kept so a failure can be read after the fact. */
  readonly log: string;
}

const JOBS_DIR = 'render-jobs';

/** A job whose process has not reported in for this long is presumed dead. */
const STARTUP_GRACE_MS = 30_000;

export async function jobsDir(): Promise<string> {
  const profile = await profileReport();
  return join(profile.rootDir, JOBS_DIR);
}

async function ensureJobsDir(): Promise<string> {
  const dir = await jobsDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

export function newJobId(): string {
  return `job_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

// Write then rename: `job status` polls this file while the child is writing it,
// and a half-written JSON would read as a corrupt job.
async function writeJob(job: RenderJob): Promise<void> {
  const dir = await ensureJobsDir();
  const target = join(dir, `${job.id}.json`);
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(job, null, 2)}\n`, 'utf8');
  await rename(tmp, target);
}

export async function readJob(id: string): Promise<RenderJob> {
  const dir = await jobsDir();
  try {
    return JSON.parse(await readFile(join(dir, `${id}.json`), 'utf8')) as RenderJob;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new CliError(`no render job "${id}"`);
    }
    throw error;
  }
}

/** Newest first, so `job status` with no argument means "the one I just started". */
export async function listJobs(): Promise<RenderJob[]> {
  const dir = await jobsDir();
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const jobs: RenderJob[] = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    try {
      jobs.push(JSON.parse(await readFile(join(dir, name), 'utf8')) as RenderJob);
    } catch {
      // A job file being renamed into place right now is not an error.
    }
  }
  return jobs.sort((left, right) => right.startedAt - left.startedAt);
}

export async function resolveJob(reference: string | undefined): Promise<RenderJob> {
  const jobs = await listJobs();
  if (jobs.length === 0) {
    throw new CliError('no render jobs yet (start one with: occ render --detach)');
  }
  const wanted = (reference ?? '').trim();
  if (!wanted) return jobs[0]!;
  const exact = jobs.find((job) => job.id === wanted);
  if (exact) return exact;
  const matches = jobs.filter((job) => job.id.startsWith(wanted));
  if (matches.length === 1) return matches[0]!;
  if (matches.length === 0) throw new CliError(`no render job "${wanted}"`);
  throw new CliError(`"${wanted}" matches ${matches.length} render jobs; use a longer prefix`);
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * A `running` record whose process is gone will never be finished by anyone: the
 * child was killed, or the machine restarted. Without this the job would say
 * `running` forever and a `job wait` would hang until its timeout.
 */
export async function reconcile(job: RenderJob): Promise<RenderJob> {
  if (job.state !== 'running') return job;
  if (job.pid === null) {
    // The record is written before spawn, so pid is briefly null.
    if (Date.now() - job.startedAt < STARTUP_GRACE_MS) return job;
    return failJob(job, 'the render never started (no process was recorded)');
  }
  if (isProcessAlive(job.pid)) return job;
  return failJob(job, 'the render process is gone (killed, or the machine restarted)');
}

async function failJob(job: RenderJob, reason: string): Promise<RenderJob> {
  const failed: RenderJob = {
    ...job,
    state: 'failed',
    finishedAt: Date.now(),
    error: job.error ?? reason,
  };
  await writeJob(failed);
  return failed;
}

export interface DetachedRenderOptions {
  readonly projectId: string;
  readonly projectName: string;
  readonly output: string;
  /** argv for the child, already without --detach. */
  readonly args: readonly string[];
}

/**
 * Records the job, then forks the same command line with --job-id so the child
 * reports its own outcome. `detached` + `unref` is the point: the child keeps
 * running when the bot's turn ends.
 */
export async function startRenderJob(options: DetachedRenderOptions): Promise<RenderJob> {
  const dir = await ensureJobsDir();
  const id = newJobId();
  const log = join(dir, `${id}.log`);
  const entry = process.argv[1];
  if (entry === undefined) throw new CliError('cannot detach: the CLI entry point is unknown');

  const job: RenderJob = {
    id,
    state: 'running',
    pid: null,
    projectId: options.projectId,
    projectName: options.projectName,
    output: options.output,
    startedAt: Date.now(),
    finishedAt: null,
    bytes: null,
    error: null,
    log,
  };
  await writeJob(job);

  // process.execArgv carries the TypeScript loader in development and is empty
  // for the built cli-dist entry, so the child starts exactly the way we did.
  const fd = openSync(log, 'a');
  try {
    const child = spawn(
      process.execPath,
      [...process.execArgv, entry, ...options.args, '--job-id', id],
      { detached: true, stdio: ['ignore', fd, fd], env: process.env, cwd: process.cwd() },
    );
    child.unref();
    const started: RenderJob = { ...job, pid: child.pid ?? null };
    await writeJob(started);
    return started;
  } finally {
    closeSync(fd);
  }
}

/**
 * The child's side: whatever the command did, the job record ends up saying so.
 * Errors are re-thrown so the child still exits non-zero and the log keeps the
 * message.
 */
export async function runAsJob(jobId: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
    await finishJob(jobId, 'done');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishJob(jobId, 'failed', message);
    throw error;
  }
}

async function finishJob(jobId: string, state: 'done' | 'failed', error?: string): Promise<void> {
  let job: RenderJob;
  try {
    job = await readJob(jobId);
  } catch {
    // The record is gone; nothing to update and no one to tell.
    return;
  }
  // A dry run never writes the file, so bytes stay null rather than becoming a
  // confusing zero.
  const bytes = state === 'done'
    ? await stat(job.output).then((info) => info.size).catch(() => null)
    : null;
  await writeJob({
    ...job,
    state,
    finishedAt: Date.now(),
    bytes,
    error: error ?? null,
  });
}

export async function waitForJob(job: RenderJob, timeoutMs: number): Promise<RenderJob> {
  const deadline = Date.now() + timeoutMs;
  let current = await reconcile(job);
  while (current.state === 'running') {
    if (Date.now() >= deadline) {
      throw new CliError(
        `job ${current.id} is still running after ${Math.round(timeoutMs / 1000)}s; `
        + `check again with: occ job status ${current.id}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
    current = await reconcile(await readJob(current.id));
  }
  return current;
}

export interface JobReport {
  readonly id: string;
  readonly state: JobState;
  readonly projectId: string;
  readonly projectName: string;
  readonly output: string;
  readonly startedAt: number;
  readonly finishedAt: number | null;
  readonly seconds: number | null;
  readonly bytes: number | null;
  readonly pid: number | null;
  readonly error: string | null;
  readonly log: string;
}

export function jobReport(job: RenderJob): JobReport {
  const finished = job.finishedAt ?? (job.state === 'running' ? Date.now() : null);
  return {
    id: job.id,
    state: job.state,
    projectId: job.projectId,
    projectName: job.projectName,
    output: job.output,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    seconds: finished === null ? null : Math.round((finished - job.startedAt) / 100) / 10,
    bytes: job.bytes,
    pid: job.pid,
    error: job.error,
    log: job.log,
  };
}
