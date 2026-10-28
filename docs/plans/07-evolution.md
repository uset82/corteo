# Plan 7: the evolution night (EV)

> Approved by Carlos on 2026-10-28. Executor: ChatGPT Terra, overnight, with no one to ask. Task status lives in `docs/plans/PROGRESS.md` › "Evolution night (EV)", not here.
> Paths are relative to the repo root. If a path here and the code disagree, the code wins: say so in the card's PROGRESS note and continue.
> The vision is `docs/ideas/evolution-of-corteo.md` (untracked, read only). It stays a vision note. This file is the night's only task list.

## What the night delivers

| Vision stage | What proves it tonight | Cards |
|---|---|---|
| 1 Grok, as now | Already done (Plan 5 P-CL, C-09). Not rebuilt. | none |
| 2 One name in the chat | The skill speaks as one bot, corteo, and says what the installer really prints | EV-03 |
| 3 Phone round trip | A file in the host inbox becomes a 720p vertical MP4 path, headless, no tunnel | EV-04, EV-05 |
| 4 Song film | A local wav plus lyrics becomes a lyric film cut on downbeats and moved by the energy curve | EV-06 to EV-10, EV-21 to EV-25 |
| 5 Long to short | `score_moments` hands the host a Spanish review before `make_shorts` cuts three vertical clips | EV-11, EV-12 |
| 6 Second host | Muse and Claude Duet are profiles, not forks | EV-01, EV-02 |
| 7 Brain boots with the bot | `npm run brain` and the installer start the free models with no browser and no pasted key | EV-13 to EV-17, EV-20 |
| 8 One delegation | `delegate` returns checked JSON that the host applies with a real tool | EV-18, EV-20 |
| 9 Any IDE | One loopback OpenAI door with three aliases | EV-14, EV-19 |
| 10 A dead lane | 429 and timeouts move to the next lane; an empty ladder returns `brain_unavailable` and the host does the step | EV-14, EV-18, EV-20 |
| Proof | One script prints `EVOLUTION=PASS` | EV-26 |
| Docs | README says only what was wired | EV-27 |

Live Muse, live Claude Duet and a phone are not on this machine. Their stages are done when a profile, a script and a `*.verify.*` pass.

## Read first

`AGENTS.md`, `docs/plans/PROGRESS.md`, `docs/ideas/evolution-of-corteo.md`, `docs/plans/02-claudia-escucha.md`, `docs/plans/03-deepseek-harness.md`, `docs/plans/05-claudia-portable.md`, `docs/plans/06-opus-parity.md`, `docs/harness.md`, `config/harness.json`, `skills/corteo/SKILL.md`. Then the files each card names.

## What the code says (it wins over the vision and the prompt)

1. The installer is `install.sh` at the repo root (`scripts/claudia-install.sh` and `scripts/corteo-install.sh` are gone since C-09). A curl install puts the app in `~/corteo/app`, writes `~/corteo/corteo.env` (0600) and `~/corteo/bin/occ`, and renders only with `--self-test`, which reports `CORTEO_SELF_TEST=pass` in lowercase. A failed self-test ends with `CORTEO_STATUS=failed` and `CORTEO_FAILED_STAGE=self-test`. The skill still says `PASS` and `~/corteo/scripts/corteo`: EV-03 fixes it.
2. `--host` in `install.sh` is the bind address. Host profiles use `--host-profile`.
3. `scripts/corteo` and `npm run corteo:local` need nvm (`scripts/corteo-env.sh`). A curl install has a private Node in `~/corteo/node` and no nvm, so a bot uses `"$CORTEO_OCC"` from `~/corteo/corteo.env`. On this machine `~/corteo` is the checkout and nvm exists, so `~/corteo/scripts/corteo` works.
4. The current names are `npm run corteo:local` and `.env.corteo`. The vision note still uses the old ones.
5. Headless (`occ tools call`, MCP with no tab) runs only the server-direct set in `src/agent/external-tool-policy.ts`. It includes `listen_to_song`, `detect_beats`, `edit_item`, `split_item`, `music_reaction_plan`, `apply_music_reaction`. It does not include `apply_ken_burns`, `transcribe_track`, `score_moments` or `make_shorts`.
6. `listen_to_song` lists only the first 8 downbeats in its JSON. `detect_beats` with `itemId` returns up to 200 `timelineDownbeatFrames`. Cuts use `detect_beats`.
7. `apply_music_reaction` needs a cached model analysis (packs `rhythm-lite` and `music-semantics-lite`); without one it answers `missing-model-packs`. On this machine `rhythm-lite` is not installed (`~/.openchatcut/asr-models/musetric` holds 8 KB).
8. `assets/agent/openchatcut-tool-schemas.json` is generated from `TOOL_SCHEMAS` only. MCP control tools (`openchatcut_status`, `list_projects`, …) are not in it; `callControlTool` in `server/external-agent/mcp.ts` runs them before any project binding.
9. `server/plugins/request-shape-gate.ts` refuses POSTs that are neither the MCP route nor a same-origin browser request (loopback socket, loopback `Host`, `Sec-Fetch-Site: same-origin|none`, `Origin` equal to `Host`). A local script that calls `/api/keys` or `/api/model-packs/*` sends those headers.
10. `scripts/no-claudia.verify.mjs` fails on any tracked file outside `docs/plans/` that contains `claudia` in any case, even `claudia-bot`, unless the file is on its fixed list. New code, skills, scripts and README lines must not contain it. That is why `docs/ideas/` stays untracked and why `CLAUDIA_E2E_MEDIA_DIR` becomes `CORTEO_E2E_MEDIA_DIR`.
11. `scripts/verify-registration.verify.mjs` reads `git ls-files`: stage a new verify (`git add <path>`) before that gate can pass.
12. CLI verifies render with `--dry-run` (`cli/jobs.verify.ts` says why). Real renders are proved by acceptance scripts. Remotion's headless shell is in `node_modules/.remotion/chrome-headless-shell` here, so real renders work offline.
13. `scripts/corteo-acceptance.verify.mjs` pins strings in `skills/corteo/SKILL.md`: `scripts/corteo`, `NPM_CONFIG_PREFIX`, `mcp token --show`, `detect_beats`, `--resolution 4k`, `1080x1920`, `Receta rápida`, `--to-audio`, `--mode cover`, `--background blur`, `while your editor is on`, `CORTEO_STORE_DIR`. Keep them.
14. `cli/errors.ts`: `UsageError` exits 2, `CliError` exits 1.
15. The PROGRESS row C-13 is `doing` from an earlier session. It is not an EV card. Leave it.

## This machine (2026-10-28)

- WSL Ubuntu, 8 cores, 23 GB RAM, no GPU. `node -v` is v24 through nvm; in a fresh shell run `source ~/.nvm/nvm.sh && nvm use 24`. Renders need `CC_RENDER_GL=swangle`.
- `~/.local/bin/ffprobe` is a dangling link. In shell use `FFPROBE="$(node -p "require('@ffprobe-installer/ffprobe').path")"`; in TypeScript use `ffprobeBin()` and `ffmpegBin()` from `server/media-binaries.ts`. `ffmpeg` on PATH works.
- `pnpm` on PATH is the Windows shim under `/mnt/c/…`. EV-15 stops the harness install from depending on it.
- DeepSeek Harness is installed in `~/.corteo-harness` (runtime, the vendor clone at the pinned commit, `our-free-model/settings.json`). At planning time nothing listened on 3080, 18899 or 5199.
- Untracked and not yours: `.local-bin/ .local-libs/ .wb-write-test.md .workbuddy-ai/ docs/ideas/ screenshots/ test-media/`. Never stage them.
- Long-running processes (`npm run corteo:local`, `npm run editor-host`, `npm run brain:serve`) go in tmux or `nohup … > "$T/<name>.log" 2>&1 &`. The card stops them before it commits.

## Decisions made

Locked by Carlos (do not reopen):

- L1. The user-facing name is corteo. Do not rename the product back to Claudia. Keep `OPENCHATCUT_*`, `occ` and the OpenChatCut credits as they are.
- L2. Host profiles exist for `grok`, `muse` and `claude-duet`. Same editor, same skill text. A profile is data: skill dest, media inbox, export dir, `render_gl=swangle`, `providers=off`, locale `es`, default short `1080x1920@30`, MCP URL, brain URL.
- L3. Delivery is both: the MP4 in `~/corteo-exports` and a path the host can attach in chat.
- L4. Lyric priority: text the person pasted, then a `.txt` or `.lrc` beside the audio file, then the local transcript.
- L5. The brain is DeepSeek Harness plus the pinned Our Free Model plugin (`config/harness.json`). It does not replace `server/agent-runs/`. Do not use `dsh --profile acp`.
- L6. The installer also installs and starts the brain. If that step fails, the video self-test still passes. The failure is its own named step (`brain`), not a failed render.
- L7. Apps see three model aliases: `corteo-edit`, `corteo-draft`, `corteo-fast`. Raw lane ids stay inside the router.
- L8. `corteo-edit` may draft arguments only for split, text titles and social copy. It cannot render, publish, delete or open an edit session. The host applies the JSON with a real tool.
- L9. `delegate` is one MCP tool: alias, kind, schema, input excerpt, max tokens. Reply is JSON plus lane and latency, or `brain_unavailable`. Cap retries at one validator round trip.
- L10. On HTTP 429 or timeout, try the next lane that passed the last probe. If none remain, return `brain_unavailable`.
- L11. Anonymous free lanes only. No plugin account login, no EAC, no LAN forward, no public MCP, no paid provider inside the editor.
- L12. Do not send the MCP token, `.env.corteo` or the whole project JSON to a lane.
- L13. The plan files are committed locally before the night; Terra pushes only at night-loop step 9. (Carlos, 2026-10-28.)
- L14. Terra may download the music packs `rhythm-lite` and `music-semantics-lite` through the editor's model-pack route for EV-25. (Carlos, 2026-10-28.)
- L15. The bot path goes first (hosts, round trip, song film, shorts, brain, router, delegate, IDE door), then L-12, the three L-11 cards and L-13, then acceptance and README. (Carlos, 2026-10-28.)

Made while planning (the plan left these open; Terra follows them):

