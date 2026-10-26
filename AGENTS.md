# AGENTS.md: corteo

Instructions for any coding agent working in this repo (Cursor, Qoder, WorkBuddy, DeepSeek, Claude, Codex, Grok). Read all of it before the first change.

## What this is
This repository holds corteo: a Spanish music-video editor built on a fork of [OpenChatCut](https://github.com/0xsline/OpenChatCut) (AGPL v3), a local video editor in the browser (React 19 + TypeScript + Remotion 4), served by a Vite dev server whose plugins are the backend. A bot drives it over MCP — a Grok Bot, Claude Code, Codex — and the built-in assistant is the editor's own, not one of them. The user is a Spanish-speaking musician.

## Where corteo runs

corteo runs on its own Linux VM, separate from Carlos's PC. The bot clones this repo there and runs the editor on that machine. It does not need Carlos's PC to be on, a Cloudflare tunnel, or https://corteo.uset82.workers.dev/. Those publish the same editor for a browser and stay optional.

Any bot (the template is https://github.com/anabologyco-maker/claudia-bot) can install corteo on its own Linux VM with `scripts/corteo-install.sh`. The agent skill is `skills/corteo/SKILL.md`. Shells on that VM may export `NPM_CONFIG_PREFIX` and leave Node 20 as `node`. The installer and `scripts/corteo-env.sh` unset the prefix and select Node 24 from `.nvmrc`. The bot runs `~/corteo/scripts/corteo`, not a bare `npm run corteo`, so a fresh shell does not need setup. On that VM:

- `npm run corteo:local` starts the editor and the MCP server on `http://127.0.0.1:5199` with paid providers off (`OPENCHATCUT_PROVIDERS=off` unless the environment already set it). The MCP path is `http://127.0.0.1:5199/api/external-mcp/mcp`. The token is `OPENCHATCUT_MCP_TOKEN` or the `mcp-token` file in the dev profile. Do not print the token into a chat.
- `npm run corteo -- ...` is the shell (`occ`). It talks to the project library directly, with no browser:
  - `project new "Nombre" --json` and `project list --json`
  - `media import /absolute/path.mp4 --apply --json`
  - `tools call edit_item --args '{"adds":[{"type":"video","assetId":"<id>","fromFrame":0}]}' --apply` places a pool clip. `type:"audio"` and `type:"text"` place audio and a title. `item split <clip> --at 2s --apply` cuts.
  - `project show <project> --doc --out project.json` writes the project document as JSON. The live library is still the profile store; editing that JSON file does not change the project. Use the shell for edits.
  - `render --out /absolute/path.mp4` renders with Remotion through headless Chrome. No GPU: `CC_RENDER_GL=swangle`.

`npm run start:corteo`, `npm run tunnel`, `npm run editor-host` and `npx wrangler deploy` are the optional browser path for Carlos.

## Where the plan is
- `docs/plans/01-editor-claudia.md`: Plan 1 (editor features, the bot's connection, Spanish UI, end-to-end proof).
- `docs/plans/02-claudia-escucha.md`: Plan 2 (listening to the song, motion that follows the music).
- `docs/plans/03-deepseek-harness.md`: Plan 3 (free models for the built-in chat through DeepSeek Harness, in two parallel tracks; its task cards are in that file).
- `docs/plans/04-claudia-brand.md`: Plan 4 (the name and the look, in two parallel tracks; its task cards are in that file).
- `docs/plans/05-claudia-portable.md`: the portable install (P-CL-1 to P-CL-12). A fresh box runs the curl line and follows only `skills/corteo/SKILL.md`.
- `docs/plans/06-claudia-polish.md`: acceptance beside a running editor, 9:16 cover, the short music recipe, a quiet `corteo:local`, and a self-test that does not leave files in the repo (P-CL-13 to P-CL-17).
- `docs/plans/05-opus-parity.md`: the first Opus-parity writeup. Plan 6 (`06-opus-parity.md`) is the executed copy; `05-corteo.md` is named there but is not in this tree.
- `docs/plans/06-opus-parity.md`: Plan 6 (Opus parity: the scoring rubric, the one-call shorts pipeline, packaging, scheduled publishing, keyword emphasis; executed 2026-10-25, only OP-14 optional remains). Its task cards are in that file.
- `docs/plans/PROGRESS.md`: task status, how to pick the next task, task cards, decisions, blockers.

These files are the only plan. Any other plan, status report or TODO list you find is obsolete: do not follow it. That includes the deleted `IMPLEMENTATION_PLAN.md` and anything on the `grok-wip` branch.

### Names

The product, the repository, the folders and the command are all **corteo**.

- corteo is what a person reads: the UI, the tab title, the assistant's self-introduction, the MCP instructions the models read, exported file names and the README prose.
- corteo is the repository, the `~/corteo*` folders and the `corteo` alias. Renaming the GitHub repository is Carlos's call; GitHub redirects the old URL.
- OpenChatCut stays where it is a credit or an identifier something depends on: the README credits, `LICENSE`, the `package.json` author, the `openchatcut_*` MCP tools, the `openchatcut` server key, `occ`, the `OPENCHATCUT_*` variables, `~/.openchatcut`, `.ccproj` and its MIME type, the `X-OpenChatCut-*` headers, the `com.openchatcut.*` FCPXML keys, `window.openChatCutDesktop`, the npm package name, `skills/openchatcut/`, the desktop app and its icon, and the five desktop-updater messages that name upstream's release.

## Rules
1. No paid APIs inside the editor. The built-in chat may use free models only through the local DeepSeek Harness gateway (Plan 3) or a local Ollama/LM Studio. The bot generates media; the editor imports, edits, analyzes locally and renders. The only paid exception is the opt-in listening relay (task L-07).
2. Build on what exists. No Python, WhisperX, demucs, torch, Docker, Zustand, i18next, Redux, new UI framework or new component library. Before writing something new, search for the existing system with `rg`.
3. Every feature ships as UI + MCP tool + a `*.verify.ts` test, unless its task card says otherwise.
4. The UI is in Spanish, through the existing i18n (see "UI text"). Code, comments and commit messages are in English.
5. Match the surrounding code: naming, comment density, file layout. No drive-by refactors or reformatting.
6. Source files (`.ts .tsx .mts .mjs .cjs .js`, tests excluded) stay at or below 500 lines. A test gate enforces it. Split by responsibility.
7. Every new `*.verify.*` file must be added to the `test:serial` chain in `package.json`. Two test gates enforce it.
8. New files in `scripts/` are ignored by the `/scripts/*` rule in `.gitignore`. Add a `!/scripts/<file>` line for each one (files ending in `.verify.mjs` are already allowed), or they silently never get committed.
9. Never edit `assets/agent/openchatcut-tool-schemas.json` by hand: run `npm run generate:server-tool-catalog`.
10. Never commit secrets (`.env.corteo`, tokens, API keys), media files, or `test-results/`.
11. Keep upstream tests passing. Don't weaken or delete a test to make it pass: fix the code or record a blocker.
12. Don't stop to ask the user questions mid-task. If the plan leaves a choice open, pick what fits the plan best, note it under "Decisions made" in `PROGRESS.md`, and continue.

## Project map
- `src/`: the browser app. `editor/` (timeline model, keyframes, render helpers), `components/` (UI), `captions/`, `audio/` (beats, music intelligence), `export/`, `agent/` (tools, skills, tool policy), `i18n/`, `shortcuts/`.
- `server/`: the backend, as Vite plugins. `plugins/` holds the HTTP routes (registered in `server/plugins/index.ts`); `external-agent/` holds the MCP server, offline tools and MCP prompts.
- `remotion/`: server-side rendering. `cli/`: the `occ` command line. `shared/`: code used by the browser, server and desktop app. `desktop/`: the upstream Electron app (keep its tests passing; no new features there).

## Environment
- WSL Ubuntu, Node 24 (`.nvmrc`), npm. ffmpeg and ffprobe come from npm packages; nothing to install system-wide.
- Every command (git, npm, node, npx, dsh) runs inside WSL, in the Linux checkout. An IDE that runs on Windows wraps each one: `wsl.exe -e bash -lc 'source ~/.nvm/nvm.sh && cd ~/corteo && <command>'` (Ubuntu's `.bashrc` stops early in non-interactive shells, before the nvm lines). Never run git or npm from Windows on a `\\wsl$\…` path: Windows git drops the executable bit of `cli/occ.mjs` and `dev-with-mcp.sh` (fix with `chmod +x cli/occ.mjs dev-with-mcp.sh` inside WSL), and a worktree created that way records a Windows path Linux git can't read (remove it and create it again from WSL).
- `npm install` once.
- `npm run dev` serves the editor and the API on http://localhost:5199 (fixed port). It runs in an isolated dev profile under `~/.openchatcut/dev-profiles/<id>/`; the startup line `[OpenChatCut] isolated profile <id>` names it. A second checkout (a git worktree) gets its own profile, with its own data, settings and MCP token, and serves on another port: `npm run dev -- --port <N>`.
- `npm run dev` and `npm run start:corteo` start Vite with `--max-old-space-size` from `OPENCHATCUT_DEV_HEAP_MB` (default 6144). `start:corteo` also loads `.env.corteo`.
- `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` hides the long, harmless list of "import without file extension" warnings at startup.
- Run long-lived processes (dev server, editor host) in their own terminal or tmux session, never in the shell you work in.
- A session that has to run on Windows over the `\\wsl.localhost` share cannot write to an existing file: `cp`, `dd`, `mv` onto it and a shell `>` all fail with `Permission denied`, with or without the sandbox, and the editor's own edit tool fails on its backup step. New files, `>>` and renames inside a directory do work, so the way through is `mv <file> node_modules/<folder>/` for the old copy and then write the new one. Inside WSL there is no such limit; `git add` and `git commit` work either way.
- WebGL: on Linux the renderer uses the GPU (`angle-egl`). Without a usable GPU (common in WSL and VMs), server exports silently lose WebGL effects and transitions, and three render tests fail with "WebGL2 not available". Then set `CC_RENDER_GL=swangle` (software WebGL) for the dev server and for `npm test`.
- Exports, render tests and `npm run editor-host` (P1-5) start a headless Chromium. If it fails with `error while loading shared libraries`, WSL is missing system libraries. Installing them needs `sudo`: record a blocker asking the user to run `npx playwright install-deps chromium` once (it asks for the password itself; `sudo npx` fails under nvm because sudo drops nvm from `PATH`), and continue with tasks that don't render.

## Commands
| Command | What it does |
|---------|--------------|
| `npx tsc -b` | type check (seconds) |
| `npm run lint` | oxlint; the warnings already in upstream code are fine, errors are not |
| `npm run verify:affected` | runs the tests next to the files you changed (see below) |
| `npm run verify:affected -- <files>` | the same for an explicit list of files |
| `npm run verify:affected -- path/to/x.verify.ts` | one test, run with the exact command `package.json` uses for it (some need flags such as `--tsconfig tsconfig.app.json`) |
| `npm run verify:<group>` | a test group: `i18n`, `mcp`, `agent-tools`, `editor`, `captions`, `caption-motion`, `music-intelligence`, `skills`, `shortcuts`, `export-gl`, `runtime-profile`, `components` |
| `npm test` | the full gate, about 6 minutes on 4 cores |
| `npm run build` | type check + production bundle |
| `npm run generate:server-tool-catalog` | regenerate the MCP tool catalog after adding or changing a tool |
| `npm run occ -- tools call <tool> --args '<json>'` | call an editor tool against the local project library with no browser (`npm run occ -- --help`) |

`verify:affected` picks the `*.verify.*` files next to each changed source file, or in the nearest folder that has some. It ignores docs (`docs/`, `README*`, `AGENTS.md`). Always call it through `npm run`: plain `node` can't find `tsx`. It exits with code 2 and asks for the full gate when the change includes files it can't map:
- non-code files you edited on purpose (`.gitignore`, `.env.corteo.example`): run it again with the explicit list of changed code files;
- `package.json`, `config/`, `shared/`, `assets/` or `public/`: run `npm test` before marking the task done.

## The work loop
1. Run `git status` and open `docs/plans/PROGRESS.md`. If a task there is `doing`, an earlier session stopped in the middle of it: resume it (its partial work may be uncommitted; `git log -5` shows what was committed). Otherwise tracked files must have no changes; pick the next task (rule at the top of `PROGRESS.md`) and set it to `doing`. Untracked files you didn't create (media, leftovers from Grok) are not yours: leave them alone.
2. Read its card and the plan section it points to. Read the files it lists, and the code around them, before writing anything.
3. Implement the smallest complete version that meets "Done when".
4. Check: `npx tsc -b`, `npm run lint`, `npm run verify:affected`, plus the card's Verify commands. Fix what you broke.
5. Try it for real when the card asks: in the browser at http://localhost:5199 and/or through MCP (smoke test below).
6. Set the task to `done` in `PROGRESS.md` (add output paths or numbers worth keeping) and commit the task's files together with `PROGRESS.md`, with the task ID first in the message, for example `P1-3: accept OPENCHATCUT_ALLOWED_HOSTS in allowedHosts`. A big task may take a few commits. If the task changes what works or how to run the editor, update the "Estado" section (and the run steps) of `README.md` in the same commit: it is in Spanish and must never claim a feature that isn't wired.
7. After every 5 finished tasks: `npm test` and `npm run build`, push (see Git), report (see Reporting) and end the session. Long sessions lose track; the next session starts fresh from `PROGRESS.md`.

## When something fails
- Read the whole error and find the cause before changing code.
- At most 3 attempts at the same failure. After the third: undo the attempt (`git restore <files>` or `git stash`), set the task to `blocked`, add a Blockers entry in `PROGRESS.md` (command, a few lines of the error, what you tried, what would unblock it), commit that, and move to the next task you can do.
- A test that already failed before your change is not yours to fix. Record it under Blockers and continue.
- Don't install system packages, global tools or new npm dependencies unless the task card names them.
- A command that runs for more than 15 minutes without progress is a failure: stop it.

## UI text (i18n)
Upstream keys every UI string by its Chinese original, with one dictionary per language in `src/i18n/dict/<lang>/`. Spanish (`es`) is the default language and falls back to English.
- In components: `const t = useT();` (from `src/i18n/locale`) and `t('中文原文')`. Helpers outside React import `t`.
- Add the English entry to the matching module in `src/i18n/dict/en/` (`npm run verify:i18n` fails without it) and the Spanish entry to `src/i18n/dict/es/` (`index.ts` until task P5-1 splits it into modules).
- Plan 4's brand copy lives in `src/i18n/dict/en/brand.ts` and `src/i18n/dict/es/brand.ts` instead: `dictRegistry.ts` spreads the Spanish one over `es.default`, and `en/index.ts` assembles the English one last. Put new brand copy there, not in the module files, until P5-1 folds them in. Because the Spanish one is spread last, it must not define a key that `es/index.ts` translates for the DeepSeek harness (Plan 3), such as `请先在设置中配置一个模型厂商。`: it would hide the harness text.
- Placeholders such as `{n}` must appear unchanged in every language.
- Use the Spanish terms of Premiere Pro's Spanish UI: Línea de tiempo, Secuencia, Fotograma clave, Cuchilla, Controles de efectos.
- Undo labels (`ctx.commands.batch(actions, label)`) are stored and shown as written: write new ones in Spanish.
- Text for the model (tool descriptions, skills, MCP prompts) does not go through i18n. Write tool descriptions in English like the existing ones; phrases the assistant should say to the user can be quoted in Spanish.

## Adding an MCP tool
1. Schema: add it to the matching group in `src/agent/tools/schemas/` (for example `music-intelligence-tools.ts`), with an English description that says when to use it and a tight `input_schema` with limits.
2. Executor: implement it in `src/agent/tools/` and wire both into `TOOL_SCHEMAS` and `EXECUTOR_GROUPS` in `src/agent/tools.ts`.
3. Policy: classify it in `src/agent/external-tool-policy.ts` (read-only, draft edit, or real effect). If it must work with no editor tab open (the bot's headless calls such as `listen_to_song` or `apply_music_reaction`), make it server-direct there and add it to `server/external-agent/offline-tools.ts` and `server/external-agent/offline-executor.ts`.
4. Edits go through `ctx.commands.batch(actions, label)`, so one tool call is one undo step. Skip locked tracks.
5. Optional: `PARALLEL_TOOL_NAMES` in `src/agent/tools/execution-modes.ts` for safe read-only tools; routing keywords in `src/agent/tool-routing.ts`.
6. Images for the model go back as `__images: [{ base64, mimeType }]` (see `src/agent/tools/frames-tool.ts`). Text results stay under 16,000 characters.
7. `npm run generate:server-tool-catalog`, then `npm run verify:server-tool-catalog`.
8. A `*.verify.ts` next to the executor, registered in `test:serial`; run `npm run verify:agent-tools` and `npm run verify:mcp`.
9. Name the tool in the skill that should use it (`src/agent/skills/<skill>/SKILL.md`): with progressive tool exposure, loading a skill reveals the tools its text names.
10. Call it over MCP with the smoke test.

## MCP smoke test
Talk to the editor the way the bot does. The token is `OPENCHATCUT_MCP_TOKEN` from `.env.corteo` (after P0-3), otherwise the file `mcp-token` in the dev profile folder, created by the first MCP request.

```bash
TOKEN=$(cat ~/.openchatcut/dev-profiles/<profile-id>/mcp-token)
URL=http://localhost:5199/api/external-mcp/mcp
H=(-H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream')
SID=$(curl -s -D - -o /dev/null -X POST "$URL" "${H[@]}" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
  | tr -d '\r' | awk -F': ' 'tolower($1)=="mcp-session-id"{print $2}')
curl -s -X POST "$URL" "${H[@]}" -H "mcp-session-id: $SID" -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
curl -s -X POST "$URL" "${H[@]}" -H "mcp-session-id: $SID" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | grep -o '"name":"[a-z_]*"' | wc -l
curl -s -X POST "$URL" "${H[@]}" -H "mcp-session-id: $SID" -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"openchatcut_status","arguments":{}}}'
```

- A wrong token gets 403 `invalid request origin`.
- With no editor tab open, `tools/list` returns the controls plus the offline server-side tools (44 today). With a tab open on a project (a browser, or `npm run editor-host` after P1-5) it returns the full editor set.
- `openchatcut_status` reports the available tool tier and what still needs a browser tab.

## Git
- Work on `cursor/video-editor-mvp-d191`. Don't touch `grok-wip`. No force-push and no history rewrites.
- Exception, Plan 3's parallel tracks: the Qoder agent works only in `~/corteo-qoder` on branch `harness-qoder`, the WorkBuddy agent only in `~/corteo-workbuddy` on `harness-workbuddy`, both created from `github/main`. Each pushes only its own branch (`git push github harness-qoder` or `git push github harness-workbuddy`), never `main`, never the other track's branch, and never merges the other track: H-9 does.
- Commit after every task (see the loop). Never commit secrets, media or `test-results/`.
- Stage files by name (`git add <paths>`), never `git add -A` or `git add .`: the checkout can hold untracked media and leftovers that must not be committed. Check `git status` before each commit.
- Push at the end of a session with `scripts/sync-publish.sh` (see Flujo de ramas). If a push is rejected, report it; never force-push.

## Flujo de ramas

GitHub `main` (https://github.com/uset82/corteo) is the shared branch. Cursor, Qoder, WorkBuddy and DeepSeek all publish there. Right before pushing, every agent fetches GitHub `main` and merges it (or rebases onto it) so the push is a fast-forward. Never force-push `main`. Never rewrite history.

On Carlos's PC the two remotes are `github` (GitHub) and `origin` (the Cursor copy). The local branch is `cursor/video-editor-mvp-d191`. The helper does the fetch, both merges, `npm test` when Node is 24, and the two pushes. It does not stage or delete untracked files.

```bash
bash scripts/sync-publish.sh
```

If a merge stops on conflicts, fix only those files, `git add` them by name, commit, and run the helper again. Do not `git add -A` and do not `git push --force`.

## Reporting
At the end of a session (after 5 tasks, when no task is left that you can do, or when the user stops you), tell the user: the task IDs finished, the tasks blocked and why, the next task in line, and the real result of the last `npm test` (pass count, or the names of the failing tests). Never round up: "partly works" is a valid status.
