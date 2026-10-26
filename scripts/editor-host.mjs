// Keeps one headless editor tab open so corteo can edit when nobody has the site open.
// A tab registers with the MCP bridge only while a project is open.
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

export function editorHostUrl(base, projectId) {
  const root = String(base).replace(/\/+$/, '');
  return `${root}/#/editor/${encodeURIComponent(projectId)}`;
}

/** `projects` is newest-first, the order listExternalProjects already returns. */
export function pickProjectId(projects, requested) {
  const live = projects.filter((project) => project && project.id && !project.deletedAt);
  if (requested) {
    const found = live.find((project) => project.id === requested);
    if (!found) throw new Error(`No hay un proyecto con id ${requested}.`);
    return found.id;
  }
  if (!live[0]) throw new Error('No hay proyectos. Abre el editor y crea uno, o pasa --project <id>.');
  return live[0].id;
}

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} necesita un valor.`);
  return value;
}

const entryPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url !== entryPath) {
  // Imported by the verify. Don't open a browser.
} else {
  const argv = process.argv.slice(2);
  const base = optionValue(argv, '--base') ?? 'http://127.0.0.1:5199';
  const requested = optionValue(argv, '--project');
  const { listExternalProjects } = await import('../server/external-agent/projects.ts');
  const projects = await listExternalProjects(false);
  const projectId = pickProjectId(projects, requested);
  const url = editorHostUrl(base, projectId);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `No pude abrir Chromium (${message}). Instálalo una vez con: npx playwright install chromium\n`,
    );
    process.exit(1);
  }
  const page = await browser.newPage();
  let stopped = false;
  let down = true;
  const shutdown = async () => {
    if (stopped) return;
    stopped = true;
    await browser.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => { void shutdown(); });
  process.on('SIGTERM', () => { void shutdown(); });
  process.stdout.write(`Pestaña del editor: ${url}\nCtrl+C la cierra.\n`);

  while (!stopped) {
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(4000) });
      if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
      if (down) {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        down = false;
        process.stdout.write('El editor responde y la pestaña está abierta.\n');
      }
    } catch {
      if (!down) process.stdout.write('El editor no responde. Reintento cuando vuelva.\n');
      down = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
