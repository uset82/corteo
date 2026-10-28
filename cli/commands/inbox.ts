import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, isAbsolute, join } from 'node:path';
import { flagBoolean, flagText, rejectUnknownFlags, type CommandLine } from '../args.ts';
import { CliError, UsageError } from '../errors.ts';
import { loadHostProfile } from '../host-profile.ts';
import { printJson, writeStdout } from '../output.ts';
import { renderProjectToFile } from '../render-file.ts';
import { runToolSession } from '../session.ts';
import { createProject, readProjectDoc } from '../store.ts';
import { parseFrames } from './common.ts';

const extensions = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.jpg', '.jpeg', '.png', '.webp', '.wav', '.mp3', '.m4a']);
interface Done { file: string; mtimeMs: number; output: string; at: string }

export async function runInboxCommand(line: CommandLine, json: boolean): Promise<void> {
  rejectUnknownFlags(line, ['host', 'file', 'resolution', 'to', 'dry-run', 'json', 'help', 'data-dir']);
  const host = flagText(line, 'host');
  if (!host) throw new UsageError('inbox needs --host grok, muse or claude-duet');
  const profile = loadHostProfile(host);
  const donePath = join(profile.mediaInbox, '.corteo-done.json');
  let done: Done[] = [];
  if (existsSync(donePath)) {
    const parsed: unknown = JSON.parse(readFileSync(donePath, 'utf8'));
    if (!Array.isArray(parsed)) throw new CliError('inbox history must be an array');
    done = parsed as Done[];
  }
  let input = flagText(line, 'file');
  if (input !== undefined) {
    if (!isAbsolute(input) || !existsSync(input) || !statSync(input).isFile()) {
      throw new UsageError('--file must be an absolute path that exists');
    }
  } else {
    const files = existsSync(profile.mediaInbox) ? readdirSync(profile.mediaInbox) : [];
    const candidates = files.filter((name) => extensions.has(extname(name).toLowerCase()))
      .map((name) => {
        const file = join(profile.mediaInbox, name);
        const stat = statSync(file);
        return { file, stat };
      }).filter(({ file, stat }) => stat.isFile() && !done.some((entry) => entry.file === file && entry.mtimeMs === stat.mtimeMs))
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    input = candidates[0]?.file;
    if (!input) {
      if (json) printJson({ ok: false, error: 'inbox_empty', inbox: profile.mediaInbox });
      throw new CliError(`inbox is empty: ${profile.mediaInbox}`);
    }
  }
  const resolution = flagText(line, 'resolution') ?? '720p';
  if (!['480p', '720p', '1080p', '4k'].includes(resolution)) throw new UsageError('--resolution must be one of 480p, 720p, 1080p, 4k');
  const { width, height, fps } = profile.defaultShort;
  const name = basename(input, extname(input));
  const project = await createProject({ name: `${host} ${name}`, width, height, fps });
  const imported = await runToolSession(project.id, [{ tool: 'import_asset', args: { path: input } }],
    { apply: true, summary: 'Del teléfono al MP4: importar' });
  const result = imported.executions[0]?.result as { imported?: { id: string }[] };
  const assetId = result?.imported?.[0]?.id;
  if (!assetId) throw new CliError('import did not return an asset');
  const doc = await readProjectDoc(project.id);
  const asset = doc.assets.find((item) => item.id === assetId);
  if (!asset) throw new CliError('imported asset is missing from the project');
  const kind = asset.kind;
  if (kind !== 'video' && kind !== 'image' && kind !== 'audio') throw new CliError(`unsupported inbox media: ${kind}`);
  const frames = kind === 'image' ? 6 * fps : asset.durationInFrames;
  const adds = kind === 'audio'
    ? [{ type: 'solid', color: '#111111', fromFrame: 0, durationInFrames: frames }, { type: 'audio', assetId, fromFrame: 0 }]
    : [{ type: kind, assetId, fromFrame: 0, ...(kind === 'image' ? { durationInFrames: frames } : {}) }];
  const placed = await runToolSession(project.id, [{ tool: 'edit_item', args: { adds } }],
    { apply: true, summary: 'Del teléfono al MP4: colocar' });
  if (kind !== 'audio') {
    const placement = placed.executions[0]?.result as { results?: { placed?: { itemId?: string } }[] };
    const itemId = placement?.results?.[0]?.placed?.itemId;
    if (!itemId) throw new CliError('placement did not return an item');
    await runToolSession(project.id, [{ tool: 'edit_item', args: { updates: [{ type: kind, itemId, fit: 'cover' }] } }],
      { apply: true, summary: 'Del teléfono al MP4: encuadre' });
  }
  mkdirSync(profile.exportDir, { recursive: true });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'video';
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const exportPath = join(profile.exportDir, `${slug}-${timestamp}.mp4`);
  const to = flagText(line, 'to');
  process.env.CC_RENDER_GL ??= profile.renderGl;
  const dryRun = flagBoolean(line, 'dry-run');
  const rendered = await renderProjectToFile({
    projectId: project.id, output: exportPath, resolution: resolution as '480p' | '720p' | '1080p' | '4k',
    endFrameExclusive: to === undefined ? Math.min(frames, 60 * fps) : parseFrames(to, fps, 'to'),
    quiet: true, dryRun,
  });
  if (!dryRun) {
    mkdirSync(profile.mediaInbox, { recursive: true });
    done.push({ file: input, mtimeMs: statSync(input).mtimeMs, output: exportPath, at: now.toISOString() });
    writeFileSync(donePath, `${JSON.stringify(done, null, 2)}\n`);
  }
  const output = { ok: true, host, input, projectId: project.id, exportPath, attachPath: exportPath,
    width, height, fps, durationSeconds: rendered.durationSeconds, bytes: rendered.bytes, dryRun };
  if (json) printJson(output); else writeStdout(JSON.stringify(output, null, 2));
}
