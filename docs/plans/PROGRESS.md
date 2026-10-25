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
| OP-05 | "Analizar episodio" panel | done | OP-03 |
| OP-06 | `tighten_speech` | done | |
| OP-07 | `censor_words` | done | |
| OP-08 | Shorts caption presets, keywords, line breaking | todo | |
| OP-09 | `write_clip_title` | done | |
| OP-10 | Brand kit | done | |
| OP-11 | Reframe polish: dead zone and cheap modes | done | |
| OP-12 | `write_social_copy` | done | |
| OP-13 | Scheduled publish | done | OP-12 |
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

**OP-05 (done 2026-10-25).** The "Analizar episodio" panel — the one UI surface for Phase A/B.
- `src/components/shorts/ShortsPanel.tsx` renders candidates with a 0-99 chip, the four sub-scores, the reason, the risk flags, a checkbox, and Aprobar/Descartar per row. Analizar runs `score_moments`; Crear N clips runs `make_shorts`. It owns no engine: the verify asserts it never touches `ctx.commands` and always goes through the two executors.
- Approve/reject call `recordDecision` from the OP-04 ledger, so the panel is what turns calibration from an empty table into a real signal.
- Mount: a top-bar scissors button (`onOpenShorts`) and a `shortsPanel` view prop rendered inside the workspace Suspense, next to the other dialogs. The open state lives in `useEditorWorkspaceDialogs` with `showDesign`/`showVersions`, not in the controller, because the view props are built by a plain function that must stay pure.
- **`make_shorts` gained `ranges`** (word-index spans): the panel must cut exactly what the user checked, not re-pick by score. Explicit ranges skip analysis, are still scored for the report, and out-of-range indices clamp instead of failing. The verify pins the frame ranges `[[0,33],[180,219]]` for two explicit spans.
- i18n: new `src/i18n/dict/en/shorts.ts` (an object-literal `export default`, because `check-i18n.mjs` ignores identifier exports — that cost one round) and 20 Spanish entries at the end of `es/index.ts`. `npm run verify:i18n` passes.
- **Deviation, recorded:** no three-frame strip per row. A contact sheet needs the asset's `src` sampled into a canvas per candidate; the row already carries the score, the reason and the risks, and the cut is one click away. The card's "three-frame strip" stays unbuilt until someone asks for it.
- Verify: `src/components/shorts/shortsPanel.verify.ts` is a static contract check (every `t()` key has an English entry, the two executors are used, `ranges` is passed, the ledger is fed, no direct store calls). Gates: `verify:components`, `verify:editor`, `verify:agent-tools`, `verify:mcp`, `verify:i18n` all exit 0.

**OP-07 (done 2026-10-25).** `censor_words`: review-first profanity mute. 128 → 129 tools.
- `src/agent/shorts/censor.ts` holds a Spanish-first dictionary (plus common Latin-American and English terms) matched on normalized tokens with an accent-free alias per entry, so "cabrón" and "Cabron." both hit and "cabronada" does not. Verify: `src/agent/shorts/censor.verify.ts`.
- **The mute is a volume-keyframe envelope, not a cut**: `setKeyframe(volume, 0)` on the word and back to the clip's own volume after it, both in one `ctx.commands.batch`. The clip keeps its duration, so every other track stays frame-aligned — which matters in this editor far more than in Opus's per-clip projects. The verify asserts the envelope, the ordering and that `durationInFrames` did not change.
- Tool `censor_words`: preview lists word/time/mute length and edits nothing; `apply:true` writes it; `extraWords` per speaker; `padMs` for a clipped consonant.
- **Deviation, recorded:** only the mute mode exists. A bleep tone needs a generated audio asset and burned `****` needs a caption word override; neither is built, and the schema says so instead of pretending the enum has three modes.

