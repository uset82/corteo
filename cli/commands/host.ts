import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { rejectUnknownFlags, type CommandLine } from '../args.ts';
import { UsageError } from '../errors.ts';
import { listHostProfiles, loadHostProfile, skillSource } from '../host-profile.ts';
import { printJson, writeStdout } from '../output.ts';

export async function runHostCommand(positionals: readonly string[], line: CommandLine, json: boolean): Promise<void> {
  rejectUnknownFlags(line, ['json', 'help', 'data-dir']);
  const [action, name] = positionals;
  if (action === 'list') {
    const hosts = listHostProfiles();
    if (json) printJson({ hosts }); else writeStdout(hosts.join('\n'));
    return;
  }
  if (!name || (action !== 'show' && action !== 'install')) throw new UsageError('host needs list, show <name> or install <name>');
  const profile = loadHostProfile(name);
  if (action === 'show') {
    const result = { ...profile, skillSource };
    if (json) printJson(result); else writeStdout(JSON.stringify(result, null, 2));
    return;
  }
  mkdirSync(profile.mediaInbox, { recursive: true });
  mkdirSync(profile.exportDir, { recursive: true });
  mkdirSync(dirname(profile.skillDest), { recursive: true });
  const source = readFileSync(skillSource);
  let current: Buffer | undefined;
  try { current = readFileSync(profile.skillDest); } catch { /* first install */ }
  const skillChanged = !current?.equals(source);
  if (skillChanged) writeFileSync(profile.skillDest, source);
  const next = name === 'muse' ? 'Muse instala skills con: muse skills install <carpeta del skill>'
    : `Reinicia ${name} para que cargue el skill corteo.`;
  const result = { ok: true, host: name, skillPath: profile.skillDest, skillChanged,
    mediaInbox: profile.mediaInbox, exportDir: profile.exportDir, next };
  if (json) printJson(result); else writeStdout(JSON.stringify(result, null, 2));
}
