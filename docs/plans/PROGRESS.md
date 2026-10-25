# Progress

The single place for task status. Plans: `docs/plans/01-editor-claudia.md` (Plan 1), `docs/plans/02-claudia-escucha.md` (Plan 2), `docs/plans/03-deepseek-harness.md` (Plan 3), `docs/plans/04-claudia-brand.md` (Plan 4) and `docs/plans/05-opus-parity.md` (Plan 5). Rules and the work loop: `AGENTS.md`.

**Picking the next task:** if a task is `doing`, a previous session stopped in the middle of it: resume it first. Otherwise go down the table and take the first task whose status is `todo` and whose "Needs" are all `done`. Change its status to `doing`, finish it, set `done`, and commit this file together with the work.

**Harness tracks (Plan 3):** the HQ and HW tasks have their own tables at the end of this file. Only the Qoder agent takes HQ tasks and only the WorkBuddy agent takes HW tasks, each in its own worktree and branch (see `docs/plans/03-deepseek-harness.md` › Parallel work), with the same picking rule applied to its own table. Every other agent skips both tables. Their task cards are in the plan doc.

**Brand tracks (Plan 4):** the BD and BQ tables are also at the end of this file, with the same rule. Because the Qoder and DeepSeek agents were unavailable on 2026-10-24, the WorkBuddy agent executed all eight cards itself in `~/corteo-workbuddy`; the tables say who wrote each card, not who was supposed to. B-9 merged the work into this branch the same day (see its card).

Statuses: `todo`, `doing`, `done`, `blocked` (see Blockers), `optional` (only if the user asks).