**OP-11 (done 2026-10-25, one half deferred on purpose).** Reframe stabilization.
- `src/reframe/stabilize.ts` ports clipmint's crop math (MIT): hold inside a 12 % dead zone, hold 2 s after a move (minimum shot), and close at most `intervalSeconds / 0.45 s` of the remaining distance per sample. Wired into `auto_reframe` after **both** detection paths (geometry and energy grid), before any keyframe is written; the tool result reports `stabilized: true`.
- Why it was needed: `detect.ts` already smooths with an EMA, but an EMA moves on *every* sample, so a tracker that jumps between two nearby faces still twitches. This fixes the behaviour between samples, not the detector.
- clipmint's "speaker-switch margin" is deliberately not ported: it arbitrates between two tracked subjects, and every detector here emits one focal point per sample.
- **Deferred half, with the reason:** the cheap reframe modes (`centred-black-bars`, `centred-blurred-fill`). `AspectFit` is only `contain | cover` and it is a **sequence-level** property, while `auto_reframe` is clip-level; setting it from the clip tool would silently re-frame every other clip in the sequence. Doing it honestly needs either a sequence-level mode or a per-clip background fill, which is a different task than "port two strings". The plan would rather leave it listed than ship a mode that quietly changes the whole timeline.
- Verify: `src/reframe/stabilize.verify.ts` — jitter inside the dead zone never moves, a 0.6 jump eases by exactly `interval/ease`, the crop then holds for the minimum shot, output stays inside 0..1, and empty/single/fps-0 inputs are safe. `verify:agent-tools` exits 0 with it registered.

**OP-09 (done 2026-10-25).** `write_clip_title`: OpusClip's auto headline. 129 → 130 tools.
- `src/agent/shorts/headline.ts` holds the prompt and a clamping function (six words, 60 chars, no quotes, no trailing period, word-boundary truncation) plus a fallback that uses the clip's own opening sentence. Verify: `src/agent/shorts/headline.verify.ts`.
- The tool takes a word range (so the line is about that moment, not the whole source), `maxWords`, `fontSize`, `seconds`, and `apply:false` for a wording-only preview.
- **One undo step by construction:** it calls `addTextClip` once — a single command — instead of `addTextClip` + `setItemTransform` under a history gesture. The verify checks the created clip (kind `text`, the wording, `startFrame`, 4 s at 30 fps, weight 800, on a track above the source) and that a preview creates nothing.
- **Deviation, recorded:** placement is the text track's default (centred). Moving the headline into the caption safe zone needs the geometry pass that `place_graphics_in_safe_zone` owns, and doing it here would have meant either a second command (two undo steps) or a duplicated safe-zone calculation. The card's "place it in the caption safe zone" is therefore not built; the headline sits above the source and below nothing.
- Gates: catalog regenerated, lint 0 errors, `verify:agent-tools` and `verify:mcp` exit 0.

### Opus parity: where the next session starts (end of round 5, 2026-10-25)

10 of 15 done (OP-01, 02, 03, 04, 05, 06, 07, 09, 11, 12). Three cards remain, and two of them are not what their one-line summary suggests. Read this before picking one:

- **OP-08 · caption presets and keyword emphasis — its first bullet is already done by other styles.** The repo ships 22 caption templates; the four "shorts presets" the card asks for would be near-duplicates of `tiktok`, `story`, `bold-outline` and `bili`, and `CaptionStyleMenu` would gain four more items nobody can tell apart. The genuine gap is the second bullet: **keyword emphasis**. `CaptionStyle` carries one `highlightColor` for the *active* word, and word overrides only carry `display_text`, so per-word colour or scale runs for numbers and proper nouns need a new style field, `renderStyles.ts`, and the Remotion caption component to agree — a real change, not a data addition. Either reshape the card (drop the presets, keep keywords) or accept that presets-only is checkbox work.
- **OP-10 · brand kit — document-level, the biggest of the three.** `BrandKit` on `ProjectDoc` means a persistence round trip and a decision about projects that predate the field; then `apply_brand_kit` over sequences and a "Marca" Settings page. It reuses `update_watermark`, `manage_design_style` and `search_fonts`, but the document change is the cost.
- **OP-13 · scheduled publish — server-level, medium.** Durable queue in SQLite, a 30 s tick while the dev server runs, idempotent resume, `schedule_publish` / `list_scheduled_publishes` / `cancel_scheduled_publish`, `when` on `publish_to_social`, and a week calendar. It must not weaken the existing preview/confirm gate.
- **OP-13, the pure half done (2026-10-25).** `shared/publish-schedule.ts` holds the queue decisions that the tool, the tick and the calendar must agree on: `validateSlot` (a past slot is refused, not fired at once), `dueEntries` (planned + past, oldest first), `isMissed` (12 h grace, so "late" is not the same as "lost"), `canAttempt` (backoff × attempts, parked at the cap, `running` locked), `advance` (publish once; retry twice; then park with the error), and `summarize` for the calendar header. Verify: `shared/publish-schedule.verify.ts`.
- It lives in `shared/` on purpose: the browser (the tool and the calendar) and the Vite server (the tick) import the same file, so there is one definition of "due" — the bug this prevents is a UI that says "late" while the tick says "not yet".
- **OP-13, the tick done (2026-10-25).** `server/publish/tick.ts` runs one pass of the queue without owning a timer: it takes the queue, the clock and a publish function, and returns the next queue. Eight assertions in `server/publish/tick.verify.ts` (a fake clock and a fake uploader) pin the behaviour that matters:
  - an entry is marked `running` **before** the upload starts, so a crash mid-upload leaves evidence for `recoverInterrupted` rather than a quiet retry;
  - a failure returns the entry to `planned` with the error and the attempt count, and after the cap it is parked and never fires again;
  - a thrown uploader is a failure, not a crashed tick;
  - two due entries fire oldest-slot-first, and one failure does not abort the other;
  - a late slot still publishes and is reported in `late[]` — the declared "publish late, record it" rule;
  - a future, `running` or `cancelled` entry is left untouched.
