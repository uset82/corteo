// `occ job` — read the renders that `render --detach` left running.
//
// Read-only by design: a job's outcome is written by the process that did the
// work, so there is nothing here that could claim a render succeeded when it did
// not. `wait` blocks until the job ends, which is what a bot does after it has
// already told the user the render started.
import { flagText, rejectUnknownFlags, type CommandLine } from '../args.ts';
import { CliError, UsageError } from '../errors.ts';
import { printJson, renderTable, writeStdout } from '../output.ts';
import { GLOBAL_FLAGS } from './common.ts';
import {
  jobReport,
  listJobs,
  reconcile,
  resolveJob,
  waitForJob,
  type JobReport,
} from '../jobs.ts';

const FLAGS = [...GLOBAL_FLAGS, 'timeout'] as const;
const DEFAULT_WAIT_SECONDS = 600;

function secondsOf(commandLine: CommandLine): number {
  const raw = flagText(commandLine, 'timeout');
  if (raw === undefined) return DEFAULT_WAIT_SECONDS;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new UsageError(`--timeout expects a positive number of seconds, got "${raw}"`);
  }
  return value;
}

function humanLine(report: JobReport): string {
  const size = report.bytes === null ? '' : `  ${(report.bytes / (1024 * 1024)).toFixed(1)}MB`;
  const took = report.seconds === null ? '' : `  ${report.seconds.toFixed(1)}s`;
  return `${report.state.padEnd(7)}  ${report.id}  ${report.output}${size}${took}`;
}

function printHuman(report: JobReport): void {
  writeStdout(humanLine(report));
  if (report.error !== null) writeStdout(`  error: ${report.error}`);
  if (report.state === 'running') writeStdout(`  follow: occ job wait ${report.id}`);
}

export async function runJobCommand(
  positionals: readonly string[],
  commandLine: CommandLine,
  json: boolean,
): Promise<void> {
  rejectUnknownFlags(commandLine, FLAGS);
  const [sub, ...rest] = positionals;

  if (sub === 'list') {
    const jobs = [];
    for (const job of await listJobs()) jobs.push(jobReport(await reconcile(job)));
    if (json) {
      printJson({ jobs });
      return;
    }
    if (jobs.length === 0) {
      writeStdout('no render jobs yet (start one with: occ render --detach)');
      return;
    }
    writeStdout(renderTable(
      ['state', 'id', 'output', 'size', 'took'],
      jobs.map((job) => [
        job.state,
        job.id,
        job.output,
        job.bytes === null ? '-' : `${(job.bytes / (1024 * 1024)).toFixed(1)}MB`,
        job.seconds === null ? '-' : `${job.seconds.toFixed(1)}s`,
      ]),
    ));
    return;
  }

  if (sub === 'status') {
    const report = jobReport(await reconcile(await resolveJob(rest[0])));
    if (json) printJson(report);
    else printHuman(report);
    return;
  }

  if (sub === 'wait') {
    const job = await resolveJob(rest[0]);
    const report = jobReport(await waitForJob(job, secondsOf(commandLine) * 1000));
    if (json) printJson(report);
    else printHuman(report);
    if (report.state === 'failed') {
      throw new CliError(`render job ${report.id} failed: ${report.error ?? 'unknown error'}`);
    }
    return;
  }

  if (sub === undefined) throw new UsageError('job needs a subcommand: status, wait or list');
  throw new UsageError(`unknown job subcommand "${sub}"`);
}