## State at handoff (2026-10-24)
- Branch `cursor/video-editor-mvp-d191`. The app runs with `npm run dev` on http://localhost:5199.
- Baseline checks on this commit, on a 4-core Linux VM without a GPU: `npx tsc -b` passes, `npm run lint` passes (warnings only, all from upstream), `npm run verify:i18n` passes, `npm run build` passes (the "chunks larger than 2500 kB" warning is upstream's), and `CC_RENDER_GL=swangle npm test` passes: exit 0, 197 test segments plus the pre- and post-test chains, about 6 minutes. Without `CC_RENDER_GL=swangle` on a machine without GPU WebGL2, three render tests fail with "WebGL2 not available" (`remotion/video-decoder-render.verify.mjs`, `src/gl/clipFxExport.verify.mjs`, `src/gl/clipFxExport.offthread.verify.mjs`); that is the environment, not a code failure.
- After H-9 (both harness tracks merged, 2026-10-25, same VM, Node 24): `npx tsc -b` and `npm run lint` pass (warnings only), `npm run build` passes with upstream's chunk-size warning, and `CC_RENDER_GL=swangle npm test` passes: exit 0, 210 test segments (the 206 plus the four `scripts/harness/*.verify.mjs`), including `font-tools.verify.ts`. The four harness verifies also passed on their own before the suite.
- After B-9 (Plan 4 merged, 2026-10-24, same VM): `npx tsc -b`, `npm run lint` (warnings only, none on lines B-9 changed) and `npm run verify:i18n` pass. At `8ee1061`, `CC_RENDER_GL=swangle npm test` passes (exit 0, 203 test segments, that is the 197 plus the six brand verifies, plus the pre- and post-test chains, about 6½ minutes) and `npm run build` passes with upstream's chunk-size warning. The commits after it change one Spanish string and the docs. Screenshots, not committed: the projects page at 1440x900 and 390x844 and a card on hover, the editor with the chat open and collapsed at 1440x900, and the phone upload page in Spanish at 390x844.
- If a test fails on your machine before you have changed anything, it is a baseline difference: record it under Blockers with its output, and don't count it against your task.
- Grok's attempt: Grok worked in `~/corteo` from the old `IMPLEMENTATION_PLAN.md` (a first-draft plan with Python WhisperX/demucs, Zustand, i18next and a UI redesign) and got stuck. That file is deleted. None of Grok's work is on this branch: the user parks it on a branch `grok-wip` for review. Do not merge, cherry-pick or build on `grok-wip`; if something there is worth keeping, it comes back as a task card here.
- Qoder and WorkBuddy's attempt: the GitHub fork's branch `cursor/video-editor-mvp-d191` (https://github.com/uset82/corteo, at `56676ff` on 2026-10-24) was built from `1d00e0a` with the old `IMPLEMENTATION_PLAN.md`. It has first versions of P2-1 to P2-5 plus extras, with known bugs found in a review on 2026-10-24: duplicate detection samples the middle of the whole file, ASS import ignores `\kf` and drops text before the first tag, HEVC files are tagged `hev1` instead of `hvc1`, the cool white balance rotates every hue, the tool catalog is stale so `npm run build` fails, and three files are over 500 lines. It is not merged: the user decides whether it comes in. Until then, the same rule as `grok-wip` applies.
- Plan 3 (approved 2026-10-24): the built-in chat moves to free models through DeepSeek Harness. Qoder (HQ) and WorkBuddy (HW) work on it in parallel in the worktrees `~/corteo-qoder` and `~/corteo-workbuddy`, on the GitHub branches `harness-qoder` and `harness-workbuddy`; H-9 merges them into this branch. H-9 is done (2026-10-25): the Qoder track landed first, and this merge brings WorkBuddy's HW-1 to HW-5, so `npm run harness`, `npm run harness:doctor` and `npm run harness:install` are the way to start it.

## Task table

| ID | Task | Status | Needs |
|----|------|--------|-------|
| P0-1 | Remove first-attempt leftovers and orphan components | done | |
| P0-2 | Raise the dev server heap | todo | |
| P0-3 | `npm run start:claudia` and `.env.claudia.example` | todo | P0-2 |
| P0-4 | Spanish README | todo | P0-3 |
| H-9 | Merge the harness tracks (Cursor agent only) | done | HQ-1 to HQ-5 and HW-1 to HW-5 `done` or `blocked` on their own branches |
| B-9 | Merge the brand tracks (Cursor agent only) | done | BD-1 to BD-4 and BQ-1 to BQ-4 |
| P1-1 | Providers off: server block | todo | P0-3, H-9 |
| P1-2 | Providers off: hide UI, filter MCP tools | todo | P1-1 |
| P1-3 | Allowed hosts from env | todo | P0-3 |
| P1-4 | "Conectar Claudia" card | todo | P1-3 |
| P1-5 | `npm run editor-host` (headless editor tab) | todo | P0-3 |
| P1-6 | `videoclip-musical` skill | todo | P1-2 |
| P1-7 | Webhooks with HMAC | optional | P4-3 |
| L-01 | Server-side Beat This + CLAP runner | todo | |
| L-02 | Listening DSP in `src/audio/listen/` | todo | |
| L-03 | Mood per section + Latin labels | todo | L-01 |
| L-04 | Lyric lines, chorus candidates, SongMap + cache | todo | L-02 |
| L-05 | Pictures: map PNG + spectrogram | todo | L-04 |
| L-06 | `listen_to_song` MCP tool | todo | L-01, L-03, L-05 |
| L-07 | Real-ear relay (off by default) | todo | L-06 |
| L-08 | Keyframable filters + binary-search sampling | todo | |
| P2-1 | Ken Burns | todo | |
| L-09 | Music reactions + tools | todo | L-06, L-08, P2-1 |
| L-10 | Caption motion `latido` | todo | L-06 |
| L-11 | Music UI: inspector section, timeline map, song dialog | todo | L-09 |
| L-12 | `escuchar-cancion` skill + MCP prompt | todo | L-09, P1-6 |
| L-13 | Listening end-to-end proof | todo | L-11, L-12 |
| P2-2 | Captions: verso/coro, ASS/VTT import | todo | |
| P2-3 | Duplicate detector | todo | |
| P2-4 | HEVC export + presets | todo | |
| P2-5 | Countdown timecode | todo | |
| P2-6 | Premiere shortcut preset | todo | |
| P3-1 | Pinned yt-dlp sync | todo | |
| P3-2 | Platform import route + `import_from_platform` | todo | P3-1 |
| P3-3 | Source credits + `creditos.txt` | todo | P3-2 |
| P3-4 | "Importar desde enlace" dialog | todo | P3-2 |
| P4-1 | Variants model + tools | todo | |
| P4-2 | `render_variant_previews` | todo | P4-1 |
| P4-3 | "Comparar versiones" dialog | todo | P4-2 |
| P5-1 | Full Spanish dictionary | todo | |
| P5-2 | i18n coverage + placeholder gate | todo | P5-1 |
| P5-3 | Untranslated-text scan | todo | P5-2 |
| P6-1 | Claudia end-to-end proof + screenshots | todo | every task above is `done` or `blocked` |
| P7-1 | EffectCraft titles sidecar | optional | P6-1 |

## Task cards
Each card says where the plan describes it, which files to start from, when it counts as done, and what to run. The verify commands are in addition to the standard loop in `AGENTS.md`.

### P0-1 · Remove first-attempt leftovers — done
Done in commit `a3b6372` (plus `e5e8989`, which fixed the `tsc -b` error the first attempt left in `src/i18n/locale.ts`).

### H-9 · Merge the harness tracks — done
- Plan: Plan 3 › H-9. Done by the Cursor agent on 2026-10-25. Both tracks are `done`.
- What came in, in two merges. First a fast-forward to GitHub's `main` at `b9d5752`, then `eb7faac` merged `harness-qoder` at `4a7abc7` (HQ-1 to HQ-5). That conflicted only in `package.json` (every `test:serial` segment from both sides: `providers-off.verify` after `llm-proxy.verify`, `dsh-gateway.verify` before `acceptance-loop.verify`) and `settingsAgentProviders.ts` (the `dsh` note, with the Anthropic note ending in `驱动 Claudia。`). `es/brand.ts` shadows none of the 15 harness keys. `5c8243a` then merged `harness-workbuddy` at `72242de` (HW-1 to HW-5). The four predicted conflicts were the only ones: `AGENTS.md` and `docs/plans/04-claudia-brand.md` keep this branch's text (HW does not edit them; the extra B-0 prose on that branch was already stale), `package.json` keeps both sides with `scripts/harness/*.verify.mjs` at the tail of `test:serial`, and PROGRESS keeps the Qoder section and WorkBuddy's finished section. `f4b5165` is in the target, so the font-tools failure recorded on the HW branch is gone.
- `eed3137`: a `dsh`-only fix in the `/llm` proxy for HQ-5's finding. Most free lanes open a tool call with `{"tool_calls":[{"index":0}]}`, which `@ai-sdk/openai-compatible` 3.0.75 rejects for the whole stream; the SDK already buffers a call until its name arrives, so the proxy only adds `function: {}` to deltas without one (`server/sse-tool-call-fix.ts`). Other providers stream byte for byte. `dsh-gateway.verify`'s stub opens its call that way, split across two writes.
- `6743fd7`: the `dsh` default model is `nvidia/nemotron-3-ultra-550b-a55b:free`. HW-3's two faster correct lanes did not survive HW-4 (`liquid/lfm-2.5-2.6b:free` returned 429; `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` never called the timeline), and ultra is the model that applied the MCP cut. `combo:recommended-free` was not among the eight lanes that got the arguments right. `f65458f` had set lightning while HW-3 was still blocked; lightning remains in the menu (6184 ms in the sweep).
- README: `README.es.md` has the Estado line, `npm run harness:install`, `npm run harness` and `npm run harness:doctor`, and the `corteo` alias with `OPENCHATCUT_PROVIDERS=off`. The long guide is `docs/harness.md`. `README.md` says the same in English.
- Left over: HQ-5's editor session only got one free model through a full edit, before the proxy repair. HW-3 later showed eight lanes call `split_item` correctly against the gateway itself. Those lanes have not been retried through the editor since the repair.
- Checks: see "State at handoff".

### B-9 · Merge the brand tracks — done
- Plan: Plan 4 › B-9. Done by the Cursor agent on 2026-10-24.
- What came in: the brand work was on GitHub's `harness-workbuddy` at `1fabc26` (`1ddc7bd` BD-1 to BD-4, `f179f63` BQ-1 to BQ-4, `01bbb02` B-0, `1fabc26` this file). This branch was its ancestor, so the merge was a fast-forward. `harness-workbuddy` holds no HW work yet; H-9 still merges it, and `harness-qoder`, later.
- Fixed in the review, one commit each:
  - `087d1f8`: the executable bit of `cli/occ.mjs` and `dev-with-mcp.sh`, dropped because the commits were made from Windows over `\\wsl.localhost`.
  - `f56a084`: a project missing from the index was copied as "Copia de 工程"; now "Copia de proyecto".
  - `f4b5165`: two verifies still expected the old name (`src/agent/tools/font-tools.verify.ts` the FCPXML "ChatCut Export" event, `server/agent-runs/executor.verify.ts` "You are OpenChatCut"), so `npm test` failed in its first minute. The brand work had never been through the full suite.
  - `7fbf2b3`: the card's hidden action buttons shared the name's row, so names were cut to "Exampl…" at 1440 px and vanished at 390 px. The name now has its own line.
  - `e37d259`: new empty projects were auto-named in Chinese ("流光序曲"); now in Spanish ("Latido nocturno").
  - `4b61d1c`: AI tell 4. Sparkles were left on the top bar's generation tasks button, the composer's mode chip, prompt enhancement, template references and the import note, and the proposal card had an icon tile.
  - `1b12607`: AI tell 8. English and title case on screens this plan owns: the card times ("11 hr ago"), the import/export note, the header and top-bar tooltips, the capability banner (English capability names, no space after the colon), and the composer, workflow picker and model picker.
  - `8ee1061`: the phone upload page said "Send media to OpenChatCut", had the old orange look, and served Chinese to Spanish users because the server only accepted `en`, `it` and `ru`. Now Claudia, Spanish, and the Claudia palette.
  - `8d29d9c`: the demo project's Spanish name was title case ("Proyecto de Ejemplo").
- README and AGENTS prose rewritten for step 4: Claudia is the product, corteo the repository and the command; the two brand font licences are in the README credits.
- Checks and screenshots: see "State at handoff".

### P0-2 · Raise the dev server heap
- Plan: Plan 1 › Phase 0.
- Files: `scripts/dev-profile.mjs` (`runVite`), `scripts/dev-profile.verify.mjs`.
- Do: start Vite as `node --max-old-space-size=<MB> node_modules/vite/bin/vite.js …`, with MB from `OPENCHATCUT_DEV_HEAP_MB` (default 6144). Export a small helper that builds the argument list so the verify can test it.
- Done when: after `npm run dev`, `ps -eo args | grep vite.js` shows `--max-old-space-size=6144`; with `OPENCHATCUT_DEV_HEAP_MB=4096` it shows 4096; the verify asserts both.
- Verify: `npm run verify:runtime-profile`.

### P0-3 · `npm run start:claudia` and `.env.claudia.example`
- Plan: Plan 1 › Phase 0.
- Files: `package.json` (scripts), new `.env.claudia.example`, `.gitignore`.
- Do:
  - Script: `"start:claudia": "node --env-file-if-exists=.env.claudia scripts/dev-profile.mjs"`.
  - `.env.claudia.example` lists `OPENCHATCUT_MCP_TOKEN=` (43 base64url characters, e.g. `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='`), `OPENCHATCUT_PROVIDERS=off`, `OPENCHATCUT_ALLOWED_HOSTS=`, `PREFERRED_TRANSCRIPTION_PROVIDER=local`, `OPENCHATCUT_DEV_HEAP_MB=6144`, and a commented-out `# CC_RENDER_GL=swangle` for PCs without GPU WebGL (see `AGENTS.md` › Environment), each with a one-line Spanish comment.
  - `.gitignore` ignores `.env.*`: add `!.env.claudia.example` next to `!.env.example`.
- Pitfall: in a dev profile the server's environment is `{...process.env, ...profile settings}` (`profileChildEnvironment` in `scripts/dev-profile.mjs`), and Vite stops reading `.env*` files once the profile has saved settings (`config/vite.config.ts`, around line 90). That is why the variables must arrive through the process environment. `PREFERRED_TRANSCRIPTION_PROVIDER` is a settings key, so a value saved in Settings wins over the env file.
- Done when: with `.env.claudia` holding token T, the MCP smoke test in `AGENTS.md` works with T and gets 403 with any other token; without `.env.claudia` the script still starts.
- Verify: `npm run verify:runtime-profile`, MCP smoke test.

### P0-4 · Spanish README
- Plan: Plan 1 › Phase 0.
- State: `README.md` was rewritten in Spanish on 2026-10-24, before P0-3 (what the editor is, status, requirements, install, the `corteo` alias, data and token locations, syncing Cursor's branch to GitHub, credits and AGPL). B-9 then renamed its prose: the product is Claudia, corteo is the repository and the command, and the brand fonts' licences are in the credits. Don't replace it: extend it, with the same naming.
- Files: `README.md` (leave `README_ZH.md` alone).
- Do: in Spanish: what the editor is (Claudia, a fork of OpenChatCut for music videos, driven by Claudia over MCP; the repository is corteo), requirements (WSL/Linux, Node 24, ffmpeg comes with npm), `npm install`, `npm run dev`, `npm run start:claudia`, how to connect Claudia (URL, token, `.env.claudia`), where data lives (`~/.openchatcut`), AGPL v3 note with a link to upstream OpenChatCut (https://github.com/0xsline/OpenChatCut).
- Remaining: once P0-3 and P1-4 are done, add `npm run start:claudia`, `.env.claudia` and the steps to connect Claudia, and update its "Estado" section.
- B-9 rewrites the README and AGENTS prose for the new name: the product is Claudia, corteo stays the repository and the command, and the two font licences join the credits. Don't pre-empt it here.
- Done when: a new user can go from clone to the running editor and a connected Claudia with only the README.

### P1-1 · Providers off: server block
- Plan: Plan 1 › Phase 1, narrowed by Plan 3: the chat's model providers are HQ-3's job.
- Files: `server/plugins/providers-off.ts` + its verify (created by HQ-3 and already registered right after `requestShapeGatePlugin()` in `server/plugins/index.ts`).
- Do: extend HQ-3's blocked list, don't write a second middleware. When `OPENCHATCUT_PROVIDERS=off`, it also answers 403 `{"error":"providers_disabled"}` for: `/generate/image`, `/generate/video`, `/generate/voice`, `/generate/music`, `/generate/sound`, `/api/stock-search`, `/api/firecrawl/*`, `/api/web-browser`, `/assemblyai` (Vite proxy in `config/vite.config.ts`), `/api/assemblyai-upload`, `/e2b/*`, `/api/upload-post`, and `/api/transcribe` (cloud transcription: OpenAI, Deepgram, Groq, ElevenLabs, Cartesia). `/llm` (only DeepSeek Harness, Ollama and LM Studio pass) and the Codex, Copilot, Claude Code and xAI routes are already blocked by HQ-3.
- Keep working: `/generate/progress` (Phase 3 import progress uses it), `/api/hf-proxy` (downloads the local model packs), and everything local (export, render, waveform, frames, scene detection, local transcription). Check `/generate/subtitles`, `/api/isolate-voice` and `/api/auto-grade`: block them only if they call a keyed service.
- Middlewares added directly in `configureServer` run before Vite's internal ones, including the `/assemblyai` proxy, so the existing registration covers it.
- Done when: with the switch on, a POST to each blocked route gets 403 `providers_disabled` and the chat still works through DeepSeek Harness; with it off, behaviour is unchanged.
- Verify: the extended verify (route list + middleware), `npm run verify:mcp`.

### P1-2 · Providers off: hide UI, filter MCP tools
- Plan: Plan 1 › Phase 1, narrowed by Plan 3: the chat stays, on DeepSeek Harness.
- Files: the client flag HQ-3 added in `config/vite.config.ts` (its own define, not `__CONFIGURED_CAPS__`), the Settings panes for generation, stock and cloud transcription vendors (`src/components/settings/`), the generation menus, `src/agent/external-tool-schemas.ts`.
- Do: reuse HQ-3's flag. Keep the chat panel and the dashboard model-setup card: with the switch on they lead to DeepSeek Harness (HQ-2, HQ-3 already hid the other agent vendors). Hide the generation menus and the generation, stock and cloud-transcription panes, and make `externalToolSchemas()` drop generation and stock tools when the switch is on.
- Done when: with `.env.claudia` (switch on) the editor has no generation menus, Settings shows no generation, stock or cloud-transcription vendors, `tools/list` over MCP has no generation or stock tools, and the chat still works through DeepSeek Harness; with the switch off nothing changes.
- Verify: `npm run verify:agent-tools`, `npm run verify:mcp`, `npm run verify:components`, a new verify for the schema filter.

### P1-3 · Allowed hosts from env
- Plan: Plan 1 › Phase 1.
- Files: `config/vite.config.ts` (`server.allowedHosts`), `config/vite.config.verify.ts`.
- Do: append the comma-separated hosts in `OPENCHATCUT_ALLOWED_HOSTS` (trimmed, empty entries dropped) to the existing list.
- Done when: `curl -H 'Host: editor.example.com' http://localhost:5199/` is refused without the variable and served with `OPENCHATCUT_ALLOWED_HOSTS=editor.example.com`.
- Verify: `npx tsx config/vite.config.verify.ts`. `config/` changes need the full gate (`npm test`).

### P1-4 · "Conectar Claudia" card
- Plan: Plan 1 › Phase 1 (connection kit).
- Files: `src/components/settings/McpGuide.tsx` (it already shows the token in trusted sessions), i18n dictionaries.
- Do: a card titled "Conectar Claudia" with the MCP URL, the token (reuse the existing reveal/copy logic), the `defineConnection` snippet from the plan with copy buttons, and a note that the editor's domain must be in Claudia's `hosting.egressDomains`.
- Done when: the card renders in Spanish in Settings › MCP and the copied snippet is valid TypeScript.
- Verify: `npx tsx src/components/settings/mcpGuideLoader.verify.ts`, `npm run verify:i18n`.

### P1-5 · `npm run editor-host`
- Plan: Plan 1 › Phase 1 (connection kit).
- Files: new `scripts/editor-host.mjs` (add `!/scripts/editor-host.mjs` to `.gitignore`), `package.json`.
- Do: open the editor on a project in headless Chromium (Playwright is already a dev dependency; run `npx playwright install chromium` once) and keep the tab alive; reconnect if the dev server restarts; exit cleanly on Ctrl+C. A tab registers with the MCP bridge only while a project is open: take the project from `--project <id>`, else the most recently updated one; the `get_editor_url` MCP control returns a project's editor URL.
- Done when: with no normal browser open, `openchatcut_status` over MCP reports a connected editor and `tools/list` returns the full editor tool set (not the 44 offline tools).
- Verify: MCP smoke test before and after starting it.

### P1-6 · `videoclip-musical` skill
- Plan: Plan 1 › Phase 1 (skill).
- Files: new `src/agent/skills/videoclip-musical/SKILL.md` (copy the frontmatter shape of `src/agent/skills/music-intelligence/SKILL.md`).
- Do: Claudia's end-to-end workflow from the plan. Name only tools that exist today; each later task that adds a tool updates this skill.
- Done when: `load_skill` with `videoclip-musical` over MCP returns it.
- Verify: `npm run verify:skills`.

### P1-7 · Webhooks with HMAC (optional)
- Plan: Plan 1 › Phase 1. Only if the user asks; polling with `track_export` already works.
- Do: `OPENCHATCUT_WEBHOOK_URL` + `OPENCHATCUT_WEBHOOK_SECRET`; POST JSON for `export.completed`, `export.failed`, `import.completed`, `variant.chosen` with an `X-Corteo-Signature: sha256=<hex>` HMAC of the body; retries with backoff; never blocks the export.
- Verify: a verify with a local HTTP receiver checking the signature.

### L-01 · Server-side Beat This + CLAP runner
- Plan: Plan 2 › Part A (server runner).
- Files: `desktop/native-rhythm-worker.ts`, `desktop/native-clap-worker.ts` (move the inference cores to shared modules), new `server/music-listen/`, `src/audio/intelligence/store.ts` (cache key), `src/agent/external-tool-policy.ts`, `server/external-agent/offline-tools.ts`, `server/external-agent/offline-executor.ts`.
- Do: run the cores in a `worker_threads` worker with ffmpeg decoding to 22.05 kHz mono; same cache key; make `analyze_music` and `inspect_music` server-direct and add them to the offline catalog.
- Pitfall: the model packs (about 117 MB) are installed from Settings; tests must not need them (inject a fake core). The desktop app must keep working: run the desktop verifies.
- Done when: with the packs installed and no editor tab open, `analyze_music` over MCP returns BPM and sections for an uploaded song, and the media card badge shows the result.
- Verify: `npm run verify:music-intelligence`, `npm run verify:agent-tools`, `npm run verify:mcp`.

### L-02 · Listening DSP in `src/audio/listen/`
- Plan: Plan 2 › Part A (new measurements) and Verification (synthetic tests).
- Files: new `src/audio/listen/*.ts` (pure functions, no DOM, no Node-only APIs) + verifies; `src/audio/beats.ts` (extract the onset envelope so both share it).
- Do: 50 ms energy, bass/mid/brightness bands, onsets and accents, moments (drop, break, build, stop, vocals in/out), key and mode, and an ffmpeg `ebur128` parser (`-hide_banner -nostats`, never `-v error`).
- Done when: all synthetic-audio tests in Plan 2 › Verification pass, generated in the test (no audio fixtures in git).
- Verify: the new verifies, `npx tsx src/audio/beats.verify.ts`.

### L-03 · Mood per section + Latin labels
- Plan: Plan 2 › Part A (mood per section).
- Files: `src/audio/intelligence/clapClient.ts`, the prototypes JSON next to it, new `scripts/build-clap-prototypes.mjs` (add a `!/scripts/…` line to `.gitignore`).
- Do: score each section's windows against the prototypes; add the Latin moods and genres from the plan with Spanish display names. Embeddings never leave the server.
- Done when: inspect results list a mood per section with Spanish names.
- Verify: `npm run verify:music-intelligence`.

### L-04 · Lyric lines, chorus candidates, SongMap + cache
- Plan: Plan 2 › Part A (lyrics) and the tool output it feeds.
- Files: `src/audio/listen/` (SongMap type), the server cache next to the music-analysis cache.
- Do: group the local whisper words into lines, mark repeated lines as chorus candidates, attach them to sections; user-provided lyrics win. Define the `SongMap` type and its cache keyed by asset, source revision and analyzer fingerprint.
- Verify: new verifies for line grouping and chorus detection.

### L-05 · Pictures: map PNG + spectrogram
- Plan: Plan 2 › Part A (pictures).
- Files: new `server/music-listen/pictures.ts`; `package.json` (pin `sharp` as a direct dependency at the version in `overrides`).
- Done when: both PNGs are generated for a synthetic song, are non-blank (pixel variance check) and show the mm:ss axis.
- Verify: a new verify. `package.json` changes need the full gate.

### L-06 · `listen_to_song` MCP tool
- Plan: Plan 2 › Part A (MCP tool).
- Files: follow "Adding an MCP tool" in `AGENTS.md`; images through `__images` like `src/agent/tools/frames-tool.ts`.
- Done when: over MCP with no editor tab, `listen_to_song` returns a Spanish summary, compact JSON under 16,000 characters, a `songMapRef` and two image blocks; without model packs it still returns the DSP measurements, fallback beats and pictures.
- Verify: `npm run verify:mcp`, `npm run verify:agent-tools`, `npm run verify:server-tool-catalog`, the new verify (size limit).

### L-07 · Real-ear relay (off by default)
- Plan: Plan 2 › Part B.
- Files: new `server/music-listen/relay.ts` + verify with a local mock OpenRouter.
- Do: only when `OPENCHATCUT_LISTEN_RELAY=openrouter` and `OPENROUTER_API_KEY` are set; 64 kbps mono mp3; Spanish prompt; `audio_tokens > 0` means "verificado"; otherwise cross-check against the map and the whisper words; cache per song version and model. This is the only paid AI call allowed in the editor; the chat's free models through DeepSeek Harness (Plan 3) are the other AI exception.
- Done when: the mock test covers request shape, the `audio_tokens` rule, caching, and no call when off.

### L-08 · Keyframable filters + binary-search sampling
- Plan: Plan 2 › Part C (animatable filters).
- Files: `src/editor/clipTypes.ts`, `src/editor/keyframeRegistry.ts`, `src/editor/clipFade.ts`, `src/editor/TimelineMediaLayer.tsx`, `edit_item` schema and executor, `src/editor/keyframes.ts`.
- Done when: a brightness keyframe pair changes the preview and the export identically, and `sampleKeyframes` gives the same results as before on the existing tests.
- Verify: `npx tsx src/editor/keyframes.verify.ts`, `npm run verify:editor`, `npm run verify:export-gl`.

### P2-1 · Ken Burns
- Plan: Plan 1 › Phase 2 (Ken Burns).
- Files: new `src/editor/kenBurns.ts` + verify; `AnimationTab` in `src/components/inspector/InspectorContent.tsx`; the timeline clip context menu; new tool `apply_ken_burns`.
- Done when: in the editor, a photo gets "Ken Burns" from the inspector or the context menu in one undo step; over MCP `apply_ken_burns` does the same; two exported frames of the photo differ.
- Verify: the new verify, `npm run verify:editor`, `npm run verify:agent-tools`, `npx tsx src/components/inspector/inspector-controls.verify.ts`.

### L-09 · Music reactions + tools
- Plan: Plan 2 › Part C (generators, MCP tools).
- Files: new `src/editor/musicReactions.ts` + verify; tools `music_reaction_plan`, `apply_music_reaction`, `clear_music_reaction`; mapping from `src/agent/tools/music-intelligence-plan.ts`.
- Done when: the generator tests in Plan 2 › Verification pass and the three tools work over MCP with no tab.
- Verify: the new verifies, `npm run verify:agent-tools`, `npm run verify:mcp`, `npm run verify:server-tool-catalog`.

### L-10 · Caption motion `latido`
- Plan: Plan 2 › Part C (captions `latido`).
- Files: `src/captions/captionMotion.ts`, `src/captions/CaptionMotionControls.tsx`.
- Verify: `npm run verify:caption-motion`.

### L-11 · Music UI
- Plan: Plan 2 › Part C (UI) and Part D.
- Files: `AnimationTab` in `src/components/inspector/InspectorContent.tsx`, `src/components/timeline/TimelineToolbar.tsx` and the timeline track view, `src/audio/intelligence/MusicAnalysisBadge.tsx`.
- Done when: "Reaccionar a la música", "Mapa musical" and "Mapa de la canción" work in Spanish; each new component stays under 500 lines.
- Verify: `npm run verify:components`, `npm run verify:i18n`, screenshots into `test-results/claudia/`.

### L-12 · `escuchar-cancion` skill + MCP prompt
- Plan: Plan 2 › Part E.
- Files: new `src/agent/skills/escuchar-cancion/SKILL.md`, `server/external-agent/mcp-prompts.ts`, `src/agent/skills/videoclip-musical/SKILL.md` (step 2).
- Verify: `npm run verify:skills`, `npm run verify:mcp`.

### L-13 · Listening end-to-end proof
- Plan: Plan 2 › Verification (end-to-end).
- Needs the user's song in `CLAUDIA_E2E_MEDIA_DIR` (default `~/corteo-media`). If it is missing, mark this task `blocked` and continue.
- Done when: the four end-to-end checks in the plan pass through the real MCP endpoint, with the output paths recorded here.

### P2-2 · Captions: verso/coro, ASS/VTT import
- Plan: Plan 1 › Phase 2 (captions).
- Files: `src/captions/styles.ts`, new `src/captions/ass.ts` and `src/captions/vtt.ts` + verifies, `src/captions/srt.ts`, `src/captions/CaptionStyleMenu.tsx`, `src/captions/CaptionsPanel.tsx`, new tool `import_subtitles`.
- Done when: importing an ASS file with `\k` tags gives word-timed karaoke in the preview and the export.
- Verify: `npm run verify:captions`, the new verifies, `npm run verify:agent-tools`.

### P2-3 · Duplicate detector
- Plan: Plan 1 › Phase 2 (duplicates).
- Files: new route `/api/media-duplicates` in `server/plugins/`, `src/media/MediaPoolToolbar.tsx`, a new dialog, new tool `find_duplicate_media`.
- Verify: a verify with generated test images (same, near-same, different).

### P2-4 · HEVC export + presets
- Plan: Plan 1 › Phase 2 (export).
- Files: `src/export/useExportDialogModel.ts`, `src/export/ExportDialog.tsx`, `server/plugins/export-plan.ts`, `remotion/render.mjs`, export tool schemas.
- Done when: a 3 s 4K export reports `hevc` 3840x2160 with the `hvc1` tag in ffprobe, and the two presets appear in the dialog.
- Verify: `npm run verify:export-gl`, `npx tsx server/plugins/export-params.verify.ts`, `npx tsx server/plugins/export-runtime.verify.ts`.

### P2-5 · Countdown timecode
- Plan: Plan 1 › Phase 2 (countdown).
- Files: `src/components/timeline/timelineUtil.ts`, `src/components/timeline/TimelineToolbar.tsx`, `src/components/timeline/usePlayheadPaint.ts`.
- Verify: `npx tsx src/editor/timecode.verify.ts`, `npx tsx src/components/timeline/usePlayheadPaint.verify.ts`, a new verify for `formatTimecode`.

### P2-6 · Premiere shortcut preset
- Plan: Plan 1 › Phase 2 (Premiere shortcut preset).
- Files: `src/shortcuts/ShortcutsDialog.tsx`, `src/shortcuts/` catalog and keymap.
- Verify: `npm run verify:shortcuts`.

### P3-1 · Pinned yt-dlp sync
- Plan: Plan 1 › Phase 3 (yt-dlp).
- Files: new `scripts/sync-yt-dlp.mjs` (model it on `scripts/sync-whisper-cli.mjs`; add a `.gitignore` exception), `package.json` (`sync:yt-dlp`, `predev`), `.gitignore` (`vendor/`).
- Done when: `npm run sync:yt-dlp` downloads the pinned binary, checks its SHA-256, and is a no-op the second time.

### P3-2 · Platform import route + `import_from_platform`
- Plan: Plan 1 › Phase 3 (route).
- Files: new `server/plugins/platform-import.ts` + verify (fake yt-dlp binary, no network in tests), registered in `server/plugins/index.ts`; new tool `import_from_platform`.
- Done when: a YouTube URL imports into the media pool with progress, and non-allowlisted hosts are rejected.

### P3-3 · Source credits + `creditos.txt`
- Plan: Plan 1 › Phase 3 (credits).

### P3-4 · "Importar desde enlace" dialog
- Plan: Plan 1 › Phase 3 (UI).
- Files: `src/media/MediaPoolToolbar.tsx`, a new dialog; direct file URLs go to `/api/import-url` (`server/plugins/upload-routes.ts`).

### P4-1 · Variants model + tools
- Plan: Plan 1 › Phase 4.
- Files: project types and persistence (`src/persist/`, check `npm run verify:sqlite-migration` if the stored shape changes), `src/components/timeline/TimelineTabs.tsx` (`duplicateTimeline`), new tools `create_variants`, `get_variant_choice`, `choose_variant`.

### P4-2 · `render_variant_previews`
- Plan: Plan 1 › Phase 4. 480p server renders of each variant.

### P4-3 · "Comparar versiones" dialog
- Plan: Plan 1 › Phase 4. A 2x2 grid of synced players, "Elegir esta versión", the `variant.chosen` event.

### P5-1 · Full Spanish dictionary
- Plan: Plan 1 › Phase 5.
- Files: `src/i18n/dict/es/` (mirror the 19 modules of `src/i18n/dict/en/`, then make `src/i18n/dict/es/index.ts` assemble them like `src/i18n/dict/it/index.ts`), `src/i18n/dictRegistry.ts`.
- Do: one commit per module. Keys stay the Chinese originals; keep every `{placeholder}`.
- Also fold `src/i18n/dict/en/brand.ts` and `src/i18n/dict/es/brand.ts` (Plan 4) into the per-module files, then drop the spread in `dictRegistry.ts` and the last entry in `en/index.ts`.
- Pitfall: source files may not exceed 500 lines (`scripts/verify-gate-coverage.verify.mjs`). Split a long module into parts, or add it to that file's `dataModules` list like `src/i18n/dict/en/settings.ts`.
- Fold `es/brand.ts` (about 120 keys from Plan 4 and B-9) into the modules too. Where `es/index.ts` has a harness entry for the same key (Plan 3), the harness text wins. Its sentence-case style is the one to follow.
- Already in Spanish: the projects page, the editor's top bar (button labels), the chat's header, onboarding, starters and quick actions, the composer with its workflow and model pickers, and the capability banner. Still English: the rest of the chat (165 keys under `src/components/chat/`), the run inspector, the generation-task and export-history panels, and the media (including 手机传素材), preview, timeline, inspector and export panels.
- Verify: `npm run verify:i18n`.

### P5-2 · i18n coverage + placeholder gate
- Plan: Plan 1 › Phase 5. Extend `scripts/check-i18n.mjs`.

### P5-3 · Untranslated-text scan
- Plan: Plan 1 › Phase 5. Playwright scan of the listed screens for Chinese and untranslated English.

### P6-1 · Claudia end-to-end proof + screenshots
- Plan: Plan 1 › Phase 6.
- Needs the user's media in `CLAUDIA_E2E_MEDIA_DIR`. Report pass or fail per item, with output paths, in this file.

### P7-1 · EffectCraft titles sidecar (optional)
- Plan: Plan 1 › Phase 7. Only if the user asks.

## Decisions made during the work
Add a line when you choose something the plans leave open: date, task ID, decision, reason.

- 2026-10-24 · Plan 3 · The built-in chat stays, with free models through the local DeepSeek Harness (plus Ollama and LM Studio); `AGENTS.md` rule 1 changed accordingly. P1-1 and P1-2 now only cover generation, stock and cloud transcription, and P1-1 waits for H-9 so `server/plugins/providers-off.ts` is created once (by HQ-3). Reason: Carlos wants Claudia's chat in the editor on free models, without paid APIs.
- 2026-10-24 · Plan 4 · The eight brand cards ran on `harness-workbuddy` in the WorkBuddy worktree, not as two tracks on `brand-deepseek` and `brand-qoder`: neither agent was available and the cards were ready. The file split in the plan still holds for the review, because each card touched the files its track owns. Reason: waiting for two idle agents would have left the name and the look undone.
- 2026-10-24 · B-9 · Settings is "Ajustes" in Spanish (`设置`, `设置 · API 密钥`), replacing "Configuración". Reason: the harness strings already say "Pégalas en Ajustes › DeepSeek Harness" and the banner says "Ir a ajustes".
- 2026-10-24 · B-9 · A copy of a project with no name is "Copia de proyecto", and new empty projects get a Spanish noun and adjective ("Latido nocturno"; every noun is masculine so any adjective agrees). Reason: the Chinese fallbacks showed on Spanish screens.
- 2026-10-24 · B-9 · `es/brand.ts` never defines a key the harness translates in `es/index.ts` (written into `AGENTS.md` › UI text). Reason: it is spread last and would hide the harness text after H-9.
- 2026-10-25 · H-9 · The repair for free lanes' bare-index tool-call deltas lives in corteo's `/llm` proxy, for `dsh` only, not in the gateway. Reason: the gateway is upstream's plugin at a pinned tag and must not be patched, and every server agent run already goes through `/llm`.
- 2026-10-25 · H-9 · The `dsh` default model is `nvidia/nemotron-3-ultra-550b-a55b:free`, from HW-3 and HW-4, not the plugin's `combo:recommended-free` group and not the two faster lanes. Reason: the group was not among the lanes that returned a correct `split_item`, liquid hit a 429 on the real edit, and the nano reasoning model never called the timeline. Ultra did.
- 2026-10-24 · B-9 · The Spanish pass covers the screens Plan 4 owns, read literally: the projects page with its tooltips, the top bar's button labels, the chat's first view (header, onboarding, starters, composer, workflow and model pickers, capability banner) and the phone upload page. The panels those buttons open stay for P5-1. Reason: the plan's scope line, and P5-1 is the full dictionary.

## Blockers
Add an entry when a task is `blocked`: task ID, the exact command, the error (a few lines), what you tried, and what would unblock it.

- HW-1 to HW-5 · resolved 2026-10-25. An earlier note said WorkBuddy was blocked because `wsl.exe` was on its Program Blacklist and `harness-workbuddy` had no HW commits. It finished the five tasks the same day, and this merge brings them in.

## Harness track · Qoder (HQ)
Only the Qoder agent edits this section, in `~/corteo-qoder` on branch `harness-qoder`. Task cards: `docs/plans/03-deepseek-harness.md` › Qoder track.

| ID | Task | Status | Needs |
|----|------|--------|-------|
| HQ-1 | DeepSeek Harness provider | done | |
| HQ-2 | Every harness model in the Model menu | done | HQ-1 |
| HQ-3 | Only DeepSeek Harness under `OPENCHATCUT_PROVIDERS=off` | done | HQ-1 |
| HQ-4 | Gateway behaviour tests and Spanish errors | done | HQ-1 |
| HQ-5 | Real proof from the chat (needs a running harness) | done | HQ-2, HQ-3, HQ-4 |

### Qoder: decisions
- 2026-10-24 · HQ-3 · The allowlist (`dsh`, `ollama`, `lmstudio`) and the `providersOffEnv` helper live in `shared/providers-off.ts`; `server/plugins/providers-off.ts` re-exports them so P1-1 can extend the blocked-prefix list in the same file without a second middleware. Reason: the server gate and the client UI must not drift apart.
- 2026-10-24 · HQ-3 · `__PROVIDERS_OFF__` is a plain boolean define, separate from `__CONFIGURED_CAPS__` (which feeds the agent capability prompt). It only exists in the Vite dev/browser bundle; tsx and the Electron embedded server define nothing, so there the flag reads `false`. Reason: hiding providers is a deployment policy, not a configured capability.
- 2026-10-24 · HQ-4 · Connection-level failures get an optional `networkMessage` on `ProxyRoute`; only `dsh` supplies one (Spanish, points at `npm run harness`), and every other provider keeps today's `{ "error": "upstream request failed: …" }` body byte for byte. The 502 stays retryable once in `api-retry.ts`, so the Spanish message is what the user sees after the retry. Reason: `ECONNREFUSED` never reaches `llmErrorMessage`, and `npm run harness:doctor` is not needed when the gateway is simply stopped.
- 2026-10-24 · final gate · The first full `npm test` run caught the 500-line gate on two files HQ-1 had pushed over the limit (`server/key-probes.ts` 514, `settingsVendorPane.tsx` 511). The shared fetch plumbing plus the reusable media-vendor probes moved to `server/key-probe-media.ts`, and the field rendering plus test-connection row moved to `src/components/settings/settingsVendorFields.tsx`; `key-probes.ts` re-exports `probeUrlError` and the pane re-exports `FieldCtx`/`FieldRow`/`TestConnectionRow`/`ON`/`WARN` so every import site stays unchanged. Reason: one responsibility per file, public import paths stable.

### Qoder: blockers
- 2026-10-24 · final gate · resolved. `npm test` now passes in full on this machine (199/199 segments) with three environment fixes and no further repo changes: (1) chrome-headless-shell launches with `LD_LIBRARY_PATH=/home/carlos/corteo/.local-libs` (NSS/NSPR libs staged there; `sudo apt-get install -y libnspr4 libnss3` remains the cleaner system fix — `sudo` still needs a password here); (2) there is no system ffmpeg, which `sound-sonilo-job.verify.ts` spawns, so the vendored `ffmpeg-static`/`ffprobe-static` binaries are symlinked into `~/.local/bin`; (3) this GPU-less WSL has no EGL, so Remotion's default `angle-egl` left headless Chrome without WebGL2 (`clipFxExport*.verify` ×2, `video-decoder-render.verify`) — the existing `CC_RENDER_GL` knob in `remotion/render.mjs` fixes it: `CC_RENDER_GL=swangle`. Working invocation: `CC_RENDER_GL=swangle LD_LIBRARY_PATH=/home/carlos/corteo/.local-libs PATH="$HOME/.local/bin:$PATH" npm test`.

### Qoder: HQ-5 results
Model ids, the result of each edit and the latency per message.

Environment (2026-10-24): DSH `@deepseek-ai/dsh@0.2.1-rc.2` installed under `~/.corteo-harness/runtime`, free-model plugin `dsh-our-free-model` tag `v2.5.9` (commit `25ab765`), `dsh web` on `127.0.0.1:3080`, forward gateway `http://127.0.0.1:18899/v1` listing 34 models. Editor on `http://127.0.0.1:5202` in Spanish. The forward key was entered only in Settings; it is not recorded here. `Probar conexión` reported `34 modelos leídos · 3 ms`, `Guardar` persisted it and the model `deepseek-v4.1-flash-free`. Project: `[Copy] Proyecto de Ejemplo` (`d16b751b-6376-4321-a1a1-8cf998ca3f30`), a throwaway copy of the sample (V1: two 3 s clips, 6 s total).

Edits (Claudia asked in Spanish, one message each):
1. Title, `nvidia/nemotron-3.5-lightning:free` — **partly, ≈250 s**. First try with `reflection/beam-free` failed at once with the 429 branch (`El modelo gratuito … está ocupado o se ha quedado sin cuota`, correct Spanish). The retry called `read_timeline`, `ToolSearch`, `search_templates`, `add_motion_graphic` and `create_motion_graphic_from_code`: it added `Black Title - Box Title` to V2 at frames 0–90 (visible 0–3 s), but that template has no editable text and stayed on `WARM LIVING`; the code MG `Title Perú` landed in the media pool and was never put on the timeline. The model then told the user to change the text by hand and misreported the V1 clip lengths. One undo/change-log entry.
2. Cut, `nvidia/nemotron-3.5-lightning:free` — **worked, ≈75 s**. The card's `Corta el primer clip en el segundo 5` cannot apply here (the first clip ends at 3 s), so the message was `Corta el clip Dark Tech en el segundo 4.` `edit_item` changed `seed_2.durationInFrames` 90 → 30: the clip now covers 3–4 s and 4–6 s is empty (a trim, not a split) — verified in IndexedDB. Before it, `poolside/laguna-s-2.1:free` answered that it had cut the clip in ≈25 s **without calling any tool** (Run Inspector: 1 request, 7 tool schemas, no tool outcomes; timeline unchanged). `cohere/north-mini-code:free` and `reflection/beam-free` died on a stream parse error (below).
3. Keyframe, `nvidia/nemotron-3.5-lightning:free` — **worked, ≈40 s**. `edit_item` wrote `keyframes.scale = [{frame 0, value 1}, {frame 89, value 1.19778}]` on the title clip (100 % → 120 % over its three seconds) — verified in IndexedDB; the same run also passed the animation panel.

Second-model attempts for the extra edit (keyframe of opacity 60 % at frame 45): `dots-studio/dots-3-note-preview:free`, `recursive/flint-v1.0:free` and `openrouter/free` all failed with the same stream parse error in under 2 s, so only `nvidia/nemotron-3.5-lightning:free` actually edited. Two-model coverage is therefore only partly met: three free models were picked and asked, one can drive tools.

Other checks: streaming and tool round trip worked throughout (step chips `Thinking` → tool → `Thinking`, context `≈10k / ≈131k`, 7 tools). `Detener` cancels a run after the first tool (≈3 s, no reply, `Reintentar` offered). With `dsh` stopped, the picker shows `DeepSeek Harness no responde. Arráncalo con npm run harness.` and keeps the last models selectable; sending returns the Spanish `connect ECONNREFUSED 127.0.0.1:18899` message after one retry (≈6 s); restarting `dsh` and pressing the refresh control brings back all 34 models and clears the notice.

Finding / follow-up: most free lanes (`openrouter/free`, `reflection/beam-free`, `cohere/north-mini-code:free`, `dots-studio/dots-3-note-preview:free`, `recursive/flint-v1.0:free`) open a tool call with a delta `{"tool_calls":[{"index":0}]}` that has no `function`, and `@ai-sdk/openai-compatible` rejects the whole stream (`invalid_union … delta.tool_calls.0.function`). `nvidia/nemotron-3.5-lightning:free` streams compliant frames. Fix belongs to the gateway (HW) or to a dsh-only SSE normalizer in the proxy; neither is in this track's cards. Other lanes (`deepseek-v4.1-flash-free`, `glm-5.3-flash-free`, `mimo-v2.6-flash-free`, `beam-free`, `big-pickle`, `flint-40b-free`, `jev-1.13-free`, `liquid/…`, `nemotron-3.5-lightning-free`, `xingchen-…`) answered 429 (`Free usage limit reached`) and `opencode/…`, `z-ai/glm-5.3-flash`, `openai/gpt-oss-20b` answered 401 on this key.

---

## Harness track · WorkBuddy (HW)
Only the WorkBuddy agent edits this section, in `~/corteo-workbuddy` on branch `harness-workbuddy`. Task cards: `docs/plans/03-deepseek-harness.md` › WorkBuddy track.

| ID | Task | Status | Needs |
|----|------|--------|-------|
| HW-1 | Pin and install | done | |
| HW-2 | `npm run harness` and `npm run harness:doctor` | done | HW-1 |
| HW-3 | Which free models can edit | done | HW-2 |
| HW-4 | DeepSeek Harness edits corteo over MCP | done | HW-2 |
| HW-5 | Guide for Carlos | done | HW-2, HW-3, HW-4 |

### WorkBuddy: decisions
- 2026-10-25 · HW-1 · `config/harness.json` holds the pins once; `scripts/harness/lib.mjs` reads them, so no script repeats `0.2.1-rc.2`, `v2.5.9` or the commit. The installer refuses the settings rewrite only when a write is needed: a re-run that already finds `distribution: managed` is a no-op even with the harness running. Reason: the harness stays up for hours and must not force a stop just to confirm the pins.
- 2026-10-25 · HW-1 · `0.2.1-rc.2` stays. The manual install from HQ-5 already runs with the plugin, so the `0.1.7-rc.2` fallback is documented but unused.
- 2026-10-25 · HW-2 · "Harness is up" means any HTTP answer on 3080: dsh web answers 401 until its login link is opened, so a status-code check would refuse to start next to a live instance. The doctor finds the forward port the same way it is configured: 401 without the key and 200 with it on each port, which also proves the plugin loaded.
- 2026-10-25 · HW-2 · `npm run harness` omits the MCP patch when no token exists yet, instead of sending `Bearer undefined`; it says why and asks for a restart once corteo created the token. Reason: a broken MCP server in the DSH chat is worse than no server.
- 2026-10-25 · HW-2 · Real run on 2026-10-25: `npm run harness:doctor` passed all five steps against the running harness (34 models, `http://127.0.0.1:18899/v1`, key masked), and `npm run harness` with the instance up reported it and exited 0 without spawning a second one.
- 2026-10-25 · HW-3 · The report ranks only models that returned a schema-valid `split_item` call with the right arguments, then by latency. A 429 is the lane's quota, not a model defect, so those rows stay in the report as "rate limit" instead of being retried; retrying would burn the same shared quota.
- 2026-10-25 · HW-3 · The five tool schemas come from corteo's own `assets/agent/openchatcut-tool-schemas.json`, so a model is judged against what the editor really exposes. One request per model with 300 ms between them; the sweep takes ~4 minutes.
- 2026-10-25 · HW-4 · `--patch` has to be the first app argument. dsh's launcher stops parsing at the first token it does not own, so `web --no-open --host … --port … --patch <file>` hands `--patch` to the web app, which rejects it. The start script now emits `web --patch <file> --no-open …` and the verify pins that order.
- 2026-10-25 · HW-4 · The MCP client uses full tool exposure, not `?toolExposure=progressive`. Progressive's boot set leaves out `list_edit_sessions` and `recover_edit_session`, and ToolSearch cannot activate them, so any session orphaned by a `target_project` rebind or an editor reload wedges the chat on "An edit session is already active" with no way out. Reproduced live; with full exposure the client loaded 103 tools and `list_edit_sessions` answered directly.
- 2026-10-25 · HW-4 · The chat applies edits with `approvalMode: "auto"` and `review_edit_session`; manual mode only publishes a proposal and waits for a click in the editor. The edit session id returned by `begin_edit_session` must be reused for every later call — a `target_project` in between orphans it, so the guide tells the model to bind once and then stay put.
- 2026-10-25 · HW-4 · Real run on 2026-10-25: `npm run harness` bound project `97e6d98d` at `http://localhost:5201`; the dsh chat read the timeline, opened an auto session and applied `split_item` at frame 60; the editor showed V1 as 00:02 + 00:01 (Video2 unchanged at 00:03) and the store recorded proposal `cad8879c` as `applied` with 1 operation.
- 2026-10-25 · HW-5 · The walkthrough in `docs/harness.md` was followed once from a clean `--home /tmp/corteo-harness-clean`: `harness:install` finished and a second run printed "Nada que hacer"; `npm run harness -- --home … --web-port 3081` left the plugin forwarding on 18900 because 18899 was taken by the main instance; `harness:doctor -- --home … --web-port 3081` passed 5/5 and printed `http://127.0.0.1:18900/v1` (34 models). The install has no `--web-port` (it always probes 3080), so the guide says to run it with no harness up.
- 2026-10-25 · HW-5 · Handoff for H-9, checked with a dry-run merge: `git merge-tree --write-tree` of this branch into `cursor/video-editor-mvp-d191` (`dd6e999`, which already carries Qoder's track and `f4b5165`) conflicts only in `AGENTS.md`, `docs/plans/04-claudia-brand.md`, `docs/plans/PROGRESS.md` and `package.json`. The two brand docs are unchanged by HW, so the target's text wins; `package.json` keeps both sides' scripts and our four `scripts/harness/*.verify.mjs` stay at the tail of `test:serial`; PROGRESS keeps both sections. The font-tools blocker above disappears with that merge.

### WorkBuddy: blockers
- HW-5 · `npm test` stops at `src/agent/tools/font-tools.verify.ts:141`: `assert.ok(xmlPrem.includes('ChatCut Export'))` fails because `src/export/fcpxml.ts:416` already names the event `Claudia Export`. The same mismatch is already in the branch base `1fabc26`, and no HW commit touches `src/`, `shared/` or `server/`. The fix is on `github/main` as `f4b5165 B-9: follow the Claudia rename in two verifies`; `src/` belongs to Qoder, so WorkBuddy does not cherry-pick it. Unblock: H-9 merges `github/main` into `harness-workbuddy` (or cherry-picks `f4b5165`); until then `npm test` cannot reach the `test:serial` half. The four harness verifies pass alone under Node 24 (4 + 6 + 6 + 3 scenarios) and `npm run build` passes. Resolved by this merge (2026-10-25): the target already contains `f4b5165`, so the verify expects `Claudia Export`.

### WorkBuddy: model results (HW-3, HW-4)
Sweep of 2026-10-25 22:54Z over all 34 models on `127.0.0.1:18899`, one request each («Corta el clip c1 en el fotograma 120»), schemas from `assets/agent/openchatcut-tool-schemas.json`. Report: `~/.corteo-harness/reports/harness-models-2026-10-24T22-54-13.{json,md}`. Nine lanes answered 200, nine of those returned a valid `split_item` call and eight got the arguments right; nine lanes are quota-exhausted (429), eight need an account key (401) and two no longer exist (404).

| # | Model | Schema | Tool | Args valid | Correct | Latency |
|---|-------|--------|------|------------|---------|---------|
| 1 | `liquid/lfm-2.5-2.6b:free` | yes | `split_item` | yes | yes | 1185 ms |
| 2 | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | yes | `split_item` | yes | yes | 1256 ms |
| 3 | `nvidia/nemotron-3-ultra-550b-a55b:free` | yes | `split_item` | yes | yes | 1769 ms |

Also correct: `nvidia/nemotron-3.5-super-vl:free` (1810 ms), `kilo-auto/free` (2026 ms), `cohere/north-mini-code:free` (2700 ms), `dots-studio/dots-3-note-preview:free` (3555 ms), `nvidia/nemotron-3.5-lightning:free` (6184 ms), `openrouter/free` (8882 ms). Four lanes knew the schema but called `read_timeline` instead of splitting; `stealth/glyph-cluster` emitted no call.

Model used for the HW-4 MCP edit: `nvidia/nemotron-3-ultra-550b-a55b:free` («Kilo Nemotron 3 Ultra», reasoning High) in the dsh chat. It read the timeline, opened an auto session and applied `split_item` at frame 60 of `seed_1` in project `97e6d98d`; the editor then showed V1 as 00:02 + 00:01 and the store marked the proposal `applied` with 1 operation. Two earlier models did not get there: `liquid/lfm-2.5-2.6b:free` hit its lane quota (429) on the first turn, and `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` read «línea de tiempo» as the workspace's task list and opened `PROGRESS.md` instead of the MCP tools.

---

## Brand track · DeepSeek (BD)
Executed by the WorkBuddy agent on 2026-10-24 (the DeepSeek agent was not available). Task cards: `docs/plans/04-claudia-brand.md` › DeepSeek track.

| ID | Task | Status | Needs |
|----|------|--------|-------|
| BD-1 | Brand fonts | done | |
| BD-2 | The Claudia skin | done | BD-1 |
| BD-3 | Marks, favicon and tab | done | BD-2 |
| BD-4 | The projects page | done | BD-3 |

### DeepSeek: decisions
- Both brand faces are self-hosted, because the gallery relies on the system's Helvetica and DIN Condensed and Windows ships neither. The four files match the pinned byte counts exactly.
- `claudia` is `SKINS[0]` and `DEFAULT_SKIN`; `applySkin()` deletes the `data-cc-skin` attribute for the default, so the default is the `:root` block and Graphite became an override.
- The Graphite → Claudia migration runs once per profile behind `cc.skin.claudia`. A Graphite the user picks again afterwards sticks; any other saved skin is left alone.
- The empty library's two buttons are outlined, not clay: the toolbar above already carries the page's one primary button, and the brief allows exactly one.
- `en/brand.ts` and `es/brand.ts` exist so this track never edits `es/index.ts` or the per-module English files; `dictRegistry.ts` spreads the Spanish one over `es.default`.

### DeepSeek: blockers
None.

### DeepSeek: review
- AI-tells pass on the projects page: no gradients, glows or glass; clay only on the wordmark streak, the star, one primary button and focus; no kicker; no arrows; no card kit; no dashed "+" tile; motion is colour and opacity only, ≤120 ms, off under reduced motion; targets 30 px.
- Screenshots were not taken: the dev server needs WSL, which was unavailable (`wsl.exe` blocked by the sandbox). `test-results/brand/` is empty.
- B-9 took them on Linux on 2026-10-24. The page passed the list except for the card: the hidden action buttons squeezed the name to "Exampl…" at 1440 px and hid it at 390 px, and the times were English ("11 hr ago"). Both are fixed (B-9 card).

---

## Brand track · Qoder (BQ)
Executed by the WorkBuddy agent on 2026-10-24 (the Qoder agent was not available). Task cards: `docs/plans/04-claudia-brand.md` › Qoder track.

| ID | Task | Status | Needs |
|----|------|--------|-------|
| BQ-1 | The old name out of the text | done | |
| BQ-2 | The fork's links and the assistant's identity | done | |
| BQ-3 | The chat panel | done | BD-3 |
| BQ-4 | Cleanups and the review | done | BQ-3 |

### Qoder (brand): decisions
- The dictionary sweep changed 40 lines and kept the 10 lines of the five desktop-updater keys, which name upstream's release on purpose.
- `src/export/fcpxml.ts` writes "Claudia Timeline" and "Claudia Export"/"Claudia Export (Resolve)"; CapCut drafts default to `Claudia-<date>`.
- Chat expand/collapse became the generic 展开助手/收起助手 ("Mostrar asistente"), since the panel is the editor's assistant, not the artist.
- Nine chat-panel strings had no Spanish entry and fell back to English; they now have one in `es/brand.ts`.
- `src/brand/brand-text.verify.ts` reads string literals, not raw lines, so the old name may still appear in comments, header constants, URL literals and the bundled agent skill docs. Getting that right needed a scanner with comment and regex states: a single apostrophe in a comment (`// don't`) or a regex holding a quote (`/'/g`) otherwise swallows the rest of the file, and the gate silently passes on nothing.
- The FCPXML `backgroundFill` warning is a literal that ships inside the exported file, so it says "Claudia metadata" too; `fcpxml-background-fill.verify.ts` moved with it.
- `.cc-chat-starter-copy` stayed: the presets still render a title over a description. Only the kicker, the icon tile and the arrow went, with the reduced-motion block that existed solely for the last two.
- BQ-2's second half landed after its first: `mcp-instructions.ts` now opens with "In its UI this editor is called Claudia; tool names keep the openchatcut_ prefix", and the four `mcp-controls.ts` tool descriptions and the four `mcp-binding.ts` errors say Claudia. `product-help/SKILL.md` renamed its title and description only; its body still quotes upstream feature names, which the plan leaves alone.
- The gate now also covers those six identity files and `product-help/SKILL.md`, so BQ-2 cannot silently regress.

### Qoder (brand): blockers
- `npm test` and `npm run build` need WSL, which this sandbox refuses (`wsl.exe` on the Program Blacklist; re-checked 2026-10-25 00:00). Git itself works over the UNC path, so the commits below are real: `1ddc7bd` (BD), `f179f63` (BQ), `01bbb02` (B-0), `1fabc26` (the PROGRESS entry). The work was verified over UNC instead: `tsc` on both projects, `check-i18n`, and the affected verifies, run individually.
- `scripts/verify-registration.verify.mjs` fails until the six new verify files are committed: it compares `package.json` against `git ls-files`, and untracked files read as "registered but not tracked". `scripts/verify-gate-coverage.verify.mjs` already passes (636 verify files, all reachable).
- `vite build` was attempted on Windows and cannot work from the UNC path: the win32 `@rolldown/binding` and `lightningcss` binaries load, but rolldown's native resolver fails on `\\wsl.localhost\...` ("Failed to resolve entry for package @vitejs/plugin-react"), and the share cannot be mapped to a drive (`net use` → system error 64). The client bundle stays unbuilt until WSL is back.
- Resolved by B-9 on 2026-10-24, on Linux: `npx tsc -b` passes (the 87 "SDK-drift" errors seen on the node project over UNC don't reproduce), `scripts/verify-registration.verify.mjs` passes now that the files are committed, and `npm test` and `npm run build` ran (results under "State at handoff"). `wsl.exe` is still blocked for the WorkBuddy agent, which also blocks its HW tasks.

### Qoder (brand): review
- Still open from BQ-4: the visual review of the top bar, chat and the dialogs they open against the AI-tells list, and the screenshots, both for the same WSL reason.
- B-9 did that review on Linux on 2026-10-24 and fixed what it found (B-9 card): sparkles on the top bar and in the composer, the proposal card's icon tile, English on the composer and the capability banner, and the phone upload page. Recorded, not fixed:
  - The workflow picker (`WorkflowPickerContent.tsx`, `.cc-creative-mode-icon`, `.cc-creative-picker-head > span`) still shows icon tiles, with a sparkles icon in its header. It is a popover the composer opens; removing the tiles is a layout change for a later task.
  - The editor has no phone layout upstream: at 390 px the chat is a column about 95 px wide. The plan only asks for the projects page to work at 390 px.
  - The panels the top bar and the chat open (generation tasks, export history, run inspector, settings) are still mostly English: P5-1.
- Known remainder, deliberately out of scope: the old name still appears in `src/agent/skills/**/SKILL.md`, in `X-OpenChatCut-*` header constants, in `assets/agent/openchatcut-tool-schemas.json` and in the agent tool descriptions in `src/agent/external-tool-shape.ts`. Those are identifiers and agent-facing contract text, not product copy; renaming the headers or the schema path would break the desktop and MCP bridges.

---

## Opus parity track (OP)
Plan: `docs/plans/05-opus-parity.md` (written 2026-10-25, not started). Its task cards are in that file.
This track is deliberately **not** in the main table, so the picking rule above never returns it: take an OP task only when the user asks for Opus-parity work.

| ID | Task | Status | Needs |
|----|------|--------|-------|
| OP-01 | `score_moments`: rubric engine | done | |
| OP-02 | `find_highlights` ranks, snaps, dedupes | done | OP-01 |
| OP-03 | `make_shorts`: source in, clips out | done | OP-02 |
| OP-04 | Calibration ledger | done | OP-01 |
| OP-05 | "Analizar episodio" panel | todo | OP-03 |
| OP-06 | `tighten_speech` | done | |
| OP-07 | `censor_words` | todo | |
| OP-08 | Shorts caption presets, keywords, line breaking | todo | |
| OP-09 | `write_clip_title` | todo | |
| OP-10 | Brand kit | todo | |
| OP-11 | Reframe polish: dead zone and cheap modes | todo | |
| OP-12 | `write_social_copy` | done | |
| OP-13 | Scheduled publish | todo | OP-12 |
| OP-14 | `search_catalog` (semantic) | optional | |
| OP-15 | Performance loop | optional | OP-13 |

### Opus parity: decisions
- Trend is absent from the score (`trend: null`): there is no local trend feed, and a fabricated dimension would be worse than a missing one.
- Chapters before candidates: segment by transcript topic shift crossed with `detect_scenes`, then score inside each chapter.
- Forking is off the table for all sixteen reviewed projects (Python-first or non-OSI licences); nine MIT artefacts are ported instead, listed in the plan, section 5.2.

**OP-01 (done 2026-10-25).** `score_moments` shipped as a read-only tool: 123 → 124 tools.
- `src/agent/shorts/` holds the engine (`chapters`, `candidates`, `signals`, `rubric`, `score`, `types`, `transcript-item`); `src/agent/tools/shorts-tools.ts` is the tool. Verifies: `src/agent/shorts/rubric.verify.ts` and `src/agent/tools/shorts-tools.verify.ts`, both in `test:serial`.
- The score is 0-99 over Hook / Flow / Value / Sound. `sound` replaces Opus's Trend: there is no trend feed, and the model never scores delivery because it cannot hear it. Measured signals are 60 %, the model 40 %, and with no provider the measured score still ranks.
- The candidate contract is word indices, not timestamps: a verdict that does not match a candidate's own indices is dropped, so a drifting model cannot move a cut.
- `genre` replaces ClipAnything's visual profile. There is no local vision model at runtime, and pretending to multimodal analysis would be dishonest; scene alignment stays for a later task.
- Chapters merge below 8 s, so a short source is one chapter and the candidates are then split by `maxSeconds`.
- UI lands in OP-05: OP-01 is agent-only on purpose, and the plan says so.

**OP-02 (done 2026-10-25).** `find_highlights` ranks and filters with the same score, inline.
- `src/agent/shorts/score-ranges.ts` scores already-chosen word ranges (same 60/40 blend, **no gates**: the caller chose the spans, so a gate must not silently shrink the batch). Verify: `src/agent/shorts/score-ranges.verify.ts`.
- New args: `minScore` (0-99, default 0, so existing callers are unchanged), `score` (default true; false skips the model for a fast cut) and `genre`. Every short now carries `score`, `subscores`, `reason` and `risks`; dropped moments come back in `rejected[]` with `por debajo de minScore N`, and `scoreModel` says whether the model was used.
- Selection still decides the spans; scoring only ranks and filters. `highlight-tool.verify.ts` keeps its original assertions and adds score/sub-score checks plus a `minScore: 99` case that produces zero sequences and two reported rejections.
- Cost: one extra model call per `find_highlights` when scoring is on (`score:false` opts out).

**OP-03 (done 2026-10-25).** `make_shorts`: one call from a transcribed source to finished clips. 124 → 125 tools.
- The analysis was extracted to `src/agent/shorts/analyze.ts`, and both `score_moments` and `make_shorts` call it. That was the point of the card: the pipeline may compose, it may not re-implement.
- Composition only: `assembleShorts` (the `find_highlights` cut path), `edit_captions` (`action=enable`, then optional `motionPreset`), `auto_reframe`, `submit_render_job`. Nothing new renders, crops or paginates captions.
- Args: `count`, `minSeconds`/`maxSeconds`, `ratio`, `minScore` (default 55), `direction`, `topic`, `genre`, `captionsPreset`, `captionMotion`, `reframe` (default true), `render` (`none` | `previews`).
- Returns per clip: `sequenceId`, `startFrame`/`endFrame`, `seconds`, `score`, `subscores`, `reason`, `risks`, `captions` (`applied`/`failed`/`skipped`), `reframe` (`applied`/`skipped`), and `renderId` when a preview was queued; plus `alternates`, `belowThreshold` and the rejected list.
- **Deviation from the card, recorded:** there is no new `analysisId` job store. Each clip's render is an existing render job, polled with `track_export`; inventing a second job system would have duplicated the queue, the recovery and the UI. The clip-level work is synchronous, which is honest for 5–10 clips.
- Degradation: no DOM → `reframe: 'skipped'` and a Spanish note; a caption failure never fails the run; `minScore` above every score returns `count: 0` with a note and creates nothing.
- Verify: `src/agent/tools/make-shorts-tools.verify.ts` covers the happy path, reframe-without-DOM, captions on, the below-threshold path and the two error paths.

**OP-04 (done 2026-10-25).** Calibration from the user's own approve/reject decisions. 125 → 126 tools.
- `src/agent/shorts/calibration.ts`: ledger, `recordDecision` (one row per span, newest wins, capped at 500), `computeCalibration` (weights, suggested `minScore`, confidence) and `clearDecisions`. Verify: `src/agent/shorts/calibration.verify.ts`.
- The math is deliberately small and honest: under 12 decisions, or with fewer than 5 on either side, the weights are identity and the note says so. Above that, a dimension that separates approved from rejected moments gains weight through `tanh(gap/20)`, capped 0.6–1.6, renormalised to sum 4 so the 0–99 scale means the same thing. `composite()` takes the multipliers; identity reproduces the unweighted score exactly, which the verify asserts.
- `score_moments` and `make_shorts` accept `calibration: true` (default false) and pass the weights through `analyzeMoments` → `rankMoments`; `score_moments` reports which calibration it used.
- New read-only tool `calibrate_scores` returns decisions, weights, suggested `minScore` and whether it is applied.
- **Decision, recorded:** the ledger lives in the browser profile (the same place caption presets live), not in SQLite. The editor is single-user and local, and a server table for twelve numbers would be infrastructure without a reason. OP-05 is what writes real decisions into it.
- Not done here on purpose: nothing in the UI records approvals yet, so in a fresh profile `calibrate_scores` reports 0 decisions — true, not a stub.

**OP-06 (done 2026-10-25).** `tighten_speech`: review-first speech cleanup. 126 → 127 tools.
- The card assumed there was no filler pass; there is. `clean_script` already removes fillers and compresses pauses in one undoable batch, so this is **not** a second engine: `src/agent/shorts/tighten.ts` previews with a Spanish-first matcher (fillers, two-word fillers like "o sea", false starts, pauses over the cap) and the tool delegates the actual edit to `clean_script`. That was the only honest way to keep one filler implementation in the repo.
- Two steps always: the first call lists what would go (word, time, reason, pause length, seconds recovered) and edits nothing; `apply:true` does it after the user approves. The verify asserts the timeline is byte-identical after a preview.
- Args: `itemId`, `apply`, `minPauseMs` (default 400, matching Opus), `extraFillers`, `cutPadMs`.
- **Deviation, recorded:** the card's "Apretar el habla" switch in the clip panel is not built. OP-05's panel is the one UI surface for this phase, and it will host tighten's preview/apply pair; until then the operation is agent-only. Tracked in the OP-05 card.
- Verifies: `src/agent/shorts/tighten.verify.ts` (matcher) and `src/agent/tools/tighten-tools.verify.ts` (preview → untouched, apply → `clean_script` result passed through).

**OP-12 (done 2026-10-25).** `write_social_copy`: per-platform title, description and hashtags. 127 → 128 tools.
- `src/agent/shorts/social-copy.ts` holds one limits table for the nine platforms publish already supports (YouTube 100/5000, X 280/280, Instagram and TikTok 2200, …), a word-boundary clamp, hashtag hygiene (strip `#`, drop duplicates and junk, per-platform cap) and a fallback that uses the clip's opening sentence when there is no model. Verify: `src/agent/shorts/social-copy.verify.ts`, which walks every platform with an oversized input and asserts all three limits.
- Tool `write_social_copy` reads a word range from a transcribed clip (clamped, never fatal), defaults to tiktok/instagram/youtube, rejects unknown platforms with the valid list, and returns `modelUsed` so nobody mistakes a fallback for generated copy.
- **Deviation, recorded:** nothing is stored on the sequence. `publish_to_social` already takes `title` and `description`, so the copy is passed straight into it; a second stored copy would drift the moment the clip changes. The publish dialog prefill is a UI follow-up, not a data model.
- Read-only, so it never needs approval: it only writes text into the reply.


### Opus parity: blockers
- **Untracked leftovers from the Plan 2 session break the gates.** `src/agent/skills/escuchar-cancion/` (untracked) makes `npm run verify:agent-tools` fail at `skills-catalog.verify` ("内置技能全部在册,无多无少", actual list contains `escuchar-cancion`), and untracked `src/editor/musicReactions.ts`, `src/components/inspector/MusicReactionControls.tsx` and `src/agent/tools/music-reaction-tools.ts` make `npx tsc -b` report 28 errors (`MusicReactionRecord` is not exported, `musicReactions` is not on `TimelineItem`, `setMusicReactions` is not a command). They are not this track's files.
  - Worked around, not fixed: `mv src/agent/skills/escuchar-cancion /tmp/leftover-escuchar-cancion`, run the gates, `mv` it back. With it moved aside, `verify:agent-tools` and `verify:mcp` both exit 0, and `npx tsc -b` reports no error in any Plan 5 file.
  - Unblocked by committing or deleting that WIP, or by the Plan 2 session finishing it.