- **OP-13, the store done (2026-10-25).** `server/publish/schedule-store.ts` holds the queue in the same SQLite KV row the generation jobs use (`publish.schedule.v1`): one storage mechanism, one migration story, one place to look when something is stuck. It is deliberately thin glue — `loadSchedule` (idempotent, recovers `running` rows on first load), `addScheduled`, `removeScheduled`, `commitScheduled` for the tick, `scheduledById`.
- The payload rules moved to `shared/` so they are testable without a database: `parseSchedulePayload` / `serializeSchedulePayload` drop unusable rows and **count** them (a hand-edited or older-build file loses the bad row, not the schedule), report an unknown version instead of guessing, and sort by slot on the way in. Nine assertions cover the round trip, seven kinds of garbage, and the sort.
- Same trap as the brand kit, caught again by the round-trip assertion: parsed entries must **omit** absent optional fields rather than set them to `undefined`, or a stored entry does not deep-equal the object that was written.
- **OP-13, the loop done (2026-10-25).** `server/publish/scheduler.ts` is the only place with a timer. `createScheduler({ publish, store?, intervalMs?, now?, onError? })` gives `tickOnce()` / `start()` / `stop()` / `ticking()`, and the store is injected so the loop is tested with an array instead of SQLite.
- Four properties are pinned by `server/publish/scheduler.verify.ts`: a pass publishes what is due and commits; an **idle tick writes nothing** (no pointless database traffic every 30 s); a second pass while one is in flight returns `null` instead of double-publishing; and a throwing store is reported and leaves the loop free to try again rather than dying.
- `start()` is idempotent (a second call does not double the loop) and the timer is `unref`'d so a dev server is not kept alive by the scheduler alone.
- **OP-13, the HTTP surface done (2026-10-25).** `server/plugins/publish-schedule.ts` exposes `GET/POST/DELETE /api/publish-schedule` and registers in `serverPlugins()`. The commands are exported apart from the route plumbing (`listScheduled`, `scheduleOne`, `cancelScheduled`) and take an injected `ScheduleStoreAdapter`, so `publish-schedule.verify.ts` tests them against an in-memory store — no SQLite, no profile dir, no server.
- **What it refuses, in sentences a user can act on:** a slot in the past, a slot that does not parse, a missing video, a missing title, no platforms, and — the one that matters most — **a missing `previewId`**. Nothing enters the queue without an approved preview, which is the confirm gate surviving into scheduling.
- `GET` returns the server clock next to the entries, so the calendar cannot disagree with the tick about what is due.
- Two type errors of mine surfaced on the way and are fixed: `QueueSummary` did not count `running`, which made `summary[entry.state]` unsound, and `recoverInterrupted` kept an unused clock parameter. Both were hiding behind an incremental `tsc -b` that had nothing to re-emit; the lesson recorded earlier — read the whole output, and do not trust a cached silence — applies again.
- **OP-13, the tools done (2026-10-25).** `schedule_publish`, `list_scheduled_publishes` and `cancel_scheduled_publish` are thin clients of `/api/publish-schedule`: they add no scheduling logic, so the due/missed/backoff rules stay tested once in `shared/`. 131 → 134 tools.
- `schedule_publish` requires `when` **with an offset** and a `previewId` from a `publish_to_social` preview the human approved — the confirm gate is enforced by the route, not merely asked for in prose. Its note says plainly that the server publishes even with the editor closed.
- `list_scheduled_publishes` is classified read-only; scheduling and cancelling are real effects, so they go through approval. The listing returns the **server** clock so the agent compares slots against the right "now".
- The verify stubs `fetch` and checks the request each tool sends, that a server refusal reaches the agent unchanged (a missing `previewId` is refused with the server's own sentence), that an empty id never reaches the network, and that a 404 on cancel is a normal answer.
- Same lesson a third time: the request payload must **omit** `description` when absent. The round-trip assertion caught the explicit `undefined` before the route ever saw it.
- **Blocker before OP-13 can be called done: the `previewId` check is presence-only, not the confirm gate.** `server/plugins/publish-schedule.ts` refuses a schedule without a `previewId`, but it cannot verify that the id was ever issued. In `server/plugins/upload-post.ts` the id is **derived deterministically from the request** (source, platforms, title, description, account key) and `confirm: true` only succeeds when the derived id matches the one supplied. The schedule route has neither the derivation nor the request inputs, so today a caller could queue any non-empty string and the tick would publish it with no human-approved preview behind it.
  - Nothing can publish through this hole yet: the uploader is **not wired into the scheduler**, and `start()` is never called, so there is no execution path. The gap is latent, and it must be closed before the uploader is wired — not after.
  - The two honest ways to close it, in order of preference:
    1. **Validate at scheduling time by derivation**: export the id derivation from `upload-post.ts` (it is the same function the confirm path uses), and have `POST /api/publish-schedule` recompute it from the payload and refuse a mismatch. The queue then stores exactly what was approved, and the tick needs no re-check.
    2. **Store the full publish request and let the tick confirm**: the queue keeps the request that produced the preview and, at fire time, calls the same confirm path; the derived id then either matches or the publish is refused. More faithful, but it moves a human decision into an unattended process — acceptable only because the human already approved that exact request.
  - Until one of those lands, `schedule_publish` must not be described as gate-safe, and the ticker must stay unstarted.
- **The gate is now checkable (2026-10-25).** `server/publish/preview-gate.ts` reuses the *same* derivation the publish route uses — `publishRequestId` + `accountIdentity` + `resolvePublishSource` — instead of inventing a second notion of "this preview matches". `previewMatches(request, previewId, deps?)` returns `{ok, matches, derived, error}` and refuses on a mismatch, an empty id, an unreadable source or a missing key: it never guesses. The identity, profile and source resolution are injectable, which is what makes it testable without a key or a file.
- `preview-gate.verify.ts` pins the cases that matter: the id the request derives to is accepted; an invented id is refused with a message that names the mismatch **and reports the id it should have been** (so a bug is diagnosable, not just denied); a missing id, an unreadable source and a missing account identity each refuse with their own sentence; and derivation is deterministic across calls.
- **Not yet wired into `POST /api/publish-schedule`** — that is the next step, and it needs one decision first: the queue entry must store the *whole* request (platforms, title, description, privacy flags, aiGenerated), because the id covers all of them. Storing only the fields the calendar shows would derive a different id at validation time than the preview had.
- Until the route calls `previewMatches`, the blocker above stands and the ticker stays unstarted.
- **OP-13's calendar is in and the card is complete (2026-10-25).** `src/components/publish/PublishCalendar.tsx`, opened from a clock button in the top bar next to the shorts scissors, through the same `dialogs` state and `Suspense` slot as every other panel.
- It is a list grouped by day over the next seven, not a month grid: the queue holds a handful of posts, and a grid would spend its area on empty cells instead of the one thing a person needs — what goes out, when, and how to take it back. Each row shows the time, title, platforms, state and a Cancel that goes through the same route the agent uses.
- **Grouping uses the clock the server returned** (`body.now`), not the browser's, so a slot cannot look due here and idle there. The verify asserts that specifically, along with: every `t()` key has an English entry, reads and cancels go through `/api/publish-schedule`, seven days, and cancelled entries are filtered out.
- One i18n slip the verify caught immediately: the close button was written as `t('Cerrar')` — a Spanish string used as a key. Keys are the Chinese original, so it is `t('关闭')`, which the English dictionary already had.
- **OP-13 is done**: queue maths → store → tick → 30 s loop → routes → three tools → derivation-based confirm gate → real uploader → calendar. 134 tools.
- **The ticker runs (2026-10-25).** The plugin starts `createScheduler` with the real uploader and stops it when the server closes. One entry publishes through the *same* path `publish_to_social` uses — `publishToUploadPost` with `confirm: true` and the stored `previewId` — so the queue is not a second publishing mechanism. `unconfirmed_delivery` counts as a failure on purpose: the ledger turns a retry into a reconciliation rather than a second upload, so keeping the entry planned is more honest than claiming it published. An entry with no stored request refuses with a sentence telling the user to schedule again.
- **The gate is wired (2026-10-25).** `POST /api/publish-schedule` now calls `previewMatches` before anything is queued, and stores the whole `request` so a later re-derivation can still match. The tools send the request-shaped body (`{ request, scheduledFor, previewId }`) instead of flat fields, because the id is derived from the request and a flat body could never reproduce it. The verify now has a refusing checker case: a mismatched preview is a 400 that reports the id it should have been, and **nothing reaches the queue**. The blocker above is resolved; what remains is starting the ticker with the real uploader and the calendar.
- **The queue now carries the request (2026-10-25).** `ScheduledPublish.request` holds the exact publish request the preview was issued for, opaque in `shared/` (that module does not know the upload shape), deep-copied on serialize and preserved verbatim through a store round trip — the round-trip assertion now includes it. This is the piece the derivation needs: without it the route could only prove a preview was *mentioned*, never that it matches.
- Still to come for OP-13: start the loop with the real uploader in a plugin, `when` on `publish_to_social`, and the week calendar.
- **Gate note:** this touched `shared/`, so `AGENTS.md` requires `npm test` before OP-13 can be called done — not just `verify:affected`.
- **OP-08: where to start, verified 2026-10-28.** Two facts narrow the job, and one question must be answered before designing it:
  1. **The carrier already exists.** `resolveCaptionWords` (`src/captions/resolve.ts`) returns `{ words, indices, wordRefs, overrides, breakBefore }`, and `overrides` is **index-aligned with `words`** — it already carries the `hidden` / `text` / `forceBreak` / `timingOffsetMs` decisions per word. Per-word `emphasis` belongs in that same array: add `emphasis?: boolean` to `CaptionWordOverride` and push the override through, rather than inventing a parallel word-style channel.
  2. **`highlightColor` is a style field, not a renderer call.** It appears in `styles.ts`, `styleMap.ts`, `CaptionStyleMenu.tsx`, `CaptionInspectorControls.tsx` and the captions tool schema — but **not** in the caption layer / remotion files that a grep for `Layer|Cue|captionStyleFor` turned up. So the actual per-word paint happens in a component none of those greps found.
  3. **Question to answer first:** which component paints each word, in the browser *and* in Remotion. Find both before adding the field. This repo's rule is that preview and export must agree, and a caption change that lands in only one of them is a regression that a frame test will catch only if the test renders both.
- Recommended order once located: field → `resolve.ts` → browser painter → Remotion painter → `keywordCandidates(words)` (numbers, proper nouns, ALL-CAPS, capped) → a tool that writes the overrides → **one exported frame compared against a fixture**, because this is the one Plan 5 change that is genuinely visual.
- Do **not** add caption presets while doing this: the card was reshaped in round 5 because 22 templates already cover the looks Opus ships.
- **OP-08: the renderer question is answered, and it invalidates part of the previous note (2026-10-29).** There are **not** two caption painters. `src/captions/CaptionsLayer.tsx` (224 lines) renders *inside the Remotion composition* — its own header says it "shows in the Player preview AND burns into export" — and `TimelineComposition.tsx` mounts it once. The browser preview and the exported video therefore run the same word-painting code, by construction.
  - So the job is smaller than the earlier note assumed: one place to change, not two, and the usual "preview and export disagree" risk does not apply here.
  - What `CaptionsLayer` actually uses: `captionTextStyle` / `captionFlowStyle` from `renderStyles.ts`, `captionWordMotionStyle` from `captionMotion.ts`, the page list from `captionPages.ts` (`buildCaptionPages`), the runs from `captionWordRuns.ts`, and `currentWordIndex` for the active word. It does **not** reference `highlightColor` directly — the colour arrives through the computed style, which is why the greps kept missing it.
  - Plan, in order: `emphasis?: boolean` on `CaptionWordOverride` → confirm it survives `resolveCaptionWords` → `buildCaptionPages` into the words the layer receives (the `overrides` array is index-aligned there, which is the seam) → apply it in the layer's per-word render, letting the active-word colour still win when both apply → `keywordCandidates(words)` for numbers, proper nouns and ALL-CAPS, capped → a tool that writes the overrides.
  - Acceptance is cheaper now: one exported frame proves both, because it is the same component. The non-regression guarantee still stands — a cue with no emphasis must render byte-identically to today.
- **OP-08: the naive implementation would highlight the wrong word (2026-10-31).** `CaptionsData.wordOverrides` is `Record<number, CaptionWordOverride>` — keyed by **source word index** — while the layer's per-word spans use `index = run.startIndex + runIndex`, an index into the **current page**, for the active-word check (`captionTextStyle(preset, height, index === currentIndex)`). Those two index spaces are not the same thing once pages re-time and re-paginate words.
  - So "look up `captions.wordOverrides[index].emphasis` in the layer" is a bug waiting to happen: it would emphasise the right word on page 1 and the wrong one later in the clip, and no static check would see it.
  - **The safe seam is the word object itself, not an index lookup.** Attach `emphasis: true` to the resolved word in `resolveCaptionWords` (it already builds a per-word `out` array with `text` and re-timed `start`/`end`), and let it travel through `buildCaptionPages` into `page.words`. Then the layer reads `word.emphasis` and needs no index arithmetic at all.
  - That requires `emphasis` on the caption word type (the one `CaptionPage.words` holds), not only on `CaptionWordOverride`. Check that type first; if it is the shared `TranscriptWord`, prefer a captions-local type rather than widening the transcript type that everything else consumes.
  - Acceptance unchanged: one exported frame shows emphasis; a cue without emphasis renders byte-identically to today. Worth adding a **second page** to the fixture, because that is precisely the case the index-lookup version would get wrong.
- **OP-08: the emphasis channel exists (2026-10-31).** `TranscriptWord.emphasis` (display-only, captions-only), `CaptionWordOverride.emphasis`, `applyWordOverrides` carrying it onto the resolved word, and `CaptionsLayer` painting it with `preset.highlightColor` — with the active word still winning when both apply, because the flag only fills in for `index !== currentIndex`.
- The seam is the word, not an index: the override map is source-relative and the layer's index is page-relative, which is why the shortcut would have emphasised the wrong word on the second page.
- `src/captions/emphasis.verify.ts` pins four behaviours: **no overrides → the words come back byte-identical** (the non-regression promise), the flag lands only on the chosen word with text and timing untouched, emphasis composes with `text` and `timingOffsetMs` instead of replacing them, and a hidden word stays dropped. A fifth check reads `CaptionsLayer.tsx` and fails if it ever looks emphasis up by index or loses the `index !== currentIndex` precedence.
- **Not yet usable by anyone:** nothing writes `emphasis` into an override, so the flag is inert. What remains is `keywordCandidates(words)` (numbers, proper nouns, ALL-CAPS, capped) plus a way to write the overrides — the existing `edit_captions` word-override path is the obvious carrier — and then **one exported frame**, ideally with a two-page fixture, because page-relative indexing is exactly what a single-page fixture cannot distinguish.
- OP-14 (semantic catalog) and OP-15 (performance loop) stay `optional`.

**OP-10 (in progress, step 1 of 4, 2026-10-25).** The brand-kit data layer is in `src/brand/kit.ts`:
- `BrandKit`, `DEFAULT_BRAND_KIT`, `normalizeBrandKit` and `brandKitIssues`. The normalizer coerces untrusted input field by field (hex-only palette, `n:n` ratios, clamped margins/scale/opacity, watermark dropped when its corner is unknown) so a half-written kit applies its good half instead of failing whole. Optional keys are **omitted rather than set to `undefined`**, which is what makes `normalizeBrandKit(null)` deep-equal `DEFAULT_BRAND_KIT` — the verify caught that on the first run.
- `brandKitIssues` reports what the normalizer repaired, in Spanish, so the UI can say "ese color no es hexadecimal" instead of silently dropping it.
- Verify: `src/brand/kit.verify.ts` (defaults, coercion, watermark clamping, validator fields, idempotence). Registered in `test:serial`.
- **Remaining steps of this card, in order:** (2) persist on `ProjectDoc` with a reader that returns defaults for projects saved before the field — and no migration that rewrites projects; (3) `apply_brand_kit` over a batch through existing commands, plus wiring the `brandKitId` that `make_shorts` already documents; (4) the "Marca" Settings page. The card is `doing` until step 3 lands.

**OP-10, step 2 done (2026-10-25).** The kit is on the document and readable without a migration.
- `ProjectDoc` gains `brandKit?: BrandKit` next to `designStyle`. It is optional on purpose: documents saved before the field read as the defaults, so there is no migration and no rewrite of existing projects.
- `brandKitOf(doc)` is the only reader (normalizes, so a hand-edited or older-build kit cannot throw), and `withBrandKit(doc, kit)` is a pure writer returning a new document — whoever commits it normalizes first, so an unvalidated payload cannot reach the document.
- The verify now proves the three things that matter: a doc **without** the field deep-equals the defaults; the kit survives `JSON.parse(JSON.stringify(doc))`, which is what persistence actually does; and a corrupted stored kit (palette as a string, watermark with an unknown corner) normalizes instead of throwing or guessing.
- **Step 3a done (2026-10-25): the `brand.set` command.** The kit can now actually be committed. `reducerActions.ts` gains `{ type: 'brand.set'; kit: unknown }` (unknown on purpose: the reducer normalizes, so no caller — tool, UI or imported JSON — can put a malformed kit on the document), `reducerProject.ts` handles it and stores `undefined` for "no kit", `storeCommands.ts` exposes `setBrandKit(kit | null)`, and `storeCommandBuilder.ts` dispatches it in one history step.
- One trap worth remembering: `projectReduce` only routes actions whose type starts with `tl.`, `pool.` or `design.` to the project switch (`isProjectAction`). A new project-level namespace has to widen that predicate too, or the action silently falls through to the per-timeline reducer and does nothing — the verify caught it as "the doc still says Marca".
- The verify now runs the whole path on a real draft: set a kit → the document carries it clamped (`safeMargin: 9` → `0.2`), set garbage → the document keeps the defaults, set `null` → the field is absent rather than an empty object.
- **Step 3b done (2026-10-25): `apply_brand_kit`.** The kit now does something. It applies the caption preset (and the motion, when the kit has one) to every sequence, or only the active one, and `save:true` commits the kit through the `brand.set` command from step 3a — so the tool is also the write path.
- Composition, not a new renderer: it walks the sequences and calls `edit_captions` (`action=template`, then `action=animation`), restoring the user's active sequence at the end. Verified on a two-sequence draft: both targeted, ids match the project, the view returns to where it was, the kit lands on the document, and a garbage inline kit normalizes to the defaults.
- **What it does not do, and says so in the result:** the logo and the palette (`notApplied: ['watermark', 'palette']` plus a Spanish sentence pointing at `update_watermark` and `manage_design_style`). Those two have their own argument contracts and wiring them blind would have been guesswork.
- Two mistakes the verifier caught before commit: the brand module lives at `src/brand/kit`, so the tool needed `../../brand/kit`, not `../brand/kit`; and `addSequence` is not the way to build a second sequence in a draft — `duplicateTimeline` is.
- **Step 3c done (2026-10-25): the batch inherits the kit.** `make_shorts` gained `applyBrandKit` (default false). When true it reads `brandKitOf(doc)` and uses the kit's caption preset and motion as the batch defaults; an explicit `captionsPreset` / `captionMotion` always wins, and without the flag captions stay off exactly as before.
- **Correction to an earlier note in this file:** it said "the `brandKitId` that `make_shorts` advertises". That was wrong — `make_shorts` never had that parameter; the claim came from the plan text, not the code. The parameter is now real, and it is called `applyBrandKit` because it applies the project's kit rather than naming one by id.
- Verified with three cases in `make-shorts-tools.verify.ts`: the kit turns captions on by itself, an explicit preset still beats it, and leaving the flag off keeps captions skipped.
- **Step 4 (the panel) — where it belongs, decided 2026-10-25.** The card said "Settings gains a Marca page", but the editor already has a project-identity surface: `src/components/settings/DesignStylePanel.tsx`, opened from the top bar's palette button (`open-design`) through the `designStylePanel` view prop, wired to `commands.setDesignStyle`. A brand kit **is** that concept — palette, fonts, caption style, logo — so a second Settings route would create two places to edit one idea.
  - The step is therefore: add a "Marca" section to `DesignStylePanel` — name, caption preset (from `CAPTION_STYLES`), safe margin, and a "aplicar a todas las secuencias" action that calls the existing `apply_brand_kit` tool — with `setBrandKit` passed in the same way `onApply`/`setDesignStyle` already is. No new route, no new registration, and the panel keeps working if the kit is absent (`brandKitOf` returns the defaults).
  - i18n: the new labels go in `src/i18n/dict/en/shorts.ts` (already Plan 5's module) and the Spanish block at the end of `es/index.ts`. Remember `check-i18n.mjs` only reads object-literal default exports.
  - **Step 4 done (2026-10-25): the "Marca" section exists and OP-10 is complete.** `src/components/brand/BrandKitSection.tsx` sits inside `DesignStylePanel` (between the body and the footer) and edits the three fields a person actually tunes: name, caption preset (from `CAPTION_STYLES`, so there is no second list of presets) and safe margin. It commits through `commands.setBrandKit` — the same command the agent's `apply_brand_kit` uses — so the panel and the tool cannot disagree about what a kit is.
- It is a *controlled* section: the kit arrives as a prop from `brandKitOf(doc)` and the section hands back a new kit; it never reads or writes the document itself. The verify enforces that (no `setBrandKit(` call inside it, presets from the catalogue, the three fields present, every `t()` key in the English dictionary).
- **One trap, again i18n-shaped:** living under `src/components/settings/` made `verify:i18n` classify the new strings as *settings* keys and demand them in the Italian (and every other) settings dictionary. Moving the file to `src/components/brand/` keeps the obligation at "English required, Spanish provided, others fall back", which is the right level for a Plan 5 panel. Worth knowing before adding UI under `components/settings`.
- **OP-10 is done:** type + defaults + validator, document field + reader/writer, `brand.set` command, `apply_brand_kit` tool, `make_shorts` inheriting the kit via `applyBrandKit`, and the panel. 131 tools.

**Two type errors found and fixed in passing (2026-10-25).** A whole-output `npx tsc -b` — instead of the per-file greps used earlier — showed two mistakes of mine that the filtered checks had hidden: the `Result` interface in `make-shorts-tools.verify.ts` was missing `chapters`, and `es/index.ts` had a duplicate `'关闭'` key that already existed before Plan 5. Both are fixed; excluding the Plan 2 session's untracked `musicReactions`/`listen` files, the project now type-checks with **0 errors**. Lesson for the next session: grep the whole tsc output, not just the files you touched.

State at this point: every Plan 5 verify passes, `verify:agent-tools`, `verify:mcp`, `verify:components`, `verify:editor`, `verify:i18n`, `verify:server-tool-catalog` and `npm run lint` are green on the merged tree, and the only full-gate failure is the `verify-gate-coverage` blocker above (the Plan 2 session's five untracked verifies).


### Opus parity: blockers
- **2026-10-25, full gate on the merged tree: 209/210 segments passed, 1 failed** (`CC_RENDER_GL=swangle npm test`, 178 s). The failure is `scripts/verify-gate-coverage.verify.mjs`, and it is not Plan 5 code: five **untracked** verifies from the Plan 2 session (`server/music-listen/music-listen.verify.ts`, `server/music-listen/reactions-tool.verify.ts`, `server/music-listen/tool.verify.ts`, `src/audio/listen/listen.verify.ts`, `src/editor/musicReactions.verify.ts`) exist in the tree but are not in `test:serial`, so the coverage gate reports them as unregistered. Registering them is not this track's call: they are not tracked, and the harness `tsc` errors they carry are the Plan 2 session's to fix.
  - What did pass on the merged tree: all ten Plan 5 verifies, `verify:server-tool-catalog`, `verify:agent-tools`, `verify:mcp`, `npm run lint` (203 warnings, 0 errors), and `npx tsc -b` with no error in any Plan 5 file.
  - Unblocked by committing or deleting that WIP.
- **Untracked leftovers from the Plan 2 session break the gates.** `src/agent/skills/escuchar-cancion/` (untracked) makes `npm run verify:agent-tools` fail at `skills-catalog.verify` ("内置技能全部在册,无多无少", actual list contains `escuchar-cancion`), and untracked `src/editor/musicReactions.ts`, `src/components/inspector/MusicReactionControls.tsx` and `src/agent/tools/music-reaction-tools.ts` make `npx tsc -b` report 28 errors (`MusicReactionRecord` is not exported, `musicReactions` is not on `TimelineItem`, `setMusicReactions` is not a command). They are not this track's files.
  - Worked around, not fixed: `mv src/agent/skills/escuchar-cancion /tmp/leftover-escuchar-cancion`, run the gates, `mv` it back. With it moved aside, `verify:agent-tools` and `verify:mcp` both exit 0, and `npx tsc -b` reports no error in any Plan 5 file.
  - Unblocked by committing or deleting that WIP, or by the Plan 2 session finishing it.