- D1. Host profiles are `config/hosts/<name>.json`, read by `cli/host-profile.ts` and exposed as `occ host list|show|install`.
- D2. Skill destinations, user scope, as found on this machine: grok `~/.grok/skills/corteo/SKILL.md` (the Grok CLI's `create-skill`), muse `~/.config/muse/skills/corteo/SKILL.md` (Muse's personal scope; Muse prefers `muse skills install <dir>`, printed as the next step), claude-duet `~/.claude/skills/corteo/SKILL.md` (Claude Code's user skills). Inbox `~/corteo-inbox/<host>`. Exports `~/corteo-exports`. `CORTEO_MEDIA_INBOX`, `CORTEO_EXPORT_DIR` and `CORTEO_SKILL_DEST` override.
- D3. One render per job. `exportPath` sits in the export dir and `attachPath` is the same absolute path. The inbox round trip renders 720p, the song film 1080p.
- D4. Lyrics: pasted (an LRC-shaped paste keeps its times), then `<song>.lrc`, then `<song>.txt`, then the transcript lines from `listen_to_song`, then none. Untimed lines are spread over the downbeats in range.
- D5. The song film is an `occ song-film` composition of existing tools, not a new MCP tool; the skill lists the same order for MCP hosts. Two commits: place, then animate. Ken Burns owns `scale/x/y` on stills; the energy curve owns `saturate` on stills, `brightness` on solids and `scale/opacity` on lyric cards; `destello` owns `brightness` on stills.
- D6. `apply_ken_burns` joins the headless set: a pure generator and one batch.
- D7. Shorts stay in the browser tier; `npm run editor-host` is the tab on a VM. The night adds `reviewEs` to `score_moments` and the host recipe, not a headless shorts path.
- D8. The brain process is `scripts/harness/brain.mjs serve`: dsh web, the alias router on `127.0.0.1:18890`, and the lane probe (the nine lanes that answered 200 in HW-3, one 16-token request each, 300 ms apart, at start and every 6 hours). The router's bearer is the plugin's forward key. The editor's request-shape gate does not change.
- D9. Ladders: `corteo-edit` is its listed lanes (Nemotron 3 Ultra first, the lane that completed a real cut) that passed the probe; `corteo-draft` is the passing lanes that returned prose, fastest first; `corteo-fast` is the passing lanes, fastest first. Next lane on 429, 408, 404, 5xx or first-byte timeout. Stop on 401/403 (`forward_key_rejected`) and on connection refused (`forward_down`).
- D10. `delegate` is an MCP control tool like `openchatcut_status`: no project, no tab, no edit session, and not in the built-in chat (that chat already runs on these models). `tool_args` targets: `split_item`, `edit_item` (text adds only), `write_clip_title`, `write_social_copy`, with alias `corteo-edit` only.
- D11. The boot links the editor through its own `/api/keys` route, the call the Settings page makes, from loopback with same-origin headers. It writes `LLM_DSH_API_KEY` and `LLM_DSH_BASE_URL` only when `/api/keys/test` fails for the saved ones, never `LLM_DSH_MODEL`, and never edits the profile's settings file directly.
- D12. When `pnpm --version` fails, the harness install runs `npm install --prefix ~/.corteo-harness/tools pnpm@10`. Never `-g`.
- D13. The approval in L14 also covers the local Whisper model that `transcribe_track` fetches in EV-12, and only when a talking video is present.
- D14. A card that changes `package.json` or `config/` runs its own verifies and both registration gates; the full suite runs once at night-loop step 8 (and again inside `sync-publish.sh`).
- D15. L-11 is three cards (EV-22 to EV-24). The server PNG in the dialog and the "Escuchar con oído real" button stay out: both need a new route. L-11 is `done` when all three are.
- D16. Committed code uses `CORTEO_E2E_MEDIA_DIR` (default `~/corteo-media`), not the old variable.
- D17. `docs/ideas/` stays untracked.
- D18. Screenshots go to `test-results/corteo/`, never committed.
- D19. A card whose hard need is `blocked` is set to `blocked` ("needs EV-xx, which is blocked") with no attempts. A need marked `(soft)` only has to be `done` or `blocked`.

## Hard rules

- No questions to Carlos. An open choice is already closed above.
- A command with no output for 15 minutes is a failure. Kill it, block the card, continue.
- Do not install system packages, global tools, or new npm dependencies unless the card names the package.
- Do not add Python, WhisperX, demucs, torch, Docker, or a new UI framework.
- Do not edit `grok-wip` or merge it.
- Do not print the MCP token or the harness forward key into a file that gets committed, or into the chat log.
- Do not turn on the plugin's LAN forward.
- Source files stay at or under 500 lines. Tests can be longer.
- Match the surrounding code. No drive-by refactors.
- `docs/ideas/evolution-of-corteo.md` stays a vision note. Do not turn it into a task list.

Added for this repo:

- Never run `occ host install` or `install.sh --host-profile` with the real `HOME`: it would add a skill to Carlos's own Grok, Muse or Claude setup. Use a temp `HOME`.
- No new tracked file outside `docs/plans/` may contain `claudia` in any case.
- Never stage `docs/ideas/` or the untracked folders listed under "This machine".
- Stage a new verify before running `node scripts/verify-registration.verify.mjs`.

## Night loop

1. `git status`. If a tracked file is dirty and you did not edit it, stop and write the paths into `PROGRESS.md` Blockers. Do not revert someone else's work.
2. If an EV card is `doing`, resume it. Otherwise take the first `todo` whose Needs are all `done`.
3. Set it to `doing`. Implement only that card.
4. Run the card's verify commands. Fix failures. At most 3 attempts on the same error. After the third: `git restore` the files from that attempt, set the card to `blocked`, write the command, the error tail, what you tried, and what would unblock it. Commit that. Continue.
5. Stage by path. Never `git add -A` or `git add .`. Never commit `.env.corteo`, tokens, media, or `test-results/`.
6. Commit with the card's message. Set the card to `done` in the same commit.
7. Repeat until no EV card is `todo` or `doing`.
8. Run `npx tsc -b`, `npm run lint`, and `CC_RENDER_GL=swangle npm test`, then `npm run build`. If the full test fails, fix only failures your cards caused. A failure that already existed goes under Blockers.
9. Publish. From a clean tree, Node 24:

   ```bash
   bash scripts/sync-publish.sh
   ```

   That fetches `github` and `origin`, merges `github/main` and `origin/cursor/video-editor-mvp-d191`, runs the tests again, then pushes `HEAD` to `github` `main` (https://github.com/uset82/corteo) and to `origin` `cursor/video-editor-mvp-d191`. Never force-push. Never rewrite history. If a merge conflicts, fix only the conflicted files, `git add` those paths, commit, and run the script again.

   If `origin` does not exist, do not invent a remote. Fetch and merge `github/main` yourself, run `CC_RENDER_GL=swangle npm test`, then `git push github HEAD:main`. Record that `origin` was missing.

10. Write a short report at the top of the EV section: done ids, blocked ids and why, commit shas, the `npm test` exit line, and the push result. Then stop. Do not start a new idea.

How these cards meet the loop:

- Step 2: "Needs are all `done`" reads with D19. A blocked hard need blocks the card at once; a soft need may be `blocked`.
- Step 4: `git restore` covers tracked files. Delete the files that attempt created by path (`rm <path>`), never `git clean`.
- Step 6: each card's outputs go under PROGRESS › "EV: results" in the same commit.
- Step 8: commit a fix found by the full gate as `EV-<card>: fix <what> found by the full gate`.
- Step 10: the report is written after the push. Commit it alone (`EV: night report`, PROGRESS only) and run `bash scripts/sync-publish.sh` once more. If that second publish fails, leave the report committed locally and say so in it. Then stop.

## Cards

Each card names what to read, what to create or edit, the exact behavior, when it is done, what to run, the commit message and what it leaves out. Commands that did not exist when this plan was written are marked "unproven": Terra runs them in the card and pastes the real output. The registration gates are `node scripts/verify-registration.verify.mjs` and `node scripts/verify-gate-coverage.verify.mjs`.

Every card that changes code also runs `npm run verify:affected -- <the code files it changed>` (an explicit list without `package.json`, `config/` or docs). An exit code 2 that only names files it cannot map is not a failure: the full suite runs at night-loop step 8 (D14).

### EV-00 · Baseline before the first change
- Needs: none.
- Do (no product code):
  1. `git status --short` and `git log -1 --format='%h %s'`. Only the untracked paths under "This machine" may show; a dirty tracked file → night-loop step 1. `git remote -v` lists `github` and `origin`.
  2. `node -v` prints v24.x.
  3. `npx tsc -b`; `npm run lint` (count errors, not warnings); `CC_RENDER_GL=swangle npm test`. Keep its last line (`✓ N test segments passed in …` or `✗ N/M segments FAILED …`) and the failing segment names.
  4. Machine facts: `ls node_modules/.remotion/chrome-headless-shell`; `node -p "require('@ffprobe-installer/ffprobe').path"`; `command -v pnpm`; `node -p "require(process.env.HOME + '/.corteo-harness/runtime/node_modules/@deepseek-ai/dsh/package.json').version"`; `curl -s -o /dev/null -w '%{http_code}\n' --max-time 2 http://127.0.0.1:5199/`.
  5. `AGENTS.md` › "Where the plan is": add one bullet: "`docs/plans/07-evolution.md`: Plan 7 (the evolution night: host profiles, the phone round trip, the song film, the shorts review, the free-model brain, `delegate`, the IDE door). Its task cards are in that file." Without it, AGENTS.md calls every unlisted plan obsolete.
- Done when: PROGRESS › "EV: results" has an EV-00 entry with the commit, the three gate results and the five facts, and AGENTS.md lists Plan 7.
- Verify: the commands above; `node scripts/no-claudia.verify.mjs`.
- Commit: `EV-00: record the baseline and list Plan 7 in AGENTS.md` (AGENTS.md and PROGRESS.md only).
- Out of scope: fixing what the baseline shows. A failure that already exists goes under "EV: blockers" with its output; step 8 does not count it against the night.

### EV-01 · Host profiles are data: grok, muse, claude-duet
- Needs: EV-00 (soft).
- Read: `cli/main.ts` (`USAGE`), `cli/router.ts` (`dispatch`), `cli/commands/mcp.ts` (a small command), `cli/args.ts`, `cli/errors.ts`, `cli/cli.verify.ts` (child process, temp `HOME`, `OPENCHATCUT_DATA_DIR`, no `OPENCHATCUT_DEV_PROFILE_ID`), `scripts/build-cli.mjs` (the bundle keeps `import.meta.url`).
- Create: `config/hosts/grok.json`, `config/hosts/muse.json`, `config/hosts/claude-duet.json`; `cli/host-profile.ts` (≤200 lines); `cli/commands/host.ts` (≤120 lines); `cli/host-profile.verify.ts`.
- Edit: `cli/router.ts` (`case 'host'`), `cli/main.ts` (three usage lines), `package.json` (`tsx cli/host-profile.verify.ts` in `test:serial`).
- Profile (grok shown; muse and claude-duet differ only in `host`, `skillDest` and `mediaInbox`, per D2):

  ```json
  {
    "version": 1,
    "host": "grok",
    "displayName": "corteo",
    "skillDest": "~/.grok/skills/corteo/SKILL.md",
    "mediaInbox": "~/corteo-inbox/grok",
    "exportDir": "~/corteo-exports",
    "renderGl": "swangle",
    "providers": "off",
    "locale": "es",
    "defaultShort": { "width": 1080, "height": 1920, "fps": 30 },
    "mcpUrl": "http://127.0.0.1:5199/api/external-mcp/mcp",
    "brainUrl": "http://127.0.0.1:18890/v1",
    "brainAliases": ["corteo-edit", "corteo-draft", "corteo-fast"]
  }
  ```

- Behavior:
  - `loadHostProfile(name, { env = process.env, home = os.homedir() })` reads `config/hosts/<name>.json` from `new URL('../config/hosts/', import.meta.url)` (one level up works from `cli/` and from the bundled `cli-dist/occ.mjs`). Unknown name → `CliError('unknown host profile "<name>": use grok, muse or claude-duet')`.
  - `validateHostProfile(raw, name)` returns a list of problems: `version` is 1; `host` equals the file name; `displayName` is `corteo`; `renderGl` is `swangle`; `providers` is `off`; `locale` is `es`; `defaultShort` is exactly 1080, 1920, 30; `mcpUrl` and `brainUrl` start with `http://127.0.0.1:`; `brainAliases` is the three aliases in that order; the path fields start with `~/` or `/`; no other keys. Problems → `CliError('config/hosts/<name>.json: <problems joined by "; ">')`.
  - A leading `~/` expands with `home`. Then the env overrides: `CORTEO_MEDIA_INBOX`, `CORTEO_EXPORT_DIR`, `CORTEO_SKILL_DEST` (absolute after expansion, else `CliError('<VAR> must be an absolute path')`); `CORTEO_PORT` replaces the port in `mcpUrl`.
  - `occ host list --json` → `{"hosts":["claude-duet","grok","muse"]}` (sorted file names).
  - `occ host show <name> --json` → the resolved profile plus `skillSource` (absolute path of `skills/corteo/SKILL.md`).
  - `occ host install <name> --json` → `mkdir -p` the inbox, the export dir and the skill's folder; copy `skills/corteo/SKILL.md` to `skillDest` only when the bytes differ; print `{"ok":true,"host","skillPath","skillChanged","mediaInbox","exportDir","next"}`. `next` is Spanish: muse → `Muse instala skills con: muse skills install <carpeta del skill>`; the others → `Reinicia <host> para que cargue el skill corteo.`. This module never imports `cli/store.ts`: no project library is touched.
- `cli/host-profile.verify.ts` (child process, temp `HOME`):
  1. The three profiles load; their key sets match; every value except `host`, `skillDest` and `mediaInbox` is deep-equal across the three.
  2. `install` for each host writes a file byte-identical to `skills/corteo/SKILL.md`; a second run reports `skillChanged:false`.
  3. `CORTEO_EXPORT_DIR=<absolute>` wins; `CORTEO_EXPORT_DIR=relative` exits 1 with the exact message.
  4. `host show nope` exits 1 with the exact message. `validateHostProfile` on a copy with `renderGl: "angle"` returns that problem.
  5. No fork: `git grep -n -i -w -E "muse|claude-duet" -- src server shared remotion desktop` finds nothing (git grep exit 1 is the pass). `cli/` and `config/hosts/` may name hosts. `grok` is not checked: upstream xAI code uses the word.
- Done when: the verify passes, and `npm run corteo -- host show muse --json` prints the expanded profile (unproven: paste `skillDest` and `mediaInbox` into the EV-01 note).
- Verify: `npx tsc -b`; `npx tsx cli/host-profile.verify.ts`; `npm run verify:cli`; `git add` the new files; the registration gates.
- Commit: `EV-01: host profiles are data, and occ host lists, shows and installs them`.
- Out of scope: launching Grok, Muse or Claude Duet; a brand skin per host.

### EV-02 · The installer takes `--host-profile`
- Needs: EV-01.
- Read: `install.sh` (`parse_args`, `usage`, `print_dry_run`, `prepare_profile`, `ensure_token`, `write_report`, `main`), `scripts/install.verify.mjs`.
- Edit: `install.sh`, `scripts/install.verify.mjs`.
- Behavior:
  - `--host-profile <name>` and `--host-profile=<name>`, env fallback `CORTEO_HOST_PROFILE`, default none (today's behavior). In `parse_args`, anything but `grok`, `muse` or `claude-duet` → `die "unknown host profile: <name> (use grok, muse or claude-duet)"`.
  - `usage`: `--host-profile <name>  Bot host: grok, muse or claude-duet (installs the skill where that host reads it, creates its inbox and exports folder)`. The `--host` line keeps meaning the bind address.
  - `print_dry_run`: `report CORTEO_HOST_PROFILE "${HOST_PROFILE:-none}"`.
  - New `install_host_profile`, called in `main` after `prepare_profile` and `ensure_token`: `stage "host profile"`; `"$NODE_BIN" "$APP_DIR/cli-dist/occ.mjs" host install "$HOST_PROFILE" --json`; read `skillPath`, `mediaInbox` and `exportDir` with `node -e`. A failure dies with stage `host profile` (asked for, so not optional).
  - `write_report`: `CORTEO_HOST_PROFILE`, `CORTEO_SKILL_PATH`, `CORTEO_MEDIA_INBOX`, `CORTEO_EXPORT_DIR` (`none` with no profile).
- `scripts/install.verify.mjs`: help lists `--host-profile`; `--dry-run --host-profile muse --json` has `"CORTEO_HOST_PROFILE":"muse"` and creates no files; `--dry-run --host-profile nope` fails with the message; `REPORTED` gains the four keys; the source calls `install_host_profile` after `prepare_profile`.
- Done when: `npm run verify:install` passes, and `bash install.sh --dry-run --host-profile claude-duet` prints `CORTEO_HOST_PROFILE=claude-duet` (unproven).
- Verify: `bash -n install.sh`; `npm run verify:install`.
- Commit: `EV-02: the installer takes a host profile and puts the skill where that host reads it`.
- Out of scope: a full install run. It clones GitHub `main`, which gets tonight's work only at step 9.

### EV-03 · The skill speaks as one bot and tells the truth about the install
- Needs: EV-02 (soft).
- Read: `skills/corteo/SKILL.md`, `scripts/corteo-acceptance.verify.mjs`, `bot/skills/corteo-setup/SKILL.md`, `install.sh` (`write_report`, `self_test`).
- Edit: `skills/corteo/SKILL.md`. Create: `scripts/corteo-skill.verify.mjs`. Edit `package.json` (`node scripts/corteo-skill.verify.mjs` in `test:serial`).
- Changes (English prose like the rest of the file; Spanish only for what the bot says to the person):
  1. Description: add "turn a long video into vertical shorts, or a song and its lyrics into a lyric film".
  2. New first section `## One name`: the person talks to one bot, corteo, on any host (Grok, Muse, Claude Duet, an IDE). Speak as corteo. Never introduce a second program. The editor page is optional.
  3. `## Install`: the curl line runs the self-test: `curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/install.sh | bash -s -- --self-test`. Optional `--host-profile grok|muse|claude-duet` (when EV-02 is done). PASS is `CORTEO_SELF_TEST=pass`. A failure is `CORTEO_STATUS=failed` with `CORTEO_FAILED_STAGE=self-test` and `[corteo] error: self-test failed at step '<step>'` on stderr. The app lands in `~/corteo/app` and the report in `~/corteo/corteo.env`. After a curl install the command is `. ~/corteo/corteo.env` then `"$CORTEO_OCC"`; in a developer checkout at `~/corteo` it stays `~/corteo/scripts/corteo`. Both forms come from `bot/skills/corteo-setup/SKILL.md`, which `scripts/bot-rehearsal.sh` replays; say so in the card's note.
  4. `## Size`: "short", "reel", "story", "TikTok" or "vertical" → `--size 1080x1920 --fps 30`; "video" with no platform → `--size 1920x1080 --fps 30`.
  5. `## Delivery`: every render goes to `~/corteo-exports/<name>.mp4` (or the host profile's `exportDir`), and the bot attaches that same absolute path in the chat. Never a relative path.
  6. Keep every string that `scripts/corteo-acceptance.verify.mjs` pins.
- `scripts/corteo-skill.verify.mjs` asserts the skill contains `## One name`, `CORTEO_SELF_TEST=pass`, `corteo.env`, `CORTEO_OCC`, `1080x1920` and `~/corteo-exports`, and does not contain `CORTEO_SELF_TEST=PASS`, `claudia` (any case) or `Bearer ` followed by 20 or more of `[A-Za-z0-9_-]`. Later cards add their own assertions here.
- Done when: the gates below pass.
- Verify: `node scripts/corteo-skill.verify.mjs`; `node scripts/corteo-acceptance.verify.mjs`; `node scripts/no-claudia.verify.mjs`; the registration gates.
- Commit: `EV-03: the skill speaks as one bot and says what the installer really prints`.
- Out of scope: `bot/skills/*` (the recipe has its own build gate; leave it).

### EV-04 · One render function for every verb that writes an MP4
- Needs: EV-00 (soft).
- Read: `cli/commands/render.ts` (`runRenderCommand`), `cli/jobs.ts`, `cli/jobs.verify.ts`.
- Create: `cli/render-file.ts` (≤200 lines). Edit: `cli/commands/render.ts`.
- Behavior: move everything after flag parsing and `--detach` into `renderProjectToFile(options)`:
  - `options`: `{ projectId, output, timelineId?, format?: 'video'|'audio', codec?, resolution?: '480p'|'720p'|'1080p'|'4k', fps?, bitrate?, fromFrame?, endFrameExclusive?, toAudio?, quiet?, dryRun? }`.
  - Returns `{ projectId, timelineId, output, bytes, codec, frames, durationSeconds, dryRun, scale, frameRange }` (`bytes: 0` on a dry run).
  - It calls `setUploadsDirProvider(uploadDir)` itself. `runRenderCommand` keeps parsing and `--detach`, and prints exactly the keys it prints today for dry and real runs.
- Done when: `npm run verify:cli` and `npx tsx cli/jobs.verify.ts` pass unchanged, and `occ render --dry-run --json` on a scratch project prints the same keys as before (paste both key lists in the note).
- Verify: `npx tsc -b`; `npm run verify:cli`; `npx tsx cli/jobs.verify.ts`.
- Commit: `EV-04: one render function for every occ verb that writes an MP4`.
- Out of scope: any change to the render pipeline itself.

### EV-05 · Phone round trip without a phone: `occ inbox`
- Needs: EV-01, EV-04.
- Read: `cli/session.ts` (`runToolSession` and its result shape), `cli/store.ts` (`createProject`), `cli/commands/media.ts`, `cli/commands/item.ts` (`fit`), `cli/host-profile.ts`, `cli/render-file.ts`.
- Create: `cli/commands/inbox.ts` (≤250 lines), `cli/inbox.verify.ts`. Edit: `cli/router.ts`, `cli/main.ts`, `package.json` (`test:serial`), `skills/corteo/SKILL.md`, `scripts/corteo-skill.verify.mjs`.
- Command: `occ inbox --host <grok|muse|claude-duet> [--file <abs>] [--resolution 720p] [--to <frame|4s>] [--dry-run] [--json]`.
- Behavior:
  1. `--host` is required: `UsageError('inbox needs --host grok, muse or claude-duet')`.
  2. Input: `--file` (absolute and existing, else `UsageError('--file must be an absolute path that exists')`), or the newest regular file in the profile's inbox with extension `mp4 mov m4v webm mkv jpg jpeg png webp wav mp3 m4a` that is not listed in `<inbox>/.corteo-done.json` (array of `{ file, mtimeMs, output, at }`). None → exit 1, stderr `inbox is empty: <inbox>`, and with `--json` stdout `{"ok":false,"error":"inbox_empty","inbox":"<inbox>"}`.
  3. `createProject({ name: "<host> <basename>", width, height, fps })` from `defaultShort`.
  4. Session 1 (apply, summary `Del teléfono al MP4: importar`): `import_asset { path }`. Session 2 (apply, `Del teléfono al MP4: colocar`): video → `edit_item` add `{ type:'video', assetId, fromFrame:0 }`; image → `{ type:'image', assetId, fromFrame:0, durationInFrames: 6*fps }`; audio → `{ type:'solid', color:'#111111', fromFrame:0, durationInFrames: <audio frames> }` plus `{ type:'audio', assetId, fromFrame:0 }`. Session 3 (apply, `Del teléfono al MP4: encuadre`): `edit_item` update `fit:'cover'` on the video or image.
  5. `process.env.CC_RENDER_GL ??= profile.renderGl`. `renderProjectToFile` with `resolution` (default `720p`), `endFrameExclusive` from `--to` or the shorter of the clip and 60 s, output `<exportDir>/<slug>-<YYYYMMDD-HHMMSS>.mp4` (slug: lowercase, runs of anything but `[a-z0-9]` → `-`).
  6. After a real render (not `--dry-run`), append the input to `.corteo-done.json`.
  7. stdout, one object: `{"ok":true,"host","input","projectId","exportPath","attachPath","width","height","fps","durationSeconds","bytes","dryRun"}`, with `attachPath === exportPath` (L3).
- `cli/inbox.verify.ts` (child process; temp `HOME`, `OPENCHATCUT_DATA_DIR`, `CORTEO_MEDIA_INBOX`, `CORTEO_EXPORT_DIR`; ffmpeg through `ffmpegBin()`): empty inbox → exit 1 and `inbox_empty`; a 2 s 1280x720 clip with `--dry-run` → every key present, `exportPath` under the export dir, `attachPath === exportPath`, canvas 1080x1920, one video item with `fit: "cover"` (`occ timeline items --json`), no `.corteo-done.json`; `--host nope` → exit 1 with the profile message.
- Skill: section `## Del teléfono al MP4`: save the attachment into the host inbox (`occ host show <host> --json` gives `mediaInbox`), run `"$CORTEO" inbox --host <host> --json`, send `attachPath` back in the same thread. Add `inbox --host` to the skill gate.
- Done when (live, unproven): with `T=$(mktemp -d)`, `CORTEO_MEDIA_INBOX=$T/inbox CORTEO_EXPORT_DIR=$T/exports CORTEO_STORE_DIR=$T/library` and a 3 s 1280x720 clip in `$T/inbox`, `CC_RENDER_GL=swangle ~/corteo/scripts/corteo inbox --host grok --json` prints `ok:true`, and `"$FFPROBE" -v error -show_entries stream=width,height -show_entries format=duration -of json <exportPath>` reports 720x1280 and 3.0 ±0.1 s. Paste the JSON and the ffprobe values; `rm -rf "$T"`.
- Verify: `npx tsc -b`; `npx tsx cli/inbox.verify.ts`; `npm run verify:cli`; `node scripts/corteo-skill.verify.mjs`; the registration gates.
- Commit: `EV-05: a file dropped in the host inbox comes back as a 720p vertical MP4 path`.
- Out of scope: a phone, a tunnel, the mobile upload page.

### EV-06 · `apply_ken_burns` runs with no editor tab
- Needs: EV-00 (soft).
- Read: `src/agent/external-tool-policy.ts` (`SERVER_DIRECT_EDIT_TOOL_NAMES`), `server/external-agent/offline-tools.ts` (`OFFLINE_SCHEMA_GROUPS`), `server/external-agent/offline-executor.ts` (`executeOfflineTool`), `src/agent/tools/ken-burns-tools.ts`, `src/editor/kenBurns.ts`, `server/external-agent/offline-runtime.verify.ts`.
- Edit:
  - Policy: `apply_ken_burns: true`, with a comment in the style of its neighbours (pure generator, one `ctx.commands.batch`, no media IO).
  - Offline schemas: add `KEN_BURNS_TOOL_SCHEMAS` to `OFFLINE_SCHEMA_GROUPS`.
  - Executor: `if (name === 'apply_ken_burns') { const { execKenBurnsTool } = await import('../../src/agent/tools/ken-burns-tools.js'); return execKenBurnsTool(name, args, ctx); }`.
  - `offline-runtime.verify.ts`: add `'apply_ken_burns'` to the allowed list.
  - `cli/cli.verify.ts`: import a generated PNG, place it, `tools call apply_ken_burns --args '{"itemId":"…","direction":"in"}' --apply --json` → the item has `scale` keyframes.
- Done when: the verifies pass, and `npm run corteo -- tools ls --json` lists `apply_ken_burns` with `headless: true` (unproven: paste the row).
- Verify: `npx tsc -b`; `npx tsx server/external-agent/offline-runtime.verify.ts`; `npm run verify:cli`; `npm run verify:mcp`; `npm run verify:agent-tools`; `npm run generate:server-tool-catalog`, then `npm run verify:server-tool-catalog` (commit any diff).
- Commit: `EV-06: Ken Burns runs without an editor tab`.
- Out of scope: the other browser-tier tools (`score_moments`, `make_shorts`, `transcribe_track`) stay where they are (D7).

### EV-07 · Lyrics in: the paste, a file beside the song, the transcript
- Needs: EV-00 (soft).
- Read: `src/audio/listen/songMap.ts` (`SongLyricWord`, `normalizedLineText`), `src/audio/listen/index.ts`, `src/captions/srt.ts`.
- Create: `src/audio/listen/lyricsInput.ts` (≤250 lines, pure, no Node APIs), `src/audio/listen/lyricsInput.verify.ts`. Edit: `src/audio/listen/index.ts` (export), `package.json` (`test:serial` and `verify:music-intelligence`).
- API:
  - `parseLrc(text): SongLyricWord[] | null`. Stamps `[mm:ss]`, `[mm:ss.xx]`, `[mm:ss.xxx]`; several stamps on one line → one entry each; `[ar:] [ti:] [al:] [by:] [length:]` ignored; `[offset:±ms]` applied; entries sorted; `endMs` is the next start, the last gets start + 4000; empty text dropped; `null` when no line has a stamp.
  - `splitPlainLyrics(text): string[]`. Trim; drop empty lines and marker lines (`[Coro]`, `[Verso 1]`, `[Chorus]`, `(x2)`, `(bis)`); keep order and repeats.
  - `timeUntimedLines(lines, { downbeatsMs, fromMs, toMs, fallbackBarMs = 2000 })`. D downbeats in [fromMs, toMs) and N lines. D = 0 → a grid of `fallbackBarMs` from `fromMs`. N ≤ D → line i starts at downbeat `floor(i * D / N)`. N > D → the lines that share a bar split it evenly. Each line ends at the next line's start; the last at `toMs`.
  - `resolveLyrics({ pasted?, besideLrc?, besideTxt?, transcriptLines?, downbeatsMs, fromMs, toMs }) → { source: 'pasted'|'lrc'|'txt'|'transcript'|'none', lines }` in the D4 order. An LRC-shaped paste keeps its stamps. Lines outside the range are dropped and times clamped.
- Verify: LRC with an offset, metadata and two stamps on one line; plain text with markers; 4 lines over 8 downbeats start on downbeats 0, 2, 4, 6; 6 lines over 2 downbeats; no downbeats → a 2 s grid; each source wins over the next one; range clipping.
- Done when: the verify passes.
- Verify: `npx tsc -b`; `npx tsx src/audio/listen/lyricsInput.verify.ts`; `npm run verify:music-intelligence`; the registration gates.
- Commit: `EV-07: lyrics come from the paste, then a file beside the song, then the transcript`.
- Out of scope: fetching lyrics from the web or from Suno.

### EV-08 · The song-film plan (pure)
- Needs: EV-07.
- Read: `src/editor/kenBurns.ts` (the style of a pure generator), `src/editor/clipTypes.ts` (`KeyframeProp`, `Keyframe`), `shared/music-inference/listen-snapshot.ts` (`curves: { stepMs, energy }`), `src/audio/listen/songMap.ts`.
- Create: `src/editor/songFilm.ts` (≤300 lines), `src/editor/songFilm.verify.ts`. Edit: `package.json` (`test:serial`, `verify:editor`).
- `planSongFilm(input) → plan`:
  - Input: `{ fps, width, height, fromFrame, toFrame (exclusive), downbeatFrames, sections: { fromMs, toMs, role, energy }[], energy: { stepMs, values (0..1) }, lyrics: SongLyricWord[] (song ms; the song starts at frame 0), stills: string[] (asset ids), palette?: string[] }`.
  - Cuts: section starts snapped to the nearest downbeat within one bar, plus a cut every 4th downbeat so no visual lasts more than 4 bars; the first boundary is `fromFrame` and the last `toFrame`. No downbeats → a cut every 2 s and `cutGrid: 'fixed-2s'`; otherwise `cutGrid: 'downbeat'`.
  - Visuals: `{ kind: 'image', assetId: stills[i % n] }` when there are stills, else `{ kind: 'solid', color: palette[sectionIndex % palette.length] }` (default palette: eight dark saturated hex colors). Each has `fromFrame`, `durationInFrames`, `sectionIndex`.
  - Cards: one per lyric line in range: `{ text, fromFrame: round(startMs*fps/1000), durationInFrames: max(round(fps/2), round((endMs-startMs)*fps/1000)), chorus }`. `chorus` when the line has a `chorusGroup` or its `normalizedLineText` repeats. Style `{ position:'center', align:'center', color:'#ffffff', fontSize: round(height*0.045), fontWeight: chorus ? 700 : 400 }`.
  - Keyframes (item-local frames; the energy curve read by linear interpolation at the item's timeline time; two decimals; at most 64 per prop per item): card `scale` every `round(fps/2)` frames = `1 + 0.12*e`, card `opacity` 0 → 1 over the first 6 frames and 1 → 0 over the last 6; image `saturate` every `fps` frames = `0.8 + 0.6*e`; solid `brightness` every `fps` frames = `0.7 + 0.5*e`.
  - Output: `{ cutGrid, cutFrames, visuals, texts }`, each element carrying its `keyframes`.
- Verify: downbeats every 60 frames and 3 sections → every cut is a downbeat or a range edge; no visual over 240 frames; 4 lines → 4 cards at their frames; a repeated line is a chorus; a rising curve gives a later card a larger scale; the caps hold; no downbeats → `fixed-2s`; stills cycle; nothing outside [fromFrame, toFrame).
- Done when: the verify passes.
- Verify: `npx tsc -b`; `npx tsx src/editor/songFilm.verify.ts`; `npm run verify:editor`; the registration gates.
- Commit: `EV-08: a song film is planned from downbeats, lyric lines and the energy curve`.
- Out of scope: any I/O (the planner is pure); placing and rendering (EV-09, EV-10).

### EV-09 · `occ song-film`: place the film
- Needs: EV-04, EV-08.
- Read: `cli/session.ts`, `cli/store.ts`, `cli/commands/tools.ts`, `server/external-agent/offline-beats.ts`, `src/agent/tools/beat-tools.ts` (`timelineDownbeatFrames`), `server/music-listen/tool.ts` (`listenSong`), `shared/music-inference/listen-snapshot.ts`, `server/music-listen/listen.verify.ts` (`synthSong`, `wavFile`).
- Create: `cli/song-film/run.ts` (≤350 lines), `cli/commands/song-film.ts` (≤150 lines), `cli/song-film.verify.ts`. Edit: `cli/router.ts`, `cli/main.ts`, `package.json`.
- Command: `occ song-film --audio <abs> [--lyrics-text "<text>"] [--stills <abs>,<abs>…] [--size 1080x1920] [--fps 30] [--from 0] [--to 30s] [--name "<name>"] [--host <name>] [--json]`.
- Steps:
  1. `--audio` absolute and existing, else `UsageError('song-film needs an absolute --audio path that exists')`; each still the same (`UsageError('--stills must be absolute paths that exist: <path>')`). Size: `--size`, else the `--host` profile's `defaultShort`, else 1080x1920 at 30 fps. `--to` defaults to 30 s and is clamped to the song.
  2. `createProject`.
  3. Session `import` (apply): `import_asset` for the audio and each still.
  4. Session `audio` (apply): `edit_item` add `{ type:'audio', assetId, fromFrame:0 }` → the audio item id.
  5. Reads (no apply): `detect_beats { itemId }` → `timelineDownbeatFrames`, `bpm`; `listen_to_song { itemId, pictures:false, fromMs, toMs }` → sections, `curves`, transcript `lyrics.lines`. Run each once by hand first (`occ tools call … --json`) and write the real result paths into a code comment: the listen result nests its JSON, do not guess.
  6. Lyrics: `--lyrics-text` → pasted; else `<dir>/<basename>.lrc`, then `<dir>/<basename>.txt`; else the transcript lines → `resolveLyrics`.
  7. `planSongFilm`.
  8. Session `place` (apply, summary `Película de la canción: colocar`): `edit_item` adds for the visuals (`{ type:'image', assetId, fromFrame, durationInFrames }` or `{ type:'solid', color, fromFrame, durationInFrames }`) and the cards (`{ type:'text', text, fromFrame, durationInFrames, fontSize, color, fontWeight, align, position }`) → the placed ids, in order.
  9. stdout: `{"ok":true,"stage":"placed","projectId","audioItemId","bpm","lyricsSource","lines","cutGrid","cuts","visualIds","textIds"}`.
- `cli/song-film.verify.ts` (child process; temp `HOME`, so no model packs leak in): write the 12 s 120 BPM song from a copy of `synthSong`/`wavFile` and `song.txt` with 4 lines beside it; `song-film --audio … --to 12s --json` → `lyricsSource:"txt"`, 4 `textIds`, `cutGrid:"downbeat"`; every visual starts at frame 0 or within ±1 of a frame in a separate `detect_beats` call's `timelineDownbeatFrames`; a run with `--lyrics-text` → `pasted`; a missing audio file → exit 2 with the message. If `detect_beats` answers `bpm: 0` on the synthetic song, raise the downbeat accent in the copy of `synthSong` until it reports 120 ±2 BPM, and record the change.
- Done when: the verify passes.
- Verify: `npx tsc -b`; `npx tsx cli/song-film.verify.ts`; `npm run verify:cli`; the registration gates.
- Commit: `EV-09: occ song-film places a lyric film cut on the downbeats`.
- Out of scope: keyframes, Ken Burns, reactions and the render (EV-10).

### EV-10 · `occ song-film`: move with the energy and render
- Needs: EV-09, EV-06 (soft).
- Create: `cli/song-film/animate.ts` (≤250 lines). Edit: `cli/song-film/run.ts`, `cli/commands/song-film.ts` (`--resolution`, `--out`, `--no-render`, `--dry-run`, `--reactions on|off`), `cli/song-film.verify.ts`, `skills/corteo/SKILL.md`, `scripts/corteo-skill.verify.mjs`.
- Steps after the placement:
  1. Session `animate` (apply, summary `Película de la canción: animar`): card → `edit_item` update `{ type:'text', itemId, keyframes:{ scale, opacity } }`; image → `{ type:'image', itemId, fit:'cover', keyframes:{ saturate } }` and `apply_ken_burns { itemId, direction: ['in','out','left','right'][i % 4] }` (skip Ken Burns when EV-06 is blocked and say so in the JSON); solid → `{ type:'solid', itemId, keyframes:{ brightness } }` (if `edit_item` refuses filter keyframes on a solid, use `opacity` 0.75..1 and record it).
  2. Reactions (`--reactions on` by default): `music_reaction_plan` for `destello` on `downbeats` over the stills (read the exact argument names in `src/agent/tools/schemas/music-intelligence-tools.ts`). A result with `error` (no model analysis) → `reactions: { applied:false, reason:<first 120 characters> }`; otherwise `apply_music_reaction` with the returned `songMapRef` → `{ applied:true, reaction:'destello', keyframes }`.
  3. Render unless `--no-render`: `CC_RENDER_GL ??= 'swangle'`; `renderProjectToFile({ projectId, output: --out ?? <exportDir>/<slug>-<stamp>.mp4, resolution: --resolution ?? '1080p', fromFrame, endFrameExclusive: toFrame, dryRun })`. `exportDir` is the `--host` profile's, else `CORTEO_EXPORT_DIR`, else `~/corteo-exports`.
  4. stdout adds `{"stage":"rendered"|"animated","exportPath","attachPath","keyframedItems","kenBurns","reactions","render":{"bytes","durationSeconds","frames","dryRun"}}`, with `attachPath === exportPath`.
- Verify (extend `cli/song-film.verify.ts`, with `--dry-run`): every card has ≥2 `scale` keyframes and both opacity fades; every image has Ken Burns `scale` plus `x` or `y` keyframes and `saturate` keyframes; `reactions.applied === false` with a reason (temp `HOME`, no packs); `render.dryRun === true` and `render.frames === 360`.
- Skill `## Película de una canción`: the command; the lyric order (L4); render 15 to 30 seconds first and the whole song only when the person asks; the order for MCP hosts with no shell: `import_asset` → `edit_item` (audio) → `detect_beats {itemId}` → `listen_to_song {itemId}` (look at both pictures) → `edit_item` adds → `edit_item` keyframes → `apply_ken_burns` → `music_reaction_plan` and `apply_music_reaction` when a model analysis exists → `occ render`. Assert `song-film` in the skill gate.
- Done when (live, unproven): synthesize a 30 s song (the `synthSong` copy stretched: quiet first 10 s, loud after), three 1080x1920 gradient stills (`ffmpeg -f lavfi -i "color=…,geq=…"` like the 9:16 recipe), `lyrics.txt` with 6 lines; `CC_RENDER_GL=swangle ~/corteo/scripts/corteo song-film --audio … --stills … --to 30s --resolution 1080p --json` → ffprobe 1080x1920, 30.0 ±0.2 s, one audio stream. Paste the JSON (cuts, lines, lyricsSource, reactions), the ffprobe values and the render wall time; delete the scratch folder.
- Verify: `npx tsc -b`; `npx tsx cli/song-film.verify.ts`; `npm run verify:cli`; `node scripts/corteo-skill.verify.mjs`.
- Commit: `EV-10: the song film moves with the energy curve and renders to the exports folder`.
- Out of scope: Suno or any generation call; new reactions.

### EV-11 · Long to short: the review comes before the batch
- Needs: EV-03 (soft).
- Read: `src/agent/tools/shorts-tools.ts` (the `score_moments` result), `src/agent/shorts/types.ts`, `src/agent/tools/make-shorts-tools.ts`, `src/agent/tools/make-shorts-tools.verify.ts` (fixture transcript, `makeDraft`, `setRubricScorer`), `src/agent/tools/shorts-tools.verify.ts`, `src/agent/skills/long-video-to-shorts/SKILL.md`, Plan 6 OP-01 to OP-03.
- Code fact: `transcribe_track`, `score_moments` and `make_shorts` need the editor tab. On a VM, `npm run editor-host` is that tab (P1-5). This card does not make them headless.
- Create: `src/agent/shorts/review-text.ts` (≤120 lines), `src/agent/tools/shorts-host-flow.verify.ts`. Edit: `src/agent/tools/shorts-tools.ts`, `src/agent/tools/shorts-tools.verify.ts`, `src/agent/skills/long-video-to-shorts/SKILL.md`, `skills/corteo/SKILL.md`, `scripts/corteo-skill.verify.mjs`, `package.json`.
- `shortsReviewEs(moments, { max = 5 })` returns one Spanish block of at most 3,000 characters, one entry per moment, in the order `score_moments` returns them:

  ```text
  1. 87/99 · 0:42–1:13 (31 s) — Gancho 90 · Flujo 85 · Valor 88 · Sonido 70
     Por qué: <reason>
     Riesgos: <risks joined with ", ", or "ninguno">
  ```

  and a last line `Tendencia: no disponible (no hay datos de plataforma).`
- `score_moments` adds `reviewEs` to its result. Nothing else in its result changes.
- `long-video-to-shorts` skill: one line: show `reviewEs` to the person and wait for a yes before `make_shorts`.
- `skills/corteo/SKILL.md` `## Vídeo largo a shorts`: one Spanish question with the four constraints (plataforma, cuántos clips, duración, idioma); `npm run corteo:local` and `npm run editor-host -- --project <id>`; over MCP: `target_project` → `transcribe_track` (local) → `score_moments { count: 3, minSeconds, maxSeconds }` → show `reviewEs` → yes → `make_shorts { ranges: <the three from score_moments>, ratio: '9:16' }` → preview the first with `occ render --timeline <sequenceId> --resolution 480p --to 15s` → the batch at 1080p. Assert `reviewEs` in the skill gate.
- `shorts-host-flow.verify.ts`: a 3-minute fixture transcript (at least 6 sentence groups, built like `make-shorts-tools.verify.ts`) and a stub rubric scorer; `score_moments { count: 3 }` → `reviewEs` has three numbered entries with `Por qué` and `Riesgos`; `make_shorts` called with exactly those ranges and `ratio: '9:16'` → 3 clips, each sequence 1080x1920, each with `reason` and `risks`.
- Done when: the verifies pass.
- Verify: `npx tsc -b`; `npx tsx src/agent/tools/shorts-host-flow.verify.ts`; `npx tsx src/agent/tools/shorts-tools.verify.ts`; `npm run verify:agent-tools`; `npm run verify:skills`; `npm run generate:server-tool-catalog`, then `npm run verify:server-tool-catalog`; `node scripts/corteo-skill.verify.mjs`; the registration gates.
- Commit: `EV-11: score_moments hands the host a Spanish review to show before the batch`.
- Out of scope: scoring changes; a headless shorts path.

### EV-12 · Long to short, live
- Needs: EV-11.
- Media: a talking video of at least 2 minutes at `${CORTEO_E2E_MEDIA_DIR:-$HOME/corteo-media}/talk.(mp4|mov|mkv|webm)`. Missing → `blocked`, "no talking video in <dir>". Never synthesize speech.
- Do: a scratch port and library (`CORTEO_PORT=5299 CORTEO_STORE_DIR=$T/library npm run corteo:local` in tmux); `occ project new`, `occ media import`, place the clip; `npm run editor-host -- --project <id>` (tmux); the AGENTS.md MCP smoke test against port 5299, then the skill's calls. `transcribe_track` may download the local Whisper model (D13). Render the three sequences at 480p with `--to 15s`; ffprobe each.
- Done when: three vertical MP4s exist and `reviewEs` was printed before `make_shorts` ran. PROGRESS note: the first 20 lines of `reviewEs`, the three sequence ids, the ffprobe lines. A failing step → `blocked` with its error.
- Verify: the ffprobe lines of the three files.
- Commit: `EV-12: record the live long-to-shorts run` (PROGRESS only; stop both processes first).
- Out of scope: code changes. A fault found here becomes a blocker entry, not a patch.

### EV-13 · The brain's aliases and the lane probe
- Needs: EV-00 (soft).
- Read: `config/harness.json`, `scripts/harness/lib.mjs` (`loadHarnessConfig`, `httpGet`, `forwardKeyFrom`, `writePrivateJson`), `scripts/harness/doctor.mjs` (`findForwardPort`), `scripts/harness/models.mjs`, PROGRESS › "WorkBuddy: model results".
- Edit `config/harness.json`: add this section and keep every existing key:

  ```json
  "brain": {
    "routerPort": 18890,
    "probeIntervalMinutes": 360,
    "probeTimeoutMs": 30000,
    "candidates": [
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "liquid/lfm-2.5-2.6b:free",
      "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      "nvidia/nemotron-3.5-super-vl:free",
      "kilo-auto/free",
      "cohere/north-mini-code:free",
      "dots-studio/dots-3-note-preview:free",
      "nvidia/nemotron-3.5-lightning:free",
      "openrouter/free"
    ],
    "aliases": {
      "corteo-edit": {
        "order": "listed",
        "lanes": [
          "nvidia/nemotron-3-ultra-550b-a55b:free",
          "nvidia/nemotron-3.5-super-vl:free",
          "kilo-auto/free",
          "cohere/north-mini-code:free",
          "nvidia/nemotron-3.5-lightning:free"
        ],
        "firstByteTimeoutMs": 90000
      },
      "corteo-draft": { "order": "latency", "needsProse": true, "firstByteTimeoutMs": 60000 },
      "corteo-fast": { "order": "latency", "firstByteTimeoutMs": 20000 }
    }
  }
  ```

- Create `scripts/harness/ladder.mjs` (≤150 lines, pure): `BRAIN_ALIASES`; `ladderFor(alias, brain, probe)` per D9; unknown alias → `Error('unknown alias <x>: use corteo-edit, corteo-draft or corteo-fast')`; no probe → `[]`.
- Create `scripts/harness/probe.mjs` (≤200 lines): `probeLanes({ port, key, candidates, timeoutMs, pauseMs = 300, fetchImpl })` sends one non-stream `POST /v1/chat/completions` per lane: `{ model, max_tokens: 16, temperature: 0, messages: [{ role:'system', content:'Responde solo con la palabra: listo' }, { role:'user', content:'¿Listo?' }] }` with the Bearer key. It records `{ ok, status, latencyMs, prose, error? }`: `ok` is a 200 with non-empty `content` or `reasoning_content`; `prose` is non-empty `content`. 429, 401, 404 and timeouts are recorded and never retried. `readBrainState(home)` and `writeBrainState(home, patch)` merge into `<home>/brain.json` with `writePrivateJson` (0600).
- Verifies `scripts/harness/ladder.verify.mjs` and `scripts/harness/probe.verify.mjs`, with a stub forward server on port 0: lane A answers 200 with prose in 50 ms, B 429, C 200 with empty content, D never answers (`timeoutMs: 300`), E 404. Check the probe values; the edit ladder is the listed order minus failures; draft excludes C; fast is sorted by latency; `brain.json` has mode 0600; the key string is not in `brain.json`.
- `package.json`: both verifies at the tail of `test:serial`, next to the other `scripts/harness/*.verify.mjs`. No `.gitignore` line: `!/scripts/harness/` already tracks the folder.
- Done when: both verifies and `node scripts/harness/doctor.verify.mjs` pass.
- Verify: those three; the registration gates.
- Commit: `EV-13: the brain knows its three aliases and probes each lane once`.
- Out of scope: any call to a real lane (the tests use the stub; the live probe is EV-20); the router (EV-14).

### EV-14 · The alias router: a 429 moves to the next lane
- Needs: EV-13.
- Create `scripts/harness/router.mjs` (≤350 lines) and `scripts/harness/router.verify.mjs`. Edit `package.json`.
- API: `createBrainRouter({ brain, getProbe, forwardPort, forwardKey, fetchImpl = fetch, now = Date.now })` → `{ handle(req, res), route({ alias, body }) }`; `startBrainRouter({ …same, port })` listens on `127.0.0.1` only and resolves `{ server, port }`. `route` is the ladder walk without HTTP.
- HTTP contract:
  - Every request needs `Authorization: Bearer <forwardKey>`; otherwise 401 `{"error":{"message":"missing or invalid API key","type":"invalid_request_error","code":"unauthorized"}}`.
  - `GET /v1/models` → `{"object":"list","data":[{"id":"corteo-edit","object":"model","owned_by":"corteo"},{"id":"corteo-draft","object":"model","owned_by":"corteo"},{"id":"corteo-fast","object":"model","owned_by":"corteo"}]}`. Never a lane id.
  - `POST /v1/chat/completions` (body ≤1 MB): `model` must be an alias; otherwise 404 `{"error":{"message":"unknown model <id>: use corteo-edit, corteo-draft or corteo-fast","type":"invalid_request_error","code":"model_not_found"}}`. Walk `ladderFor(alias)`: send the body with `model: <lane>` to `http://127.0.0.1:<forwardPort>/v1/chat/completions` (Bearer forward key) and abort when no response headers arrive within the alias's `firstByteTimeoutMs`.
    - 429, 408, 404, 5xx or a timeout → record `{ lane, status: <code>|'timeout', ms }` and try the next lane.
    - 401 or 403 → stop with 502 `{"error":{"message":"brain_unavailable","type":"brain_unavailable","code":"forward_key_rejected","tried":[…]}}`.
    - Connection refused → stop with 503 and `code: "forward_down"`.
    - 200 → the upstream status and content type, plus `x-corteo-alias`, `x-corteo-lane` and `x-corteo-latency-ms`. A JSON body gets `model` set to the alias. An SSE body gets `model` set to the alias in each `data:` JSON line; unparseable lines and `[DONE]` pass through.
    - A ladder that is empty or exhausted → 503 `code: "no_lane"`; no probe yet → `code: "no_probe"`.
  - Anything else → 404 `{"error":{"message":"not found"}}`.
- Verify, with a stub forward server: the model list (3 aliases, no lane id); 401; unknown model 404; lane 1 429 → lane 2 (the headers name lane 2, the body's `model` is the alias); lane 1 silent (`firstByteTimeoutMs: 200` in the test config) → lane 2; all 429 → 503 `no_lane` with one `tried` row per lane; forward 401 → 502 `forward_key_rejected`; forward port closed → 503 `forward_down`; the SSE rewrite and `[DONE]`; `server.address().address === '127.0.0.1'`; the source has no `0.0.0.0` and no `listen(` without `'127.0.0.1'`.
- Done when: the verify passes.
- Verify: `node scripts/harness/router.verify.mjs`; the registration gates.
- Commit: `EV-14: apps see three aliases, and a 429 moves the call to the next lane`.
- Out of scope: starting dsh, the probe timer and the process lifecycle (EV-15); `/v1/responses` and `/v1/messages` (only models and chat completions).

### EV-15 · `npm run brain:serve`: one process for the brain
- Needs: EV-14.
- Read: `scripts/harness/start.mjs` (`buildHarnessArgs`, `ensureForwardEnabled`, `resolveCorteoMcp`), `scripts/harness/install.mjs`, `scripts/harness/start.verify.mjs`, `scripts/harness/install.verify.mjs` (fake commands on PATH).
- Create `scripts/harness/brain.mjs` (≤350 lines), `scripts/harness/brain.verify.mjs`. Edit `scripts/harness/lib.mjs` (`ensurePnpm`), `scripts/harness/install.mjs`, `scripts/harness/install.verify.mjs`, `package.json` (`"brain:serve": "node scripts/harness/brain.mjs serve"`, `"brain:stop": "node scripts/harness/brain.mjs stop"`, `"brain:status": "node scripts/harness/brain.mjs status --json"`, the verify in `test:serial`).
- `serve` (foreground): when 3080 already answers (a harness started with `npm run harness`), reuse it; otherwise `ensureForwardEnabled`, `resolveCorteoMcp` (no token → start without the MCP patch and log why), spawn `paths.dshBin` with `buildHarnessArgs` and env `DSH_HOME`, `CORTEO_MCP_URL`, `CORTEO_MCP_TOKEN`, output to `<home>/logs/dsh.log`. Wait up to 120 s for `findForwardPort`; read `forwardKey`; `probeLanes` → `writeBrainState`; `startBrainRouter({ port: brain.routerPort })` (a busy port fails with `router port <n> is in use; pass --router-port`); write `{ version:1, pid, dshPid, webPort, forwardPort, routerPort, startedAt, probedAt, lanes }`; re-probe every `probeIntervalMinutes`. SIGINT or SIGTERM → close the router, SIGTERM the dsh child (SIGKILL after 5 s), clear the pid fields. Flags for tests: `--home`, `--web-port`, `--forward-port`, `--router-port`.
- `stop` → SIGTERM the recorded pid; prints `{ ok, stopped: <pid>|null }`.
- `status [--json]` → `{ running, pid, webPort, forwardPort, routerPort, probedAt, passing, aliases: { 'corteo-edit': <first lane or null>, … } }`. Never the key.
- `ensurePnpm({ home, env })` (D12): `pnpm --version` exits 0 → return `env`; otherwise `npm install --prefix <home>/tools pnpm@10` and return `env` with `<home>/tools/node_modules/.bin` first on PATH. `install.mjs` calls it instead of `requireCommand('pnpm', …)` and uses that env for `dsh plugin add`.
- `brain.verify.mjs`: a temp `DSH_HOME`; a fake `dsh` at `<home>/runtime/node_modules/.bin/dsh` (a node script) that opens a stub web port (401) and a stub forward port (401 without the key, 200 with it, chat answers "listo") on the ports it is given; `serve` with test ports; `brain.json` gets `routerPort`; `GET /v1/models` through the router lists 3 aliases; `status --json` says `running:true` and its stdout has no key; `stop` ends both processes. `install.verify.mjs`: a run with no `pnpm` on PATH calls the fake `npm` with `install --prefix <home>/tools pnpm@10`.
- Done when: both verifies pass.
- Verify: `node scripts/harness/brain.verify.mjs`; `node scripts/harness/install.verify.mjs`; `node scripts/harness/start.verify.mjs`; the registration gates.
- Commit: `EV-15: one brain process runs DeepSeek Harness, probes the lanes and serves the aliases`.
- Out of scope: a systemd unit; the plugin's account channels, EAC and LAN forward (L11).

### EV-16 · `npm run brain`: boot with no browser and no pasted key
- Needs: EV-15.
- Read: `scripts/harness/doctor.mjs` (`runDoctor`), `server/plugins/settings.ts` (`/api/keys`, `/api/keys/test`), `server/project-store-http-auth.ts`.
- Create `scripts/harness/boot.mjs` (≤300 lines), `scripts/harness/editor-link.mjs` (≤150 lines), `scripts/harness/boot.verify.mjs`. Edit `package.json` (`"brain": "node scripts/harness/boot.mjs"`, the verify in `test:serial`).
- Steps (the names are the contract):
  1. `install` — `installHarness()` (a no-op when the pins match).
  2. `start` — if the `brain.json` pid is alive and the router answers → `reused`; otherwise spawn `node scripts/harness/brain.mjs serve` detached (`detached: true`, stdio to `<home>/logs/brain.log`, `unref()`).
  3. `forward` — up to 120 s for `findForwardPort` (`--forward-timeout-ms` for tests).
  4. `doctor` — `runDoctor({ showKey: false, log: () => {} })`. No browser and no token link: doctor step 2 accepts the 401 the web UI answers before its link is opened.
  5. `router` — up to 60 s for `GET http://127.0.0.1:<routerPort>/v1/models` to list the 3 aliases.
  6. `editor` — `linkEditor({ editorUrl })` (default `http://127.0.0.1:${CORTEO_PORT:-5199}`; flags `--editor-url`, `--no-editor`), per D11: GET `/api/keys`; no answer → `skipped`; `keys.LLM_DSH_API_KEY.configured` and `POST /api/keys/test {"page":"llm/dsh","overrides":{}}` answers `ok:true` → `already`; otherwise `POST /api/keys {"LLM_DSH_API_KEY":<forwardKey>,"LLM_DSH_BASE_URL":"http://127.0.0.1:<forwardPort>/v1"}` → `linked`. Requests use `node:http` with `Host: 127.0.0.1:<port>`, `Origin: http://127.0.0.1:<port>`, `Sec-Fetch-Site: same-origin` and `Content-Type: application/json`. A failure here is `failed` and does not fail the boot.
  7. `probe` — one router call `{ model:'corteo-edit', max_tokens:16, messages:[{ role:'user', content:'Responde solo: listo' }] }` → `{ alias, lane: <x-corteo-lane>, latencyMs }`. A 503 fails the step with its `code`.
- Output: Spanish lines, or with `--json` exactly one object on stdout: `{"ok","step":null|"<failed step>","error"?,"home","webPort","forwardPort","routerPort","brainUrl":"http://127.0.0.1:<routerPort>/v1","aliases":[3],"editor":"linked"|"already"|"skipped"|"failed","probe":{"alias","lane","latencyMs"}|null,"log"}`. Exit 0 when `ok`, 1 otherwise. The forward key never appears in stdout, stderr, the boot's log lines or `brain.json`.
- `boot.verify.mjs` (the fake `dsh` from EV-15 and a stub editor that serves GET and POST `/api/keys` and `/api/keys/test` and records headers and bodies): the happy path → `editor:"linked"`, the POST body has both keys, the headers have the same-origin shape, `probe.lane` is set; a second run → `start` reused and `editor:"already"`; editor down → `skipped` with `ok:true`; every lane 429 → `ok:false`, `step:"probe"`; the fake never opens the forward port → `step:"forward"`; the key string is absent from everything captured.
- Done when: the verify passes.
- Verify: `node scripts/harness/boot.verify.mjs`; the registration gates.
- Commit: `EV-16: npm run brain boots the free models with no browser and no pasted key`.
- Out of scope: opening the dsh web token link; writing `LLM_DSH_MODEL` or `LLM_PROVIDER`; editing the profile's settings file directly (D11).

### EV-17 · The installer starts the brain; a brain failure is its own step
- Needs: EV-16, EV-02 (soft).
- Read: `install.sh` (`main`, `self_test`, `write_report`, `print_dry_run`), `scripts/install.verify.mjs`.
- Edit: `install.sh`, `scripts/install.verify.mjs`.
- Behavior:
  - `--no-brain` (env `CORTEO_BRAIN=off`).
  - New `start_brain`, called in `main` after `self_test` and before `write_report`: `stage "brain"`; with `--no-brain` or `--no-start` → `BRAIN_STATE=skipped`; otherwise `( cd "$APP_DIR" && set -a && . "$SECRETS" && set +a && export CORTEO_MCP_URL="$MCP_URL" && PATH="$NODE_BIN_DIR:$PATH" "$NODE_BIN" scripts/harness/boot.mjs --json --editor-url "http://127.0.0.1:$PORT" ) > "$LOG_DIR/brain-boot.json" 2>>"$LOG_FILE"`, then read `ok`, `step` and `brainUrl` with `node -e`. Sourcing `$SECRETS` in that subshell hands `OPENCHATCUT_MCP_TOKEN` to the brain, so dsh's own chat gets the corteo MCP patch; it is never printed. `start_brain` never calls `die`: a failure sets `BRAIN_STATE=failed` and `BRAIN_STEP=<step or boot>` and warns `the free-model brain did not start (step: <step>); video still works. Retry: cd <app> && npm run brain`.
  - `write_report`: `CORTEO_BRAIN` (`ok|failed|skipped`), `CORTEO_BRAIN_STEP` (`none` or the step), `CORTEO_BRAIN_URL` (`http://127.0.0.1:18890/v1` or `none`). `CORTEO_STATUS` stays `ok` when only the brain failed; `CORTEO_SELF_TEST` keeps its own value.
  - `print_dry_run`: `CORTEO_BRAIN=planned|skipped`. `usage`: one `--no-brain` line.
- `scripts/install.verify.mjs`: help lists `--no-brain`; dry runs report `planned` and, with `--no-brain`, `skipped`; `main` calls `start_brain` after `self_test` (source order); `start_brain` contains no `die`; `REPORTED` gains the three keys.
- Done when: `npm run verify:install` passes, and `bash install.sh --dry-run --no-brain` prints `CORTEO_BRAIN=skipped` (unproven).
- Verify: `bash -n install.sh`; `npm run verify:install`.
- Commit: `EV-17: the installer starts the brain after the render self-test and reports it as its own step`.
- Out of scope: a systemd unit for the brain. After a reboot, `npm run brain` starts it again; the skill says so.

### EV-18 · `delegate`: one MCP call to the free models, no edit session
- Needs: EV-14.
- Read: `server/external-agent/mcp-controls.ts`, `server/external-agent/mcp.ts` (`callControlTool`), `server/external-agent/mcp-session-verifier.ts` (`connectClient`, `closeClient`), `server/external-agent/mcp.verify.ts` (the server setup), `server/external-agent/mcp-tool-exposure.ts`, `server/mcp-token.ts`, `src/agent/tools.ts` (`TOOL_SCHEMAS`), `src/agent/execution-policy.ts` (how Ajv is used).
- Code fact: control tools run before any binding check and are not in the generated catalog JSON (D10).
- Create `server/brain/delegate.ts` (≤350 lines), `server/brain/delegate-policy.ts` (≤150 lines), `server/brain/delegate.verify.ts`. Edit `mcp-controls.ts` (the schema), `mcp.ts` (one dispatch line with a lazy import), `package.json` (`test:serial` and `verify:mcp`), `skills/corteo/SKILL.md`, `scripts/corteo-skill.verify.mjs`.
- Schema (`inputSchema`, `additionalProperties: false`, required `alias`, `kind`, `input`): `alias` enum of the three aliases; `kind` enum `storyboard | social_copy | score_reasons | tool_args | lyric_cards`; `tool` string (tool_args only); `schema` object (≤4,000 characters serialized; ignored for tool_args); `input` any JSON (≤12,000 characters serialized); `maxTokens` integer 16..4096 (default 1024). Description: "Ask corteo's free-model brain for one bounded draft (storyboard, social copy, score reasons, tool arguments, lyric cards). Returns JSON that matches your schema plus the lane and latency, or brain_unavailable. It never edits, renders or publishes: apply the result yourself with a real tool." Annotations `{ readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true }`.
- `delegateTask(args, deps)`, with injectable deps (`fetchImpl`, `routerUrl`, `forwardKey`, `secrets`):
  1. Checks before any HTTP call, each answering `{ ok:false, error:'<code>', message }`: `invalid_alias`, `invalid_kind`, `input_too_large`, `schema_too_large`, `invalid_schema` (Ajv cannot compile it), `tool_required`, `tool_not_allowed` (anything outside `split_item`, `edit_item`, `write_clip_title`, `write_social_copy`, for example `submit_export`, `submit_render_job`, `publish_to_social`, `schedule_publish`, `remove_item`, `delete_project`, `clear_timeline`, `begin_edit_session`, `review_edit_session`), `alias_not_allowed` (`tool_args` with an alias other than `corteo-edit`), `secret_in_input` (the input or the schema contains the MCP token, the forward key or the text `OPENCHATCUT_MCP_TOKEN`), `project_json_not_allowed` (an object with a `timelines` array, or with both `items` and `tracks`).
  2. For `tool_args`, the schema is the tool's own `input_schema` from `TOOL_SCHEMAS`.
  3. Messages: system "You are a drafting helper for a video editor. Answer with one JSON value that matches this JSON schema and nothing else. No code fences." plus the schema, plus for `tool_args` "These are arguments for <tool>; edit_item may only contain adds of type text."; user: the kind and the input JSON.
  4. Router call (non-stream, `temperature: 0.2`, `max_tokens`, Bearer forward key). A 502 or 503, or a refused connection → `{ ok:false, error:'brain_unavailable', reason: <the router's code or 'router_down'>, tried }`.
  5. Parse `choices[0].message.content` (strip fences, take the first JSON value) and validate with Ajv (`allErrors: true`, `strict: false`); for `edit_item` also require `adds` only, every entry of `type` `text`. Invalid → one more call carrying the answer and "Your JSON did not validate: <errors, at most 800 characters>. Answer again with only valid JSON." Still invalid → `{ ok:false, error:'invalid_json', lane, latencyMs, attempts: 2, validatorErrors }`. Never a third call.
  6. Success → `{ ok:true, alias, kind, lane, latencyMs, attempts, json }`. An answer over 16,000 characters → `answer_too_large`.
  - Secrets and endpoints: the MCP token from `OPENCHATCUT_MCP_TOKEN` or the profile's token file, read only (never create one here); the forward key from `<harness home>/our-free-model/settings.json`; the router port from `brain.json`, else `config/harness.json`. No key → `brain_unavailable` with reason `not_installed`.
- `server/brain/delegate.verify.ts` (a stub router on port 0): valid on the first try; invalid then valid (exactly 2 calls); invalid twice (exactly 2 calls); 503 → `brain_unavailable` with `tried`; router down → `router_down`; every forbidden tool → `tool_not_allowed` with zero calls; a drafted `edit_item` with `updates` → the invalid path; `tool_args` with `corteo-fast` → `alias_not_allowed`; a fake token or key inside the input → `secret_in_input`; a project-shaped input → rejected. MCP level (server set up as in `mcp.verify.ts`, client from `mcp-session-verifier.ts`): `tools/list` has `delegate` with full exposure and with `?toolExposure=progressive`; `callTool('delegate', …)` answers with no project bound and no editor registered; the session has no binding afterwards.
- Skill `## El cerebro: modelos gratis` (part 1): the three aliases and their jobs; the `delegate` input and output; "the brain drafts, you apply with a real tool; `brain_unavailable` means you do that step yourself"; `npm run brain` after a reboot; one MCP `tools/call` example for `lyric_cards`, unproven until EV-20. Assert `delegate` and `corteo-edit` in the skill gate.
- Done when: the verifies pass.
- Verify: `npx tsc -b`; `npx tsx server/brain/delegate.verify.ts`; `npm run verify:mcp`; `npm run generate:server-tool-catalog`, then `npm run verify:server-tool-catalog` (no diff expected; commit any); `node scripts/corteo-skill.verify.mjs`; the registration gates.
- Commit: `EV-18: delegate asks the free models for one checked draft and never opens an edit session`.
- Out of scope: giving `delegate` to the built-in chat; streaming answers.

### EV-19 · The IDE door
- Needs: EV-14, EV-03 (soft).
- Edit `docs/harness.md` (Spanish): new section `## La puerta para cualquier app (IDE)`: base URL `http://127.0.0.1:18890/v1`; the three aliases, one line each; the key is the plugin's forward key, read in a terminal with `npm run harness:doctor -- --show-key` and pasted into the IDE's own settings, never into a chat; loopback only, no tunnel, no other computer; `npm run brain`, `npm run brain:status`, `npm run brain:stop`; a `curl` example that reads the key inside `node -p` (the line from Plan 3's manual setup) without echoing it. Add the router to the "Qué piezas hay" table.
- Edit `skills/corteo/SKILL.md` brain section (part 2): the same door, in English.
- Create `scripts/harness/ide-door.verify.mjs`:
  1. `startBrainRouter` on port 0 binds `127.0.0.1`.
  2. `forwardSettings(18899)` has `host: '127.0.0.1'` and `lan.enabled: false`.
  3. No `scripts/harness/*.mjs` outside the verifies contains `0.0.0.0` or a `listen(` without `'127.0.0.1'`.
  4. `docs/harness.md` and the skill contain `http://127.0.0.1:18890/v1` and the three aliases, and neither contains `Bearer ` followed by 20 or more key characters or a `"forwardKey":"` value.
  5. When `~/.corteo-harness/our-free-model/settings.json` has a `forwardKey`, read every `git ls-files` text file in-process and assert none contains it (never pass the key in argv, never print it; print only `real forward key: not in the repo`). The same for every `~/.openchatcut/dev-profiles/*/mcp-token`.
- Edit `package.json` (`test:serial`).
- Done when: the verify passes.
- Verify: `node scripts/harness/ide-door.verify.mjs`; `node scripts/corteo-skill.verify.mjs`; the registration gates.
- Commit: `EV-19: any app on this machine reaches the free models through one loopback door`.
- Out of scope: a tunnel or any non-loopback address; IDE-specific config files.

### EV-20 · The brain, live on this machine
- Needs: EV-16, EV-18, EV-17 (soft).
- Do, and record every output under "EV: results" (never the key):
  0. Start `npm run corteo:local` (tmux) and wait until `http://127.0.0.1:5199/` answers, so the boot's `editor` step has an editor to link. If Carlos's own editor already answers on 5199, use it.
  1. `npm run brain -- --json` → `ok`, `step`, `forwardPort`, `routerPort`, `editor` (expect `linked` or `already`), `probe`.
  2. `npm run brain:status` → the passing lanes and the first lane per alias.
  3. `npm run harness:doctor` → 5/5, masked key, no token page.
  4. Against that editor, with the AGENTS.md smoke test (token from `npm run corteo -- mcp token --show` into a variable, never echoed): `tools/list` includes `delegate`. Call `delegate` with `{ "alias":"corteo-edit", "kind":"lyric_cards", "schema":{ "type":"object", "required":["cards"], "properties":{ "cards":{ "type":"array", "items":{ "type":"object", "required":["text","fromFrame","durationInFrames"], "properties":{ "text":{"type":"string"}, "fromFrame":{"type":"integer"}, "durationInFrames":{"type":"integer"} } } } } }, "input":{ "fps":30, "lines":[three short Spanish lines with startMs and endMs] } }` → record `ok`, `lane`, `latencyMs`, `attempts`. Apply `json.cards` as `edit_item` text adds with `occ tools call … --apply --json` on a scratch library (`CORTEO_STORE_DIR=$T/library`) and record the placed ids (stage 8).
  5. `delegate { "alias":"corteo-edit", "kind":"tool_args", "tool":"split_item", "input":{ "itemId":<a placed clip>, "atFrame":60 } }` → apply with `occ tools call split_item --args … --apply --json` → record `newItemId`.
  6. Dead lane (stage 10): `npm run brain:stop`; the same `delegate` call → `brain_unavailable` with `router_down`; do the step yourself with `occ tools call edit_item` and record that the edit landed. Record any natural 429 rows seen in `tried`. Leave the brain stopped (no later card needs it).
  7. `curl -s http://127.0.0.1:${CORTEO_PORT:-5199}/api/keys | node -e '<print keys.LLM_DSH_API_KEY.configured and models.LLM_DSH_BASE_URL>'` → `true` and the forward URL.
- No network, or every lane failing → `blocked` with the boot JSON and the `tried` rows; the stub-tested cards stay `done`.
- Done when: steps 1 to 7 are recorded with real outputs.
- Verify: the commands in steps 0 to 7.
- Commit: `EV-20: record the live brain boot, one delegation applied, and the dead-lane fallback` (PROGRESS only; stop the `corteo:local` this card started, not Carlos's).
- Out of scope: code changes. A live failure becomes a blocker entry.

### EV-21 (L-12) · The `escuchar-cancion` skill and its MCP prompt
- Needs: EV-00 (soft). Original card: PROGRESS › L-12. Design: Plan 2 › Part E. No second design.
- Files: new `src/agent/skills/escuchar-cancion/SKILL.md` (front matter like `src/agent/skills/music-intelligence/SKILL.md`, `user-invocable: true`, Spanish triggers in the description); `server/external-agent/mcp-prompts.ts` (prompt `escuchar-y-editar-cancion`, optional argument `cancion`, Spanish description and text); `src/agent/skills/videoclip-musical/SKILL.md` (step 2 becomes "listen to the song" with `listen_to_song`); `src/agent/skills/skill-loading.verify.ts` (the skill count 32 → 33, and `expectedCreativeSlugs` if the new skill joins that list).
- Content: Plan 2 Part E steps 1 to 5, plus: the lyric order (L4); say when a relay note is unverified; the "partitura emocional" (section, feeling, intensity 0–10, visual intent, a lyric quote) shown in Spanish before any edit; the mapping table of Part E step 4; one version only (Comparar versiones, P4, is not built). Name the tools so progressive exposure reveals them: `listen_to_song`, `detect_beats`, `music_reaction_plan`, `apply_music_reaction`, `clear_music_reaction`, `apply_ken_burns`, `edit_item`, `edit_captions`.
- Prompt check: if no verify reaches `registerMcpPrompts`, add `server/external-agent/mcp-prompts.verify.ts` (a fake `Server` that captures both handlers; `prompts/list` has `escuchar-y-editar-cancion`; `prompts/get` returns Spanish text that names `listen_to_song`) and register it.
- Done when: `npm run verify:skills` and `npm run verify:mcp` pass. Set L-12 `done` in the main table in this commit.
- Verify: `npx tsc -b`; those two; `npm run generate:server-tool-catalog`, then `npm run verify:server-tool-catalog` (the bundled-skill list lives in the catalog); the registration gates.
- Commit: `EV-21 (L-12): the escuchar-cancion skill and its MCP prompt`.
- Out of scope: the "tranquila" and "intensa" versions (they need P4); new tools.

### EV-22 (L-11, part 1) · "Reaccionar a la música" in the inspector
- Needs: EV-00 (soft). Original card: PROGRESS › L-11. Design: Plan 2 › Part C (UI).
- Read: `AnimationTab` in `src/components/inspector/InspectorContent.tsx`, `src/components/inspector/InspectorKeyframeControls.tsx`, `src/agent/tools/music-reactions-tools.ts` (`execMusicReactionTool` and its deps), `src/agent/tools/music-intelligence-tools.ts` (the browser deps), `src/editor/clipTypes.ts` (`MUSIC_REACTIONS`, `MUSIC_REACTION_TIMINGS`), `src/editor/musicReactions.ts` (`DEFAULT_REACTION_TIMING`), `src/audio/intelligence/store.ts`, `src/components/inspector/background-fill-control.verify.ts` (the test pattern).
- Create `src/components/inspector/MusicReactionSection.tsx` (≤300 lines), `src/components/inspector/music-reaction-section.verify.tsx`. Edit `InspectorContent.tsx` (render the section in `AnimationTab` for visual clips), `src/i18n/dict/en/components.ts` (where the inspector's strings live), `src/i18n/dict/es/index.ts`, `package.json` (`verify:components` and `test:serial`, with `--tsconfig tsconfig.app.json` like the neighbours).
- UI (Chinese keys, English and Spanish entries): title "Reaccionar a la música"; reaction chips Pulso, Golpe, Temblor, Destello, Respirar, Ken Burns al ritmo; timing chips Pulsos, Compases, Acentos, Caídas, Secciones, Energía (defaults from `DEFAULT_REACTION_TIMING`); an "Intensidad" slider 0–100 (60); "Aplicar" and "Quitar" call the executor the agent's browser tool uses (`execMusicReactionTool` with the browser analysis loader), so the UI and the tool write the same single batch; a small energy strip under the controls. No analysis → "Analiza la canción primero (insignia de la canción en Medios)" and disabled buttons; no audio clip → "No hay canción en la línea de tiempo".
- Verify: `renderToStaticMarkup` with fixtures (an analysis, none, no audio) in `es`; the Spanish labels; the disabled state; the exported apply handler produces one batch.
- Done when: the verify, `npm run verify:components` and `npm run verify:i18n` pass. Optional: a screenshot into `test-results/corteo/` when `corteo:local` is up.
- Verify: `npx tsc -b`; `npx tsx --tsconfig tsconfig.app.json src/components/inspector/music-reaction-section.verify.tsx`; `npm run verify:components`; `npm run verify:i18n`; the registration gates.
- Commit: `EV-22 (L-11): Reaccionar a la música in the inspector`.
- Out of scope: new reaction types; editing reaction curves by hand.

### EV-23 (L-11, part 2) · "Mapa musical" under the music clip
- Needs: EV-00 (soft). Original card: L-11. Design: Plan 2 › Part D.
- Read: `src/components/timeline/TimelineToolbar.tsx`, the component that draws clip rows (`rg -n "data-clip-kind" src/components/timeline`), `src/editor/timelineViewState.ts`, `src/editor/musicReactionEvents.ts` (`localFrameForSourceMs`), `src/audio/listen/songMap.ts` (`displaySectionRole`), `src/audio/intelligence/clapProfile.ts` (`displayMusicLabel`).
- Create `src/components/timeline/MusicMapStrip.tsx` (≤250 lines), `src/components/timeline/music-map-strip.verify.tsx`. Edit the toolbar's "More actions" menu (a "Mapa musical" toggle kept in timeline view state, not in the project), the clip-row component, `src/i18n/dict/en/timeline.ts`, `src/i18n/dict/es/index.ts`, `package.json`.
- Strip: under each audio clip whose asset has a cached analysis: section bands (a color per role, Spanish role and mood), downbeat ticks, drop markers, mapped through the clip's trim and speed.
- Verify: 3 sections → 3 bands with Spanish labels; downbeats through a 2× clip land at the expected x; toggle off → nothing rendered.
- Done when: the verify, `npm run verify:components` and `npm run verify:i18n` pass.
- Verify: `npx tsc -b`; `npx tsx --tsconfig tsconfig.app.json src/components/timeline/music-map-strip.verify.tsx`; `npm run verify:components`; `npm run verify:i18n`; the registration gates.
- Commit: `EV-23 (L-11): Mapa musical under the music clip`.
- Out of scope: editing sections from the strip; lyric lines on the strip.

### EV-24 (L-11, part 3) · "Mapa de la canción" from the song badge
- Needs: EV-00 (soft). Original card: L-11. Design: Plan 2 › Part D.
- Read: `src/audio/intelligence/MusicAnalysisBadge.tsx` (`MusicAnalysisPopover`), `server/music-listen/pictures.ts` (what the map shows), `shared/music-inference/listen-snapshot.ts` (`listenClock`).
- Create `src/audio/intelligence/SongMapDialog.tsx` (≤350 lines), `src/audio/intelligence/song-map-dialog.verify.tsx`. Edit the popover (a "Mapa de la canción" button), `src/i18n/dict/en/audio.ts`, `src/i18n/dict/es/index.ts`, `package.json`.
- Dialog: tempo and meter; the key when present; the sections (mm:ss–mm:ss, Spanish role, mood, energy %); an SVG map drawn in the browser (section bands, downbeat ticks, drops, the energy line when the analysis carries it); lyric lines and the real-ear note with "Escuchado de verdad" or "Sin verificar" when the browser has them. Out of scope (D15): the server PNG and the "Escuchar con oído real" button.
- Verify: a fixture analysis → Spanish labels, one row per section, an `<svg>`; no analysis → no button.
- Done when: the verify, `npm run verify:components` and `npm run verify:i18n` pass. When EV-22, EV-23 and EV-24 are all `done`, set L-11 `done` in the main table in this commit; otherwise note on the L-11 row which part is missing.
- Verify: `npx tsc -b`; `npx tsx --tsconfig tsconfig.app.json src/audio/intelligence/song-map-dialog.verify.tsx`; `npm run verify:components`; `npm run verify:i18n`; the registration gates.
- Commit: `EV-24 (L-11): Mapa de la canción from the song badge`.
- Out of scope: the server PNG and the "Escuchar con oído real" button (D15).

### EV-25 (L-13) · Listening end to end on a real song
- Needs: EV-21 (soft), EV-22 (soft), EV-23 (soft), EV-24 (soft). Original card: PROGRESS › L-13. Design: Plan 2 › Verification (end-to-end).
- Song: the first `wav|mp3|m4a|flac` in `${CORTEO_E2E_MEDIA_DIR:-$HOME/corteo-media}` (D16). None → `blocked`, "no song in <dir>".
- Packs (L14): with `npm run corteo:local` up, `curl -s http://127.0.0.1:5199/api/model-packs`; for each of `rhythm-lite` and `music-semantics-lite` that is not installed: `curl -sS -X POST http://127.0.0.1:5199/api/model-packs/download -H 'Origin: http://127.0.0.1:5199' -H 'Sec-Fetch-Site: same-origin' -H 'Content-Type: application/json' -d '{"id":"rhythm-lite"}'`, then poll `GET /api/model-packs/tasks/rhythm-lite` until it finishes (the 15-minute rule applies to each). Unproven: the route checks loopback plus an `Origin` equal to the editor origin (`editorCredentialAuthorized` in `server/editor-auth.ts`); if it still refuses, block with the response.
- The four checks over the real MCP endpoint (the AGENTS.md smoke test; checks 1 to 3 need no tab):
  1. `listen_to_song` returns the map and two PNGs over 10 KB each.
  2. `apply_music_reaction` `pulso` and `golpe` on a clip over the song, then `occ render --to 8s --resolution 1080p`.
  3. Two frames, one on a beat and one half a beat later (`ffmpeg -ss <t> -frames:v 1`), differ in scale: mean absolute pixel difference above 2.0, computed with a scratch node script outside the repo.
  4. Screenshots of the dialog and the inspector section into `test-results/corteo/` with Playwright on the running editor when EV-22 and EV-24 are `done`; otherwise "skipped: EV-2x blocked".
- Done when: checks 1 to 3 pass with their output paths recorded (and check 4 or its skip reason). Set L-13 `done` in this commit.
- Verify: the commands of the four checks are the proof; paste their outputs.
- Commit: `EV-25 (L-13): the listening proof on a real song`.
- Out of scope: tuning reactions until the pixel check passes; the paid relay (it stays off).

### EV-26 · `EVOLUTION=PASS`: the night's acceptance script
- Needs: EV-05 (soft), EV-10 (soft), EV-11 (soft), EV-14 (soft), EV-18 (soft), EV-19 (soft). Leave out any step whose card is `blocked` and list those steps in the note.
- Create `scripts/evolution-acceptance.sh` and `scripts/evolution-acceptance.verify.mjs` (like `scripts/corteo-acceptance.verify.mjs`: `bash -n`, the step names, `EVOLUTION=PASS`, `EVOLUTION=FAIL`, `mktemp -d`, `git status --porcelain`, no secret patterns). Edit `.gitignore` (`!/scripts/evolution-acceptance.sh`), `package.json` (`"evolution:accept": "bash scripts/evolution-acceptance.sh"`, the verify in `test:serial`).
- Script: `set -euo pipefail`; `REPO` from the script's path; `T=$(mktemp -d "${TMPDIR:-/tmp}/corteo-evolution.XXXXXX")`; `CORTEO_STORE_DIR=$T/library CORTEO_MEDIA_INBOX=$T/inbox CORTEO_EXPORT_DIR=$T/exports CC_RENDER_GL=swangle`; `FFPROBE` from `@ffprobe-installer/ffprobe`; `before="$(git -C "$REPO" status --porcelain)"`. Each step prints `step <name>`; a failure prints `EVOLUTION=FAIL step=<name>` and the kept scratch path, then exits 1.
  1. `profiles` — `host show` for the three; `HOME=$T/home "$REPO/scripts/corteo" host install muse --json`; `cmp` the installed skill with `skills/corteo/SKILL.md`.
  2. `roundtrip` — a 3 s 1280x720 clip into the inbox; `inbox --host grok --json`; ffprobe 720x1280 and 3.0 ±0.1 s.
  3. `song-film` — a 12 s song (an inline node copy of `synthSong`/`wavFile`), `song.txt` with 4 lines, two gradient stills; `song-film … --to 12s --resolution 720p --json` → `lyricsSource:"txt"`, 4 lines, `cutGrid:"downbeat"`; ffprobe 720x1280, 12.0 ±0.2 s, one audio stream.
  4. `shorts` — `npx tsx src/agent/tools/shorts-host-flow.verify.ts`.
  5. `router` — `node scripts/harness/router.verify.mjs`.
  6. `delegate` — `npx tsx server/brain/delegate.verify.ts`.
  7. `ide-door` — `node scripts/harness/ide-door.verify.mjs`.
  8. `brain-live` — only with `EVOLUTION_LIVE=1`: `npm run brain:status` says running and `/v1/models` through the router lists 3 aliases (the key is read inside `node -e`, never echoed).
  9. `clean` — `git status --porcelain` equals `before`; `rm -rf "$T"`; print `EVOLUTION=PASS`.
- Done when: `bash scripts/evolution-acceptance.sh` prints `EVOLUTION=PASS` on this machine (record the wall time per step), and the verify passes.
- Verify: `node scripts/evolution-acceptance.verify.mjs`; `bash scripts/evolution-acceptance.sh`; the registration gates.
- Commit: `EV-26: one script proves the night's work and leaves nothing in the repo`.
- Out of scope: the Node 20 path (`scripts/corteo-acceptance.sh` covers it); a fresh VM.

### EV-27 · README Estado for what the night wired
- Needs: EV-26 (soft).
- Edit `README.es.md` (Estado › "Lo que funciona hoy" and "Lo que falta") and `README.md` (Status). Only behavior whose EV card is `done` with its live line recorded: host profiles and `--host-profile`; `occ inbox`; `occ song-film`; `reviewEs` and the shorts recipe (it needs the tab: `npm run editor-host`); the brain (`npm run brain`, the three aliases, `delegate`, the door at `http://127.0.0.1:18890/v1`) only if EV-20 is `done`, otherwise "built and tested against stubs; the live boot is pending"; the installer's `CORTEO_BRAIN` step. Also drop the two stale lines that call P1-6 pending (it is done): a correction, not a new claim.
- No new `claudia` anywhere (`README.md` may keep only `~/claudia` and `claudia.service`).
- Done when: `node scripts/no-claudia.verify.mjs` and `node scripts/corteo-acceptance.verify.mjs` pass, and the commit body lists, for each claim, the EV card that proves it.
- Verify: `node scripts/no-claudia.verify.mjs`; `node scripts/corteo-acceptance.verify.mjs`.
- Commit: `EV-27: README says what the evolution night wired, in Spanish and English`.
- Out of scope: `README_ZH.md`; any claim without a `done` EV card.

## Report (night-loop step 10)

At the top of PROGRESS › "Evolution night (EV)", fill "EV night report":

- Done: the ids.
- Blocked: id, one-line reason, and the blocker entry it points to.
- Commits: one sha per card (`git log --oneline` since the EV-00 commit).
- `npm test`: the exact last line from step 8, and from `sync-publish.sh` if it ran.
- Push: the two `git push` results, or why nothing was pushed.
- Not proven tonight: everything recorded as unproven or skipped (live Muse and Claude Duet, a phone, anything blocked on media).

## Finishing in three tracks (2026-10-28)

Terra ran EV-00 to EV-26 by itself. What is left goes to three agents at once, each in its own git worktree on this machine. The worktrees share one `.git`, so every branch is visible to the others locally. Nobody pushes before EV-32.

### Where things stand at the split

- `done`: EV-00 to EV-11, EV-13 to EV-21, EV-26, and EV-28 (done at setup).
- EV-22, EV-23, EV-24 (L-11): implemented, committed, and their own verifies pass. They were `blocked` only because `npm run verify:i18n` failed on ten Italian keys missing since C-12; EV-28 added them, and EV-29 closes the three cards.
- EV-25 (L-13) and EV-12: blocked on Carlos's media in `~/corteo-media` (the folder did not exist at the split).
- EV-27: `todo`, after the merge.
- `npm test` had not reached `test:serial` since C-12: `verify:i18n` is the last `pretest` step. EV-30 is the first full run. `scripts/sync-publish.sh` will not push while the suite is red.
- Nothing is pushed.

### Tracks

| Track | Agent | Folder | Branch | Editor port | Table in PROGRESS | Cards, in order |
|---|---|---|---|---|---|---|
| EQ | Qoder, the integrator | `~/corteo` | `cursor/video-editor-mvp-d191` | 5199 | Evolution night (EV) | EV-29, EV-30, EV-31, EV-27, EV-32 |
| EZ | ZCode | `~/corteo-zcode` | `ev-zcode` | 5201 | EV track · ZCode (EZ) | EV-33, then EV-25 and EV-12 when their media exists |
| ED | DeepSeek Harness | `~/corteo-dsh` | `ev-dsh` | none | EV track · DeepSeek Harness (ED) | EV-34 |

### Who edits what

- ED: `skills/corteo/SKILL.md` and its ED section of PROGRESS.
- EZ: `src/components/inspector/`, `src/components/timeline/`, `src/audio/intelligence/`, `src/i18n/dict/en/components.ts`, `src/i18n/dict/en/timeline.ts`, `src/i18n/dict/en/audio.ts`, `src/i18n/dict/es/index.ts`, the `verify:components` line of `package.json`, and its EZ section of PROGRESS.
- EQ: everything else, including `test:serial`, the main task table, the EV table, the README and the report. Until EV-31, EQ leaves the EZ and ED files alone: a full-suite failure in one of them is recorded under EV: blockers and fixed after the merge.
- A card that seems to need another track's file: record it under your blockers and continue.

### Rules for the tracks (they win over older card text)

1. Pick only from your own table: the first `todo` whose Needs are met (D19 still applies).
2. Register a new verify only in your own group line (EZ: `verify:components`). Only EQ edits `test:serial`. `pretest` runs `verify:components`, so the gates still find the file.
3. EZ and ED never edit the main task table or the EV table. EV-31 copies their outcomes there.
4. Never push, never merge another branch, never edit another track's folder.
5. Only EQ runs `npm run brain`, `npm run brain:*` or `npm run harness*`. The DeepSeek Harness agent runs on that harness: nothing may stop or restart it while ED works.
6. Live checks use your own editor port (`CORTEO_PORT=<port> npm run corteo:local`) and scratch libraries (`CORTEO_STORE_DIR`). Stop your editor before your last commit.
7. Everything else in this plan still applies: the hard rules, the decisions, and the per-card loop (set `doing`, implement, verify, at most three attempts per error, stage by path, commit with the card's message and the row set to `done` or `blocked` in the same commit).
8. When your table has no `todo` or `doing` row, write a three-line summary at the top of your section, commit it, and stop.

### EV-28 · The ten Italian keys, so `npm test` runs to the end (done at setup)
- `src/i18n/dict/it/mcpGuide.ts` gained the ten "Conectar un bot" keys that `src/i18n/dict/it/settingsCoverage.verify.ts` had asked for since C-12. `npm run verify:i18n` passes.
- Commit: `EV-28: the ten Italian keys of the connect-a-bot card, so npm test runs to the end`.

### EV-29 · Close EV-22, EV-23 and EV-24 (EQ)
- Needs: EV-28.
- Do: for each card, run its Verify list from this plan now that `verify:i18n` passes: `npx tsc -b`; its own verify (`npx tsx --tsconfig tsconfig.app.json <path>`, using the path the card's commit really added: `git show --stat` on its commit); `npm run verify:components`; `npm run verify:i18n`; the registration gates. Green → set the row `done`, add a results line, and mark its blocker entry "resolved by EV-28". A real failure → the row stays `blocked` with the new error.
- Done when: the three rows are `done`, or carry a new, real blocker.
- Commit: `EV-29: EV-22 to EV-24 pass now that the Italian keys are in`.
- Out of scope: the browser check (EV-33); the L-11 row (EV-31).

### EV-30 · The first full `npm test` since C-12 (EQ)
- Needs: EV-29.
- Do: `npx tsc -b`; `npm run lint`; `CC_RENDER_GL=swangle npm test` (6 to 12 minutes; the 15-minute rule counts silence); `npm run build`. For each failing segment, run `git log --oneline -5 -- <the failing verify> <the files it tests>`:
  - code an EV commit touched (`git log` shows `EV-…`): the night's failure. Fix it, one commit per fix (`EV-<card>: fix <what> found by the full gate`), rerun that segment, then the suite.
  - code no EV commit touched: pre-existing. Record it under EV: blockers with the command and the output tail; do not fix it.
  - an EZ- or ED-owned file: record it and fix it after EV-31.
- Done when: the suite's last line is recorded, and every failure is fixed or recorded with its evidence.
- Verify: the suite and the build.
- Commit: the fixes as above, then `EV-30: record the first full run of the suite since C-12`.
- Out of scope: fixing pre-existing failures; new features.

### EV-31 · Merge the ZCode and DeepSeek Harness tracks (EQ)
- Needs: EV-30, and every row of the EZ and ED tables `done` or `blocked` (read them with `git show ev-zcode:docs/plans/PROGRESS.md` and `git show ev-dsh:docs/plans/PROGRESS.md`).
- Do: from a clean tree in `~/corteo`: `git merge --no-ff ev-dsh -m "EV-31: merge the DeepSeek Harness track"`, then `git merge --no-ff ev-zcode -m "EV-31: merge the ZCode track"`. In PROGRESS keep both sides' sections. Any other conflict means an ownership rule broke: keep both changes when they are independent, else block EV-31 with the hunks. Then carry the outcomes into the main tables: the EV-25 and EV-12 rows of the EV table from EZ; L-11 `done` when EV-22, EV-23 and EV-24 are `done`; L-13 `done` when EV-25 is `done`; and any fix EV-30 postponed for an EZ or ED file. Commit `EV-31: carry the track results into the main tables`.
- Verify: `npx tsc -b`; `npm run lint`; `npm run verify:i18n`; `npm run verify:components`; `node scripts/corteo-skill.verify.mjs`; `node scripts/corteo-acceptance.verify.mjs`; the registration gates.
- Done when: both merges are in `cursor/video-editor-mvp-d191` and those checks pass.
- Out of scope: removing the worktrees and branches. Carlos does that after the push (`git worktree remove ~/corteo-zcode`, `git worktree remove ~/corteo-dsh`).

### EV-27 · README (EQ, after EV-31)
The card above, unchanged, run after the merge so the README describes the merged result (L-11 included when EV-29 and EV-33 are done). Its Needs now say EV-31.

### EV-32 · Final gates, publish, report (EQ)
- Needs: EV-31, EV-27 (soft).
- Do: night-loop steps 8 to 10 on the merged tree. Run `npx tsc -b`, `npm run lint`, `CC_RENDER_GL=swangle npm test` and `npm run build`, and fix failures EV cards caused. Then `bash scripts/sync-publish.sh`. If it stops only because the suite is red on failures EV-30 recorded as pre-existing, push to a GitHub branch instead with `git push github HEAD:refs/heads/ev-evolution` (never `main`, never force), and record why. Fill the "EV night report" with, per table, the done and blocked ids and reasons, the commit range, the suite's last line and the push result. Commit it as `EV: night report` and publish it the same way.
- Done when: the report is committed and its push result recorded.
- Out of scope: deleting worktrees or branches.

### EV-33 · The music UI in a real browser (EZ)
- Needs: none.
- Read: the cards EV-22, EV-23 and EV-24 and their commits (`git log --oneline --grep "EV-2[234]"`). Also read `screenshots/listen-e2e.mts`, an untracked Playwright script from an earlier session, for selector style; never edit or commit it.
- Do:
  1. `CORTEO_PORT=5201 npm run corteo:local` in its own terminal (this worktree gets its own dev profile).
  2. Music packs (L14 covers this download): `curl -s http://127.0.0.1:5201/api/model-packs`. For each of `rhythm-lite` and `music-semantics-lite` that is not installed, run `curl -sS -X POST http://127.0.0.1:5201/api/model-packs/download -H 'Origin: http://127.0.0.1:5201' -H 'Sec-Fetch-Site: same-origin' -H 'Content-Type: application/json' -d '{"id":"rhythm-lite"}'`, then poll `GET /api/model-packs/tasks/<id>` until it finishes. Unproven: if the route refuses, record the response and check the UI with the DSP data it can show.
  3. Make a 20 s synthetic song (copy `synthSong`/`wavFile` from `server/music-listen/listen.verify.ts` into a scratch script outside the repo) and one 1080x1920 still (`ffmpeg … geq=…`, like the 9:16 recipe).
  4. Write a scratch Playwright script outside the repo (`chromium` from `~/.cache/ms-playwright`, locale `es-ES`, 1600x1000) against `http://127.0.0.1:5201`: new project; import the song and the still; place both; analyze the song from its badge. Then check:
     - (a) Inspector › Animación › "Reaccionar a la música": Aplicar with Pulso adds keyframes, and one Ctrl+Z removes them all.
     - (b) "Mapa musical", turned on from the timeline's More actions, shows section bands and downbeat ticks under the music clip.
     - (c) The badge's "Mapa de la canción" opens the dialog with tempo, Spanish sections and an SVG map.

     Screenshot a, b and c into `test-results/corteo/` (never committed).
  5. For each defect, fix it in EZ files with one commit each (`EV-22: fix …`, `EV-23: fix …`, `EV-24: fix …`), and rerun that card's verify commands.
- Done when: a, b and c work in Spanish, or each defect is fixed or recorded under EZ: blockers; EZ: results has the screenshot paths and what was found.
- Verify: `npx tsc -b`; `npm run verify:components`; `npm run verify:i18n`; the three cards' own verifies.
- Commit: the fixes as above, then `EV-33: record the music UI checked in a real browser`.
- Out of scope: new UI; the server PNG and the relay button (D15); committing the Playwright script.

### EV-25 and EV-12 again (EZ)
The cards above, unchanged, except that the editor runs on port 5201 (`CORTEO_PORT=5201`), EV-33 has already installed the packs, and the outcome goes in the EZ table. If the media is not in `~/corteo-media`, set the row `blocked` with the same reason.

### EV-34 · Replay the corteo skill the way a host would (ED)
- Needs: none.
- Read: all of `skills/corteo/SKILL.md`, `scripts/corteo-skill.verify.mjs`, and `scripts/corteo-acceptance.verify.mjs` (the strings the skill must keep).
- Do: in `~/corteo-dsh` (WSL, Node 24), set up a scratch area:

  ```bash
  T=$(mktemp -d)
  export CORTEO_STORE_DIR=$T/library CORTEO_EXPORT_DIR=$T/exports CORTEO_MEDIA_INBOX=$T/inbox CC_RENDER_GL=swangle
  CORTEO=~/corteo-dsh/scripts/corteo
  ```

  Run every bash block of the skill top to bottom from a copy of the skill in which `~/corteo-exports` becomes `$T/exports` and `~/corteo/scripts/corteo` becomes `$CORTEO`. Never edit the skill itself for that substitution.

  Skip these and say so: the curl install; `. ~/corteo/corteo.env` and `$CORTEO_OCC` (there is no curl install here); `npm run corteo:local`; the MCP, `delegate` and brain blocks (they need a server or the harness); and `host install` (it writes to the real HOME).

  For each block record pass or fail. For renders also record the ffprobe size and duration, using `FFPROBE="$(node -p "require('@ffprobe-installer/ffprobe').path")"`.

  When a command fails: if the skill text is wrong (a flag, a JSON path, a file name), fix the text (the code wins) and rerun the block. If the code is wrong, record it under ED: blockers with the command and the error, and do not change code.
- Done when: every runnable block has a pass or fail line in ED: results, every text fix is committed, and `$T` is deleted.
- Verify: `node scripts/corteo-skill.verify.mjs`; `node scripts/corteo-acceptance.verify.mjs`; `node scripts/no-claudia.verify.mjs`.
- Commit: `EV-34: every runnable recipe in the corteo skill replayed, and the text fixed where it was wrong`.
- Out of scope: code changes; `bot/skills/*`; the README.

### Kickoff prompts

Qoder:

```text
You are the Qoder agent on corteo, track EQ and the integrator: docs/plans/07-evolution.md › "Finishing in three tracks".

Where you work
- Only in ~/corteo, branch cursor/video-editor-mvp-d191. If your IDE runs on Windows, run every git, npm and node command inside WSL: wsl.exe -e bash -lc 'source ~/.nvm/nvm.sh && cd ~/corteo && <command>' (AGENTS.md › Environment). Never run git or npm from Windows on a \\wsl$ path.
- Read AGENTS.md, then docs/plans/07-evolution.md (Decisions made, Hard rules, Night loop, "Finishing in three tracks" and the cards it names), then the "Evolution night (EV)" table in docs/plans/PROGRESS.md. That table is yours.

Your cards, in order: EV-29, EV-30, then EV-31 once the EZ and ED tables are finished, then EV-27, then EV-32. If EV-27 is doing when you start, the previous agent left it half done: finish it first.

Boundaries
- ZCode works in ~/corteo-zcode (branch ev-zcode) and DeepSeek Harness in ~/corteo-dsh (branch ev-dsh) at the same time. Do not edit their folders or branches before EV-31. Follow them with git show ev-zcode:docs/plans/PROGRESS.md and git show ev-dsh:docs/plans/PROGRESS.md.
- Until EV-31, leave skills/corteo/SKILL.md and the music UI files alone (the track section lists them).
- No questions to Carlos. One card at a time: set it doing, implement, run its verify commands, at most three attempts per error, stage by path, commit with the card's message and its row set to done or blocked in the same commit.
- You are the only one who pushes, and only in EV-32.
```

ZCode:

```text
You are the ZCode agent on corteo, track EZ: docs/plans/07-evolution.md › "Finishing in three tracks". Your job is the music UI seen in a real browser, then the two live proofs that need Carlos's media.

Where you work
- Only in ~/corteo-zcode, branch ev-zcode. If your IDE runs on Windows, run every git, npm and node command inside WSL: wsl.exe -e bash -lc 'source ~/.nvm/nvm.sh && cd ~/corteo-zcode && <command>' (AGENTS.md › Environment). Never run git or npm from Windows on a \\wsl$ path.
- Read AGENTS.md, then docs/plans/07-evolution.md (Decisions made, Hard rules, "Finishing in three tracks", and the cards EV-22 to EV-25, EV-12 and EV-33), then your table "EV track · ZCode (EZ)" in docs/plans/PROGRESS.md.

Your cards, in order: EV-33, then EV-25 and EV-12. Each of the last two runs only if its media is in ~/corteo-media; otherwise mark it blocked.

Boundaries
- Qoder works in ~/corteo and DeepSeek Harness in ~/corteo-dsh at the same time. Never edit those folders, never merge, never push.
- Your files: src/components/inspector/, src/components/timeline/, src/audio/intelligence/, src/i18n/dict/en/components.ts, timeline.ts and audio.ts, src/i18n/dict/es/index.ts, the verify:components line of package.json, and your EZ section of PROGRESS.md. Register new verifies in verify:components only. Never touch the main task table or the EV table.
- Your editor: CORTEO_PORT=5201 npm run corteo:local in its own terminal, with scratch libraries through CORTEO_STORE_DIR. Never run npm run brain or npm run harness. Stop your editor before your last commit.
- No questions to Carlos. One card at a time: set it doing, implement, run its verify commands, at most three attempts per error, stage by path, commit with the card's message and its row set to done or blocked in the same commit.
- When your table has no todo or doing row, write a three-line summary at the top of your section, commit it, and stop.
```

DeepSeek Harness:

```text
You are the DeepSeek Harness agent on corteo, track ED: docs/plans/07-evolution.md › "Finishing in three tracks". Your job is EV-34: replay every runnable recipe in skills/corteo/SKILL.md and fix the text where it is wrong.

Where you work
- Only in ~/corteo-dsh, branch ev-dsh, inside WSL: cd ~/corteo-dsh && source ~/.nvm/nvm.sh && nvm use 24 (node -v must print v24).
- Read AGENTS.md, then docs/plans/07-evolution.md (Decisions made, Hard rules, "Finishing in three tracks", card EV-34), then your table "EV track · DeepSeek Harness (ED)" in docs/plans/PROGRESS.md.

Boundaries
- Qoder works in ~/corteo and ZCode in ~/corteo-zcode at the same time. Never edit those folders, never merge, never push.
- You run on DeepSeek Harness. Never run npm run brain, brain:stop, harness, harness:install, or anything else that stops or restarts dsh.
- Your files: skills/corteo/SKILL.md and your ED section of PROGRESS.md. Never change code: a code fault goes under ED: blockers.
- No questions to Carlos. Set EV-34 to doing, do it, run its verify commands, at most three attempts per error, stage by path, and commit with the card's message and the row set to done or blocked in the same commit.
- Then write a three-line summary at the top of your section, commit it, and stop.
```

### EV-35 · The install guide says what `install.sh` does now (ED)
- Needs: EV-34.
- Read: `documentation/CORTEO_INSTALL.md`, `install.sh` (`usage`, `print_dry_run`, `write_report`, `start_brain`, `install_host_profile`), `scripts/install.verify.mjs`, `scripts/no-claudia.verify.mjs` (this file may keep only `~/claudia`, `claudia.service` and `/home/you/claudia`).
- Do: run `bash install.sh --help`, `bash install.sh --dry-run --json`, `bash install.sh --dry-run --host-profile muse` and `bash install.sh --dry-run --no-brain` (dry runs write nothing). Update the guide so every flag in `--help` and every key the report prints is described, including `--host-profile`, `--no-brain`, `CORTEO_HOST_PROFILE`, `CORTEO_SKILL_PATH`, `CORTEO_MEDIA_INBOX`, `CORTEO_EXPORT_DIR`, `CORTEO_BRAIN`, `CORTEO_BRAIN_STEP` and `CORTEO_BRAIN_URL`, and that the self-test prints `CORTEO_SELF_TEST=pass` in lowercase. The code wins: a statement the code contradicts is rewritten, and only what you ran or read in the code goes in. Keep the guide's language and style.
- Done when: every `--help` flag and every report key appears in the guide.
- Verify: `node scripts/no-claudia.verify.mjs`; `npm run verify:install`.
- Commit: `EV-35: the install guide says what install.sh does now`.
- Out of scope: `install.sh` itself; running a real install; the README (Qoder's).

### EV-36 · The bot template learns the inbox and the song film (ED)
- Needs: EV-35 (soft).
- Read: `bot/README.md` (the budgets: ≤6 KB per skill, single-quoted shell examples, no tokens or private paths), `bot/skills/corteo-edit/SKILL.md`, `scripts/build-bot-recipe.mjs`, `skills/corteo/SKILL.md` sections "Del teléfono al MP4" and "Película de una canción".
- Do: add to `bot/skills/corteo-edit/SKILL.md` the two shortest recipes in its own voice and command shape (`. ~/corteo/corteo.env` then `"$CORTEO_OCC"`): the inbox round trip (`"$CORTEO_OCC" inbox --host grok --json`, send `attachPath` back) and the song film (`"$CORTEO_OCC" song-film --audio … --to 30s --json`, render 15 to 30 seconds first). Replay each command once in a scratch library with `~/corteo-dsh/scripts/corteo` standing in for `$CORTEO_OCC` (`CORTEO_STORE_DIR`, `CORTEO_EXPORT_DIR`, `CORTEO_MEDIA_INBOX` in a `mktemp -d` folder, `CC_RENDER_GL=swangle`) and record the result. Then `npm run build:bot-recipe` and commit the regenerated `bot/dist/recipe.json`. If the file goes over 6 KB, shorten other prose in that skill; never drop a recipe that was already there.
- Done when: `npm run verify:bot-recipe` passes and both commands ran in the replay.
- Verify: `npm run verify:bot-recipe`; `node scripts/bot-rehearsal.verify.mjs`; `node scripts/no-claudia.verify.mjs`.
- Commit: `EV-36: the bot template learns the inbox and the song film`.
- Out of scope: `bot/skills/corteo-setup/SKILL.md` (its blocks are replayed by `scripts/bot-rehearsal.sh`); the other bot skills; code.

### EV-37 · `occ song-film` exits when it is done (ED)
- Needs: EV-36.
- Why: ED's blocker for EV-36. On a 15 s song, `song-film` writes its JSON and a valid MP4, then stays alive with two `server/music-listen/inference-worker.ts` children until killed; on a 6 s song it exits. A bot waiting on the command hangs.
- Read: `server/music-listen/inference.ts` (the worker host: children are `ref`'d while a request is pending and `unref`'d when `pending` empties; `REQUEST_TIMEOUT_MS` is 20 minutes; `disposeDefaultMusicInference`), `server/music-listen/listen.ts` and `server/music-listen/tool.ts` (who sends requests), `cli/song-film/run.ts` and `cli/song-film/animate.ts`, `cli/main.ts` (it sets `process.exitCode` and never calls `process.exit`).
- This card may change code in `server/music-listen/` and `cli/` only.
- Do:
  1. Reproduce: the 15 s command from the blocker in a `mktemp -d` scratch library, with a 2-minute wall limit (`timeout 600`). While it hangs, log which request is still pending: add a temporary debug line or use `--inspect`, never commit it.
  2. Fix the cause: the request that stays pending after the command's work is done must be awaited, finished or cancelled where it is sent. Do not raise or lower `REQUEST_TIMEOUT_MS`.
  3. Backstop: a one-shot CLI must not wait on warm workers. After `runCommand` finishes (success or error), `cli/main.ts` disposes the music inference host if it was loaded (import `server/music-listen/inference.ts` lazily, so commands that never touched music do not load it). The MCP server keeps its warm workers; only the CLI disposes.
  4. A verify: extend `cli/song-film.verify.ts` (or the nearest existing verify) so a run whose music request is still pending when the command finishes exits within 10 s of printing its JSON. Use an injected fake worker if the real one needs model packs; tests must not need them.
- Done when: the 15 s command exits by itself within 10 s of printing its JSON (record the wall time), the 6 s command still exits, and the verify passes.
- Verify: `npx tsc -b`; `npx tsx cli/song-film.verify.ts`; `npm run verify:cli`; `npm run verify:music-intelligence`; `npm run verify:affected -- <the files you changed>`; the registration gates if you add a verify.
- Commit: `EV-37: occ song-film exits when it is done`.
- Out of scope: the MCP server's warm workers; model packs; anything outside `server/music-listen/` and `cli/`.
