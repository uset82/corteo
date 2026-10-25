// `occ media ...` — the project's media pool. `import` uses the same headless
// import_asset path the offline MCP session uses (server/local-path-import.ts).
import { isAbsolute } from 'node:path';
import { flagBoolean, rejectUnknownFlags, type CommandLine } from '../args.ts';
import { UsageError } from '../errors.ts';
import { printJson, renderTable, writeStdout } from '../output.ts';
import { readProjectDoc, resolveProject } from '../store.ts';
import { GLOBAL_FLAGS, projectReference, requirePositional, subLine } from './common.ts';
import { runToolOps } from './run-op.ts';

const FLAGS = [...GLOBAL_FLAGS, 'kind', 'apply'] as const;

export async function runMediaCommand(
  positionals: readonly string[],
  commandLine: CommandLine,
  json: boolean,
): Promise<void> {
  rejectUnknownFlags(commandLine, FLAGS);
  const [subcommand, ...rest] = positionals;
  const line = subLine(commandLine, rest);
  switch (subcommand) {
    case 'ls':
    case 'list':
      return listCommand(line, json);
    case 'import':
      return importCommand(line, commandLine, json);
    case undefined:
      throw new UsageError('media needs a subcommand: ls | import');
    default:
      throw new UsageError(`unknown media subcommand "${subcommand}"`);
  }
}

async function importCommand(line: CommandLine, commandLine: CommandLine, json: boolean): Promise<void> {
  const filePath = requirePositional(line, 0, 'an absolute media path');
  if (!isAbsolute(filePath)) {
    throw new UsageError(`media import needs an absolute path, got "${filePath}"`);
  }
  const project = await resolveProject(projectReference(line, 1));
  await runToolOps({
    projectId: project.id,
    projectName: project.name,
    ops: [{ tool: 'import_asset', args: { path: filePath } }],
    apply: flagBoolean(commandLine, 'apply'),
    json,
    label: 'media import',
  });
}

async function listCommand(line: CommandLine, json: boolean): Promise<void> {
  const project = await resolveProject(projectReference(line));
  const doc = await readProjectDoc(project.id);
  const assets = doc.assets.map((asset) => ({
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    src: asset.src,
    durationInFrames: asset.durationInFrames,
    width: asset.width ?? null,
    height: asset.height ?? null,
    folderId: asset.folderId ?? null,
    sourceFilename: asset.sourceFilename ?? null,
  }));
  if (json) {
    printJson({ projectId: project.id, assets });
    return;
  }
  if (assets.length === 0) {
    writeStdout(`No media in ${project.name}. Import a file: occ media import /absolute/path.mp4 --apply`);
    return;
  }
  writeStdout(renderTable(
    ['ASSET', 'KIND', 'NAME', 'DURATION', 'SIZE', 'SRC'],
    assets.map((asset) => [
      asset.id,
      asset.kind,
      asset.name,
      `${asset.durationInFrames}f`,
      asset.width && asset.height ? `${asset.width}x${asset.height}` : '-',
      asset.src.split('/').pop() ?? asset.src,
    ]),
  ));
}
