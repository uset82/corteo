import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CliError } from './errors.ts';

const directory = new URL('../config/hosts/', import.meta.url);
export const skillSource = fileURLToPath(new URL('../skills/corteo/SKILL.md', import.meta.url));
const names = ['claude-duet', 'grok', 'muse'];
const keys = ['version', 'host', 'displayName', 'skillDest', 'mediaInbox', 'exportDir',
  'renderGl', 'providers', 'locale', 'defaultShort', 'mcpUrl', 'brainUrl', 'brainAliases'];

export interface HostProfile {
  version: number;
  host: string;
  displayName: string;
  skillDest: string;
  mediaInbox: string;
  exportDir: string;
  renderGl: string;
  providers: string;
  locale: string;
  defaultShort: { width: number; height: number; fps: number };
  mcpUrl: string;
  brainUrl: string;
  brainAliases: string[];
}

export function validateHostProfile(raw: unknown, name: string): string[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['profile must be an object'];
  const p = raw as Record<string, unknown>;
  const problems: string[] = [];
  for (const key of Object.keys(p)) if (!keys.includes(key)) problems.push(`unknown key ${key}`);
  const expected: Record<string, unknown> = { version: 1, host: name, displayName: 'corteo',
    renderGl: 'swangle', providers: 'off', locale: 'es' };
  for (const [key, value] of Object.entries(expected)) {
    if (p[key] !== value) problems.push(`${key} must be ${value}`);
  }
  for (const key of ['skillDest', 'mediaInbox', 'exportDir']) {
    if (typeof p[key] !== 'string' || !(/^(~\/|\/)/.test(p[key] as string))) problems.push(`${key} must start with ~/ or /`);
  }
  for (const key of ['mcpUrl', 'brainUrl']) {
    if (typeof p[key] !== 'string' || !(p[key] as string).startsWith('http://127.0.0.1:')) problems.push(`${key} must be loopback HTTP`);
  }
  const size = p.defaultShort as Record<string, unknown> | undefined;
  if (!size || Object.keys(size).sort().join(',') !== 'fps,height,width' || size.width !== 1080 || size.height !== 1920 || size.fps !== 30) {
    problems.push('defaultShort must be 1080x1920@30');
  }
  if (JSON.stringify(p.brainAliases) !== JSON.stringify(['corteo-edit', 'corteo-draft', 'corteo-fast'])) {
    problems.push('brainAliases must contain the three corteo aliases in order');
  }
  return problems;
}

export function listHostProfiles(): string[] {
  return readdirSync(directory).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5)).sort();
}

export function loadHostProfile(name: string, options: { env?: NodeJS.ProcessEnv; home?: string } = {}): HostProfile {
  if (!names.includes(name)) throw new CliError(`unknown host profile "${name}": use grok, muse or claude-duet`);
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(new URL(`${name}.json`, directory), 'utf8')); }
  catch { throw new CliError(`config/hosts/${name}.json: cannot read valid JSON`); }
  const problems = validateHostProfile(raw, name);
  if (problems.length) throw new CliError(`config/hosts/${name}.json: ${problems.join('; ')}`);
  const profile = raw as HostProfile;
  for (const [key, variable] of [
    ['skillDest', 'CORTEO_SKILL_DEST'], ['mediaInbox', 'CORTEO_MEDIA_INBOX'], ['exportDir', 'CORTEO_EXPORT_DIR'],
  ] as const) {
    const value = env[variable] ?? profile[key];
    const expanded = value.startsWith('~/') ? join(home, value.slice(2)) : value;
    if (!isAbsolute(expanded)) throw new CliError(`${variable} must be an absolute path`);
    profile[key] = expanded;
  }
  if (env.CORTEO_PORT) {
    const url = new URL(profile.mcpUrl);
    url.port = env.CORTEO_PORT;
    profile.mcpUrl = url.toString();
  }
  return profile;
}
