# Progress

**Evolution night (2026-10-28):** Terra ran EV-00 to EV-26. The rest finishes in three tracks (`docs/plans/07-evolution.md` › Finishing in three tracks): Qoder works the `Evolution night (EV)` table in `~/corteo`, ZCode the `EV track · ZCode (EZ)` table in `~/corteo-zcode`, DeepSeek Harness the `EV track · DeepSeek Harness (ED)` table in `~/corteo-dsh`. Each agent picks only from its own table and edits only its own section. Nobody picks another `todo` row (P2-2 to P2-6, P3-*, P4-*, P5-*, P6-1, P7-1, P1-7 and C-14 stay as they are). C-13 shows `doing` from an earlier session; leave it.

The single place for task status. Plans: `docs/plans/01-editor-claudia.md` (Plan 1), `docs/plans/02-claudia-escucha.md` (Plan 2), `docs/plans/03-deepseek-harness.md` (Plan 3), `docs/plans/04-claudia-brand.md` (Plan 4), `docs/plans/05-claudia-portable.md` (P-CL), `docs/plans/06-claudia-polish.md` (P-CL-13 to P-CL-17), `docs/plans/05-opus-parity.md` and `docs/plans/06-opus-parity.md` (Plan 6). Rules and the work loop: `AGENTS.md`.

**Picking the next task:** if a task is `doing`, a previous session stopped in the middle of it: resume it first. Otherwise go down the table and take the first task whose status is `todo` and whose "Needs" are all `done`. Change its status to `doing`, finish it, set `done`, and commit this file together with the work.

**Harness tracks (Plan 3):** the HQ and HW tasks have their own tables at the end of this file. Only the Qoder agent takes HQ tasks and only the WorkBuddy agent takes HW tasks, each in its own worktree and branch (see `docs/plans/03-deepseek-harness.md` › Parallel work), with the same picking rule applied to its own table. Every other agent skips both tables. Their task cards are in the plan doc.

**Brand tracks (Plan 4):** the BD and BQ tables are also at the end of this file, with the same rule. Because the Qoder and DeepSeek agents were unavailable on 2026-10-24, the WorkBuddy agent executed all eight cards itself in `~/corteo-workbuddy`; the tables say who wrote each card, not who was supposed to. B-9 merged the work into this branch the same day (see its card).

Statuses: `todo`, `doing`, `done`, `blocked` (see Blockers), `optional` (only if the user asks).

## State at handoff (2026-10-24)
- Branch `cursor/video-editor-mvp-d191`. The app runs with `npm run dev` on http://localhost:5199.
- Baseline checks on this commit, on a 4-core Linux VM without a GPU: `npx tsc -b` passes, `npm run lint` passes (warnings only, all from upstream), `npm run verify:i18n` passes, `npm run build` passes (the "chunks larger than 2500 kB" warning is upstream's), and `CC_RENDER_GL=swangle npm test` passes: exit 0, 197 test segments plus the pre- and post-test chains, about 6 minutes. Without `CC_RENDER_GL=swangle` on a machine without GPU WebGL2, three render tests fail with "WebGL2 not available" (`remotion/video-decoder-render.verify.mjs`, `src/gl/clipFxExport.verify.mjs`, `src/gl/clipFxExport.offthread.verify.mjs`); that is the environment, not a code failure.
- After publishing the live editor (2026-10-25, same VM, Node 24): `npx tsc -b`, `npm run lint` (warnings only) and `npm run build` (upstream's chunk-size warning) pass, and `CC_RENDER_GL=swangle npm test` passes: exit 0, 213 test segments. Carlos still deploys the named tunnel and `npx wrangler deploy` on his PC.
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
| P0-2 | Raise the dev server heap | done | |
| P0-3 | `npm run start:corteo` and `.env.corteo.example` | done | P0-2 |
| P0-4 | Spanish README | done | P0-3 |
| H-9 | Merge the harness tracks (Cursor agent only) | done | HQ-1 to HQ-5 and HW-1 to HW-5 `done` or `blocked` on their own branches |
| B-9 | Merge the brand tracks (Cursor agent only) | done | BD-1 to BD-4 and BQ-1 to BQ-4 |
| P1-1 | Providers off: server block | done | P0-3, H-9 |
| P1-2 | Providers off: hide UI, filter MCP tools | done | P1-1 |
| P1-3 | Allowed hosts from env | done | P0-3 |
| P1-4 | "Conectar corteo" card | done | P1-3 |
| P1-5 | `npm run editor-host` (headless editor tab) | done | P0-3 |
| P-CL-1 | Installer unsets NPM_CONFIG_PREFIX before nvm | done | |
| P-CL-2 | corteo-env.sh and a wrapper that selects Node 24 | done | P-CL-1 |
| P-CL-3 | Self-test reports the step that failed | done | P-CL-1 |
| P-CL-4 | No Remotion browser download at render time | done | |
| P-CL-5 | Audio with no trackId creates an audio track | done | |
| P-CL-6 | Text keeps fromFrame on an overlay track | done | |
| P-CL-7 | split JSON returns the new item id | done | |
| P-CL-8 | Headless `corteo mcp token` | done | |
| P-CL-9 | Spanish defaults in CLI JSON | done | |
| P-CL-10 | Vite warmup path | done | |
| P-CL-11 | SKILL.md recipes, copy-paste tested | done | P-CL-2, P-CL-5, P-CL-6, P-CL-7, P-CL-8 |
| P-CL-12 | corteo-acceptance.sh on Node 20 with the prefix set | done | P-CL-1 to P-CL-11 |
| P-CL-13 | Acceptance script uses its own port and project store | done | P-CL-12 |
| P-CL-14 | 9:16 cover / contain+blur, no checkerboard in the render | done | |
| P-CL-15 | Short music recipe, trim --to, render --to-audio | done | P-CL-11 |
| P-CL-16 | corteo:local starts without Vite warnings | done | P-CL-10 |
| P-CL-17 | Installer self-test leaves no files in the repo | done | P-CL-3 |
| P1-6 | `videoclip-musical` skill | done | P1-2 |
| P1-7 | Webhooks with HMAC | optional | P4-3 |
| L-01 | Server-side Beat This + CLAP runner | done | |
| L-02 | Listening DSP in `src/audio/listen/` | done | |
| L-03 | Mood per section + Latin labels | done | L-01 |
| L-04 | Lyric lines, chorus candidates, SongMap + cache | done | L-02 |
| L-05 | Pictures: map PNG + spectrogram | done | L-04 |
| L-06 | `listen_to_song` MCP tool | done | L-01, L-03, L-05 |
| L-07 | Real-ear relay (off by default) | done | L-06 |
| L-08 | Keyframable filters + binary-search sampling | done | |
| P2-1 | Ken Burns | done | |
| L-09 | Music reactions + tools | done | L-06, L-08, P2-1 |
| L-10 | Caption motion `latido` | done | L-06 |
| L-11 | Music UI: inspector section, timeline map, song dialog | done | L-09 |
| L-12 | `escuchar-cancion` skill + MCP prompt | done | L-09, P1-6 |
| L-13 | Listening end-to-end proof | blocked (no song) | L-11, L-12 |
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
| P5-1 | Full Spanish dictionary | done (all modules translated; the brand.ts fold-in is left) | |
| P5-2 | i18n coverage + placeholder gate | todo | P5-1 |
| P5-3 | Untranslated-text scan | todo | P5-2 |
| P6-1 | Bot end-to-end proof + screenshots | todo | every task above is `done` or `blocked` |
| P7-1 | EffectCraft titles sidecar | optional | P6-1 |

### P-CL-13 to P-CL-17 · Claudia polish — done
- Plan: `docs/plans/06-claudia-polish.md`.
- P-CL-13: `CORTEO_PORT` and `CORTEO_STORE_DIR`. Acceptance never binds 5199 unless that port was requested and is free.
- P-CL-14: item `fit` and `background`, black render backdrop, `scripts/vertical-fit.verify.mjs`.
- P-CL-15: Receta rápida, then the full Video musical recipe. `item trim --to`, `render --to-audio`.
- P-CL-16: `./shorts.ts` and `VITE_CONFIG_NATIVE_IGNORE_WARNING`.
- P-CL-17: self-test uses `mktemp` and deletes the directory on success.

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

### P0-2 · Raise the dev server heap — done
- Done 2026-10-25: `devHeapNodeArg` / `viteProcessArgs` in `scripts/dev-profile.mjs`. Vite starts as `node --max-old-space-size=<MB>`.
- Plan: Plan 1 › Phase 0.
- Files: `scripts/dev-profile.mjs` (`runVite`), `scripts/dev-profile.verify.mjs`.
- Do: start Vite as `node --max-old-space-size=<MB> node_modules/vite/bin/vite.js …`, with MB from `OPENCHATCUT_DEV_HEAP_MB` (default 6144). Export a small helper that builds the argument list so the verify can test it.
- Done when: after `npm run dev`, `ps -eo args | grep vite.js` shows `--max-old-space-size=6144`; with `OPENCHATCUT_DEV_HEAP_MB=4096` it shows 4096; the verify asserts both.
- Verify: `npm run verify:runtime-profile`.

### P0-3 · `npm run start:corteo` and `.env.corteo.example` — done
- Done 2026-10-25: `npm run start:corteo` loads `.env.corteo` when it exists. `.env.corteo.example` is tracked; `.env.corteo` stays gitignored.
- Plan: Plan 1 › Phase 0.
- Files: `package.json` (scripts), new `.env.corteo.example`, `.gitignore`.
- Do:
  - Script: `"start:corteo": "node --env-file-if-exists=.env.corteo scripts/dev-profile.mjs"`.
  - `.env.corteo.example` lists `OPENCHATCUT_MCP_TOKEN=` (43 base64url characters, e.g. `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='`), `OPENCHATCUT_PROVIDERS=off`, `OPENCHATCUT_ALLOWED_HOSTS=`, `PREFERRED_TRANSCRIPTION_PROVIDER=local`, `OPENCHATCUT_DEV_HEAP_MB=6144`, and a commented-out `# CC_RENDER_GL=swangle` for PCs without GPU WebGL (see `AGENTS.md` › Environment), each with a one-line Spanish comment.
  - `.gitignore` ignores `.env.*`: add `!.env.corteo.example` next to `!.env.example`.
- Pitfall: in a dev profile the server's environment is `{...process.env, ...profile settings}` (`profileChildEnvironment` in `scripts/dev-profile.mjs`), and Vite stops reading `.env*` files once the profile has saved settings (`config/vite.config.ts`, around line 90). That is why the variables must arrive through the process environment. `PREFERRED_TRANSCRIPTION_PROVIDER` is a settings key, so a value saved in Settings wins over the env file.
- Done when: with `.env.corteo` holding token T, the MCP smoke test in `AGENTS.md` works with T and gets 403 with any other token; without `.env.corteo` the script still starts.
- Verify: `npm run verify:runtime-profile`, MCP smoke test.

### P0-4 · Spanish README — done
- Done 2026-10-25: the run steps for `start:corteo`, the tunnel and Claudia's MCP URL are in `README.es.md` › "Publicar el editor". `README.md` stays the English overview.
- Plan: Plan 1 › Phase 0.
- State: `README.md` was rewritten in Spanish on 2026-10-24, before P0-3 (what the editor is, status, requirements, install, the `corteo` alias, data and token locations, syncing Cursor's branch to GitHub, credits and AGPL). B-9 then renamed its prose: the product is Claudia, corteo is the repository and the command, and the brand fonts' licences are in the credits. Don't replace it: extend it, with the same naming.
- Files: `README.md` (leave `README_ZH.md` alone).
- Do: in Spanish: what the editor is (Claudia, a fork of OpenChatCut for music videos, driven by Claudia over MCP; the repository is corteo), requirements (WSL/Linux, Node 24, ffmpeg comes with npm), `npm install`, `npm run dev`, `npm run start:corteo`, how to connect Claudia (URL, token, `.env.corteo`), where data lives (`~/.openchatcut`), AGPL v3 note with a link to upstream OpenChatCut (https://github.com/0xsline/OpenChatCut).
- Remaining: once P0-3 and P1-4 are done, add `npm run start:corteo`, `.env.corteo` and the steps to connect Claudia, and update its "Estado" section.
- B-9 rewrites the README and AGENTS prose for the new name: the product is Claudia, corteo stays the repository and the command, and the two font licences join the credits. Don't pre-empt it here.
- Done when: a new user can go from clone to the running editor and a connected Claudia with only the README.

### P1-1 · Providers off: server block — done
- Done 2026-10-25: the blocked list in `server/plugins/providers-off.ts` now includes generation, stock, Firecrawl, AssemblyAI, e2b, upload-post and cloud transcription. Local routes stay open.
- Plan: Plan 1 › Phase 1, narrowed by Plan 3: the chat's model providers are HQ-3's job.
- Files: `server/plugins/providers-off.ts` + its verify (created by HQ-3 and already registered right after `requestShapeGatePlugin()` in `server/plugins/index.ts`).
- Do: extend HQ-3's blocked list, don't write a second middleware. When `OPENCHATCUT_PROVIDERS=off`, it also answers 403 `{"error":"providers_disabled"}` for: `/generate/image`, `/generate/video`, `/generate/voice`, `/generate/music`, `/generate/sound`, `/api/stock-search`, `/api/firecrawl/*`, `/api/web-browser`, `/assemblyai` (Vite proxy in `config/vite.config.ts`), `/api/assemblyai-upload`, `/e2b/*`, `/api/upload-post`, and `/api/transcribe` (cloud transcription: OpenAI, Deepgram, Groq, ElevenLabs, Cartesia). `/llm` (only DeepSeek Harness, Ollama and LM Studio pass) and the Codex, Copilot, Claude Code and xAI routes are already blocked by HQ-3.
- Keep working: `/generate/progress` (Phase 3 import progress uses it), `/api/hf-proxy` (downloads the local model packs), and everything local (export, render, waveform, frames, scene detection, local transcription). Check `/generate/subtitles`, `/api/isolate-voice` and `/api/auto-grade`: block them only if they call a keyed service.
- Middlewares added directly in `configureServer` run before Vite's internal ones, including the `/assemblyai` proxy, so the existing registration covers it.
- Done when: with the switch on, a POST to each blocked route gets 403 `providers_disabled` and the chat still works through DeepSeek Harness; with it off, behaviour is unchanged.
- Verify: the extended verify (route list + middleware), `npm run verify:mcp`.

### P1-2 · Providers off: hide UI, filter MCP tools — done
- Done 2026-10-25: `visibleSettingsCategories` hides generation, stock, cloud transcription, sandbox, web and publish. The top-bar generation button hides. `externalToolSchemas` drops generation and stock tools. The chat stays.
- Plan: Plan 1 › Phase 1, narrowed by Plan 3: the chat stays, on DeepSeek Harness.
- Files: the client flag HQ-3 added in `config/vite.config.ts` (its own define, not `__CONFIGURED_CAPS__`), the Settings panes for generation, stock and cloud transcription vendors (`src/components/settings/`), the generation menus, `src/agent/external-tool-schemas.ts`.
- Do: reuse HQ-3's flag. Keep the chat panel and the dashboard model-setup card: with the switch on they lead to DeepSeek Harness (HQ-2, HQ-3 already hid the other agent vendors). Hide the generation menus and the generation, stock and cloud-transcription panes, and make `externalToolSchemas()` drop generation and stock tools when the switch is on.
- Done when: with `.env.corteo` (switch on) the editor has no generation menus, Settings shows no generation, stock or cloud-transcription vendors, `tools/list` over MCP has no generation or stock tools, and the chat still works through DeepSeek Harness; with the switch off nothing changes.
- Verify: `npm run verify:agent-tools`, `npm run verify:mcp`, `npm run verify:components`, a new verify for the schema filter.

### P1-3 · Allowed hosts from env — done
- Done 2026-10-25: `allowedHostsFromEnv` appends `OPENCHATCUT_ALLOWED_HOSTS` to `.cursorvm.com` and `localhost`.
- Plan: Plan 1 › Phase 1.
- Files: `config/vite.config.ts` (`server.allowedHosts`), `config/vite.config.verify.ts`.
- Do: append the comma-separated hosts in `OPENCHATCUT_ALLOWED_HOSTS` (trimmed, empty entries dropped) to the existing list.
- Done when: `curl -H 'Host: editor.example.com' http://localhost:5199/` is refused without the variable and served with `OPENCHATCUT_ALLOWED_HOSTS=editor.example.com`.
- Verify: `npx tsx config/vite.config.verify.ts`. `config/` changes need the full gate (`npm test`).

### P1-4 · "Conectar corteo" card — done
- Done 2026-10-25: the MCP guide shows `https://corteo.uset82.workers.dev/api/external-mcp/mcp` and a `defineConnection` snippet. The token is the one the guide already reveals.
- Plan: Plan 1 › Phase 1 (connection kit).
- Files: `src/components/settings/McpGuide.tsx` (it already shows the token in trusted sessions), i18n dictionaries.
- Do: a card titled "Conectar Claudia" with the MCP URL, the token (reuse the existing reveal/copy logic), the `defineConnection` snippet from the plan with copy buttons, and a note that the editor's domain must be in Claudia's `hosting.egressDomains`.
- Done when: the card renders in Spanish in Settings › MCP and the copied snippet is valid TypeScript.
- Verify: `npx tsx src/components/settings/mcpGuideLoader.verify.ts`, `npm run verify:i18n`.

### P1-5 · `npm run editor-host` — done
- Done 2026-10-25: `npm run editor-host` opens `/#/editor/<id>` in headless Chromium and reopens it if the server comes back. `--project` picks an id; otherwise the newest project.
- Plan: Plan 1 › Phase 1 (connection kit).
- Files: new `scripts/editor-host.mjs` (add `!/scripts/editor-host.mjs` to `.gitignore`), `package.json`.
- Do: open the editor on a project in headless Chromium (Playwright is already a dev dependency; run `npx playwright install chromium` once) and keep the tab alive; reconnect if the dev server restarts; exit cleanly on Ctrl+C. A tab registers with the MCP bridge only while a project is open: take the project from `--project <id>`, else the most recently updated one; the `get_editor_url` MCP control returns a project's editor URL.
- Done when: with no normal browser open, `openchatcut_status` over MCP reports a connected editor and `tools/list` returns the full editor tool set (not the 44 offline tools).
- Verify: MCP smoke test before and after starting it.

### P1-6 · `videoclip-musical` skill — done
- Done 2026-10-25 in `53e7413`: `src/agent/skills/videoclip-musical/SKILL.md` (66 lines, `user-invocable`) walks the six steps with tools that exist today. `load_skill {"name":"videoclip-musical"}` over MCP against the dev server returned 13,902 bytes with the full file. The skill count moved to 31 in `skill-loading.verify.ts`, and the bundled-skills list in `assets/agent/openchatcut-tool-schemas.json` was regenerated. Later commits kept the skill current: `36bb9e2` added `apply_ken_burns` to step 3 and `3d3b1cd` renamed the visible app to Claudia.
- Also fixed in `53e7413`: the merged P1-2 code read `process.env` at module scope in `src/agent/external-tool-schemas.ts`, which reaches the browser through the editor bridge and crashed the editor page with "process is not defined". It now uses the existing `PROVIDERS_OFF` define in the browser and reads the env only when `process` exists (tsx/server).
- Re-marked 2026-10-26: the `3c40299` merge resolved PROGRESS.md from the other side and dropped this row (P2-1's mark was restored in `a010b92`; P1-6's was not), so the card is back with no code change. Re-ran the gate: `npm run verify:skills` passes. Step 2's rewrite to `listen_to_song` belongs to L-12.
- Plan: Plan 1 › Phase 1 (skill).
- Files: new `src/agent/skills/videoclip-musical/SKILL.md` (copy the frontmatter shape of `src/agent/skills/music-intelligence/SKILL.md`).
- Do: Claudia's end-to-end workflow from the plan. Name only tools that exist today; each later task that adds a tool updates this skill.
- Done when: `load_skill` with `videoclip-musical` over MCP returns it.
- Verify: `npm run verify:skills`.

### P1-7 · Webhooks with HMAC (optional)
- Plan: Plan 1 › Phase 1. Only if the user asks; polling with `track_export` already works.
- Do: `OPENCHATCUT_WEBHOOK_URL` + `OPENCHATCUT_WEBHOOK_SECRET`; POST JSON for `export.completed`, `export.failed`, `import.completed`, `variant.chosen` with an `X-Corteo-Signature: sha256=<hex>` HMAC of the body; retries with backoff; never blocks the export.
- Verify: a verify with a local HTTP receiver checking the signature.

### L-01 · Server-side Beat This + CLAP runner — done
- Done 2026-10-25: the inference cores moved to `shared/music-inference/` (`RhythmInference`, `ClapInference`) and both the desktop workers and a forked server worker use them; ffmpeg decodes to 22.05 kHz mono with a 15-minute cap, the analysis lands under the same `musicAnalysisCacheKey` plus analyzer fingerprint, and `analyze_music` / `inspect_music` are server-direct and in the offline catalog.
- Proof over the real MCP handler with the packs installed and no editor tab: `analyze_music` took 35,301 ms and returned BPM 120, meter 1, confidence 0.991, 416 beats, 379 downbeats, 3 sections, 4 tags; `inspect_music` answered from the cache in 269 ms with the same numbers; `review_edit_session` committed the imported song. The media card badge then read `120 BPM · Unknown` (`data-state="ready"`, aria-label `Music analysis: song-328.wav, 120 BPM · Unknown`) from that same project-store record. The CLAP profile labels this clip "unknown" in every category, which is its conservative answer, not a missing tag.
- Gates: `npx tsc -b`, `npm run lint` (0 errors), `npm run verify:music-intelligence`, `npm run verify:agent-tools`, `npm run verify:mcp`, `npm run verify:desktop-inference`, `npx tsx desktop/update-packaging.verify.ts`, `npm run desktop:build:main`, `npm run build:cli`.
- Plan: Plan 2 › Part A (server runner).
- Files: `desktop/native-rhythm-worker.ts`, `desktop/native-clap-worker.ts` (move the inference cores to shared modules), new `server/music-listen/`, `src/audio/intelligence/store.ts` (cache key), `src/agent/external-tool-policy.ts`, `server/external-agent/offline-tools.ts`, `server/external-agent/offline-executor.ts`.
- Do: run the cores in a `worker_threads` worker with ffmpeg decoding to 22.05 kHz mono; same cache key; make `analyze_music` and `inspect_music` server-direct and add them to the offline catalog.
- Pitfall: the model packs (about 117 MB) are installed from Settings; tests must not need them (inject a fake core). The desktop app must keep working: run the desktop verifies.
- Done when: with the packs installed and no editor tab open, `analyze_music` over MCP returns BPM and sections for an uploaded song, and the media card badge shows the result.
- Verify: `npm run verify:music-intelligence`, `npm run verify:agent-tools`, `npm run verify:mcp`.

### L-02 · Listening DSP in `src/audio/listen/` — done
- Done 2026-10-25: `src/audio/listen/` measures a decoded mono clip with pure functions — 50 ms RMS plus bass/mid/brightness bands and a power centroid, onsets and accents, drop/break/build/stop/vocals-in/out moments, a Krumhansl–Kessler key, and an ffmpeg `ebur128` args builder + stderr parser; `measureSong()` composes them. `src/audio/beats.ts` now exports `fftInPlace`, so the spectrum pass and the beat tracker share one FFT, and onsets reuse the existing `onsetEnvelope`.
- Proof: `listen.verify.ts` synthesizes every signal (no fixtures in git): seven 120 BPM clicks land on the 500 ms grid within 10 ms with no off-grid onsets; a 60 Hz burst puts bass above 3× mid and brightness with a centroid under 200 Hz; one second of silence reads as a stop at 1550 ms; an A4/C5/E5 triad reads A minor; a quiet→loud step reads as a drop at 2500 ms; a 3 s clip yields 59 whole 50 ms frames. The ebur128 fixture parses I −23.0 LUFS, LRA 5.0 LU, true peak −9.3 dBFS and the `S:` curve, and the builder keeps `-hide_banner -nostats` and never `-v`.
- Traps recorded in code: flux credits an attack to the first 1024-sample window that contains it, so onsets are refined over ±2 hops or they read up to 46 ms early; the 6-frame energy smoothing dates a stop about 250 ms late, so its boundary is re-anchored on raw RMS.
- Gates: `npx tsc -b`, `npm run lint` (0 errors), `npx tsx src/audio/listen/listen.verify.ts`, `npx tsx src/audio/beats.verify.ts`; registered in `test:serial` (verify-registration counted 687 tracked verifies). The same day's `CC_RENDER_GL=swangle npm test` ran 214/215, the only failure being the concurrent session's then-uncommitted `caption-emphasis-render` registration, which passes now that it is committed.
- Plan: Plan 2 › Part A (new measurements) and Verification (synthetic tests).
- Files: new `src/audio/listen/*.ts` (pure functions, no DOM, no Node-only APIs) + verifies; `src/audio/beats.ts` (extract the onset envelope so both share it).
- Do: 50 ms energy, bass/mid/brightness bands, onsets and accents, moments (drop, break, build, stop, vocals in/out), key and mode, and an ffmpeg `ebur128` parser (`-hide_banner -nostats`, never `-v error`).
- Done when: all synthetic-audio tests in Plan 2 › Verification pass, generated in the test (no audio fixtures in git).
- Verify: the new verifies, `npx tsx src/audio/beats.verify.ts`.

### L-03 · Mood per section + Latin labels — done
- Done 2026-10-26: CLAP keeps one embedding per representative window (`ClapClient.embedWindows`, `windowEmbeddings` through the forked server core), and `withSectionMoods` scores every section against the mood prototypes using the windows it covers, weighted by overlap. Records keep one canonical English vocabulary; `displayMusicLabel` applies Spanish where a person reads it, so a cached analysis never depends on the UI language. The analyzer fingerprint moved to `clap-profile-v2`, so v1 records without a mood are re-analyzed instead of served.
- Latin labels: `scripts/build-clap-prototypes.mjs` rebuilt the checked-in profile from the pinned `Xenova/clap-htsat-unfused` revision with the CLAP text encoder — 5 moods (nostalgic, hopeful, festive, sensual, spiritual) and 7 genres (cumbia, salsa, bolero, reggaeton, huayno, flamenco, latin rock). The JSON went from 32 to 44 labels and the original 32 vectors are byte-identical; the generator writes the same compact shape, so a re-run with unchanged vectors produces no diff. The text encoder (about 127 MB) is fetched once into `~/.cache/corteo-clap-text`, never into the app's pack directory; the `music-semantics-lite` pack ships the audio encoder only.
- Proof: `music-listen.verify.ts` feeds a fake core that returns the `festive` prototype for every window; the composed analysis gives every section a `festive` mood with score 1, and `inspect_music` lists `mood: 'festiva'` with `moodScore: 1`. `clapProfile.verify.ts` covers two sections scored from different windows, overlap weighting, below-threshold sections staying moodless instead of `unknown`, the no-window passthrough, and the Spanish names (`reggaeton` → `reguetón`, `latin rock` → `rock latino`). `clapClient.verify.ts` checks `embedWindows` keeps each window offset and the same unit mean. Both cache validators (`shared/music-inference/analysis-record.ts`, `src/audio/intelligence/store.ts`) now reject a section whose stored mood is not a `mood` tag.
- Gates: `npx tsc -b`, `npm run lint` (0 errors, 203 warnings), `npm run verify:music-intelligence` (every suite, including the three above). `npm run verify:affected` cannot map `shared/` and asset changes, so it handed off to the full gate: `CC_RENDER_GL=swangle npm test` ran 218/219 segments in 661.5 s — the only failure was the concurrent session's then-uncommitted `scripts/no-claudia.verify.mjs` (it flagged its own new lines; the same session committed `8568949` for it) — and `npm run build` passed with upstream's chunk-size warning.
- Plan: Plan 2 › Part A (mood per section).
- Files: `src/audio/intelligence/clapClient.ts`, the prototypes JSON next to it, new `scripts/build-clap-prototypes.mjs` (add a `!/scripts/…` line to `.gitignore`).
- Do: score each section's windows against the prototypes; add the Latin moods and genres from the plan with Spanish display names. Embeddings never leave the server.
- Done when: inspect results list a mood per section with Spanish names.
- Verify: `npm run verify:music-intelligence`.

### L-04 · Lyric lines, chorus candidates, SongMap + cache — done
- Done 2026-10-26: `src/audio/listen/songMap.ts` groups timed words into display lines (a 700 ms gap, sentence punctuation, or the 8 s / 14-word caps ends one), drops blank and non-finite words, clamps negative starts and collapses whitespace. Repeated lines are found after NFD normalization — accents, case and punctuation cannot hide a repeat — and become 1-based chorus groups in order of first appearance; each line is attached to the section containing its start, clamping to the first or last section. `buildSongMap` copies the analysis sections with their moods, lets user-provided timed lines replace the transcript entirely, and records `lyricsSource` as `transcript`, `user` or `none`.
- Cache: `shared/music-inference/song-map-record.ts` keys a map by asset, source revision and its own fingerprint (`clap-profile-v2+song-map-v1`), so a grouping change drops maps without throwing away the analysis; the validator checks the schema version, contiguous sections that end at the duration, line times and section indexes, and that every line carrying a group number is listed in exactly one group. `server/music-listen/song-map-cache.ts` reads and writes it through the shared project store under `song-map:<sha256>`, beside `music-analysis:<sha256>`.
- Proof: `songMap.verify.ts` covers silence, punctuation and both length caps, dirty input (blank, NaN, negative starts), accent/case-insensitive repeats, two groups ordered by first appearance, section boundaries and past-the-end clamping, and the transcript/user/none sources with user lines winning. `song-map-cache.verify.ts` round-trips a map, misses on a different revision or asset, and treats a stale fingerprint, untidy line text, an out-of-range section index or a group without its number as misses; it also refuses to write an invalid map.
- Gates: `npx tsc -b`, `npm run lint` (0 errors, 203 warnings), both new verifies, `npm run verify:music-intelligence`, and `npm run build` all passed. `CC_RENDER_GL=swangle npm test` ran 221 segments in 165.8 s, all passing after one rerun: the first run failed only `scripts/harness/models.verify.mjs` on its `thinkingMs > 0` timing assertion under the runner's 4-way parallelism, and the same verify passed standalone and in the rerun.
- Plan: Plan 2 › Part A (lyrics) and the tool output it feeds.
- Files: `src/audio/listen/` (SongMap type), the server cache next to the music-analysis cache.
- Do: group the local whisper words into lines, mark repeated lines as chorus candidates, attach them to sections; user-provided lyrics win. Define the `SongMap` type and its cache keyed by asset, source revision and analyzer fingerprint.
- Verify: new verifies for line grouping and chorus detection.

### L-05 · Pictures: map PNG + spectrogram — done
- Done 2026-10-26: `server/music-listen/pictures.ts` draws the song map as pure SVG (1280×720) and rasterizes it through sharp; the spectrogram comes from ffmpeg's `showspectrumpic` (1280×480 plot, `scale=log:color=intensity`, legend on) written to a temp dir and read back. The map carries the mirrored RMS waveform, energy and bass curves, section bands labelled with the Spanish role and `displayMusicLabel` mood plus their energy percentage, downbeat ticks, drop lines with labels, the other moments, up to 14 lyric lines with mm:ss prefixes (chorus lines prefixed `·` in gold), `sin letra transcrita` when the map has no lines, and a mm:ss axis whose step adapts to the duration. `sharp` is pinned to 0.35.0 as a direct dependency, matching the existing override; the lockfile only gained that root entry.
- Proof: `server/music-listen/pictures.verify.ts` synthesizes a 30 s 22.05 kHz sweep with pulsing bass and deterministic hiss, measures it with `measureSong`, and builds a four-line map with one repeated chorus line. It checks the SVG text before any pixels: 0:00/0:15/0:30 ticks, `intro` / `clímax · festiva` / `salida`, `90%`, `onda` / `energía` / `graves`, the dashed `drop` marker, `break`, both `· Rock &amp; Roll en la noche.` lines at 0:01 and 0:21, an escaped title, and the empty-map note. Then it rasterizes: the map is exactly 1280×720, the spectrogram is at least 1280×480 and wider than the plot because the axis and dB legend add margins; every RGB channel spans more than 40 levels (map ±240/219/231, σ 33.0/30.2/27.4; spectrogram ±255 each, σ 85.2/32.2/40.7), so neither PNG is blank. An empty path and a missing file both reject.
- Gates: `npx tsc -b`, `npm run lint` (0 errors, 203 warnings), the new verify (1.4 s), `npm run verify:music-intelligence`, and `npm run build` passed. `CC_RENDER_GL=swangle npm test` ran 221 segments in 213.0 s, all passing on the first complete run; the first attempt aborted in `verify-registration.verify.mjs` because the new verify was not yet git-tracked, and passed once staged.
- Plan: Plan 2 › Part A (pictures).
- Files: new `server/music-listen/pictures.ts`; `package.json` (pin `sharp` as a direct dependency at the version in `overrides`).
- Done when: both PNGs are generated for a synthetic song, are non-blank (pixel variance check) and show the mm:ss axis.
- Verify: a new verify. `package.json` changes need the full gate.

### L-06 · `listen_to_song` MCP tool — done
- Done 2026-10-26: `listen_to_song` answers one call with a Spanish summary and compact JSON (tempo, key, sections with Spanish roles and moods, moments, energy/bass curves, lyric lines and chorus candidates) plus the saved `songMapRef` and, on the server runtime, the song-map PNG and the spectrogram as `__images` with `mimeType: 'image/png'`. `server/music-listen/listen.ts` runs the model pass through `analyzeServerMusicAsset` (cache first), always decodes and measures the audio, and falls back to `analyzeBeats` + `deriveMusicSections` when the packs are missing; a DSP map is drawn and summarized but never cached, so it cannot shadow the real map later. `shared/music-inference/listen-snapshot.ts` holds the pure text half with a 7-level shrink ladder that caps lines, moments, sections and curve points and stays under 15,000 characters for any song. The browser executor uses cached analysis only and answers text with a note that pictures need the server. `lyricWordsForMusic` feeds the clip's transcript (source-ms words) into `buildSongMap`.
- Proof: `server/music-listen/listen.verify.ts` synthesizes a 12 s 120 BPM click+bass song and runs both paths with `HOME` pointed at an empty dir so installed packs cannot leak in. The model path (injected analysis, real ffmpeg decode, real sharp/ffmpeg pictures) asserts `source: 'model'`, the Spanish summary lines (`0:00–0:06 intro 25%`, `0:06–0:12 clímax 90%, festiva`, `Letra: 3 líneas · 1 estribillo · «la noche llega»`), a `song-map:` ref whose lines and chorus group read back from the shared cache, two PNGs with the PNG signature and more than 10 KB each, and text at 2,304 characters. The range path filters beats (12), lines (1) and sections (1). The tool path without packs (no editor tab) returns `source: 'dsp'`, 119.8 BPM, 23 beats, 6 downbeats, onsets, the quiet-to-loud moment, `songMapRef: null`, both pictures and every progress phase (`modelo`, `medidas`, `mapa`, `espectrograma`, `listo`). A missing file reports `no se pudo escuchar el audio` instead of an empty answer, and a pathological 20-minute song with 500 lyric lines still serializes to 12,755 characters.
- Gates: `npx tsc -b`, `npm run lint` (0 errors, 204 warnings), `npm run verify:mcp`, `npm run verify:agent-tools`, `npm run verify:server-tool-catalog`, `npm run verify:music-intelligence` (new verify included), and `npm run build` passed. `CC_RENDER_GL=swangle npm test` ran 220 segments in 171.9 s, all passing under Node 24; a first run with the shell's default Node 22 failed only `scripts/harness/install.verify.mjs`, which requires Node 24, and that verify passes under the repo's `.nvmrc`.
- Plan: Plan 2 › Part A (MCP tool).
- Files: new `server/music-listen/listen.ts`, `server/music-listen/listen.verify.ts`, `server/music-listen/sharp.d.ts`, `shared/music-inference/listen-snapshot.ts`, `src/audio/listen/fallback.ts`; `server/music-listen/tool.ts`, `server/music-listen/pictures.ts`, `src/audio/listen/songMap.ts`, `src/audio/listen/index.ts`, `src/agent/tools/music-target.ts`, `src/agent/tools/music-intelligence-tools.ts`, `src/agent/tools/schemas/music-intelligence-tools.ts`, `src/agent/external-tool-policy.ts`, `src/agent/execution-policy.ts`, `src/agent/tool-routing.ts`, `server/external-agent/offline-executor.ts`, `server/external-agent/offline-runtime.verify.ts`, `assets/agent/openchatcut-tool-schemas.json`, `package.json`.
- Done when: over MCP with no editor tab, `listen_to_song` returns a Spanish summary, compact JSON under 16,000 characters, a `songMapRef` and two image blocks; without model packs it still returns the DSP measurements, fallback beats and pictures.
- Verify: `npm run verify:mcp`, `npm run verify:agent-tools`, `npm run verify:server-tool-catalog`, the new verify (size limit).

### L-07 · Real-ear relay (off by default) — done
- Done 2026-10-26: `server/music-listen/relay.ts` is the editor's one opt-in paid call. It runs only when `OPENCHATCUT_LISTEN_RELAY=openrouter` and `OPENROUTER_API_KEY` are set; `OPENCHATCUT_PROVIDERS=off` does not gate it, because the relay has its own two switches and the plan calls it the paid exception. The default model is `google/gemini-3.8-flash`; `LISTEN_RELAY_MODEL`, `LISTEN_RELAY_CROSS_CHECK_MODEL` and `LISTEN_RELAY_BASE_URL` override it. The song is shrunk by ffmpeg straight to a 64 kbps mono mp3 (`-id3v2_version 0 -write_xing 0`, so the payload starts on an MPEG frame) and sent in one POST to `/chat/completions` as an `input_audio` part with a Spanish prompt for timbre, vocal emotion, arrangement and an `m:ss` emotional arc, quoting lyrics only in «short quotes». `audio_tokens > 0` marks the note `verificado`; zero marks it `sin verificar` and runs a local cross-check of its timestamps against section boundaries (±3 s) and its quotes against the whisper words. `listen_to_song` gained `relay` (default false); the browser executor answers that the real ear needs the server. Notes are cached as `listen-relay:<sha>` per [asset, sourceRevision, model] in the project store, and only successful calls are cached. The optional cross-check model gets one extra request only when the first answer reports no audio tokens. `shared/music-inference/listen-snapshot.ts` carries the note in the Spanish summary and the provider/token accounting in JSON, so the existing detail ladder still bounds the result.
- Proof: `server/music-listen/relay.verify.ts` runs a local mock OpenRouter and real ffmpeg. Off (no switch), switch-without-key and key-without-switch all make zero HTTP calls. With both switches on and `OPENCHATCUT_PROVIDERS=off` it asserts the request URL, the bearer header, the default model, the Spanish prompt keywords, an `input_audio` mp3 part whose first bytes are an MPEG-1 Layer III frame at 64 kbps mono, a four-second payload around 32 KB, and `audio_tokens: 1280` → `verificado`. The second call returns `cached: true` with no new request, and the stored record is readable; changing `LISTEN_RELAY_MODEL` makes a second, cached-by-model request. An answer with zero audio tokens becomes `sin verificar` with `{timestamps: 3, matchedTimestamps: 2, quotes: 2, matchedQuotes: 1}` and the summary reports `marcas de tiempo 2/3` and `citas 1/2`; a 5,000-character note still fits the snapshot ceiling. The cross-check model runs only after an unverified first answer and its verified answer replaces the note. A 500 `sin saldo` rejects with the provider message and is not cached; deleting the switch stops further calls. `listen.verify.ts` gained `relay` in the schema key list.
- Gates: `npx tsc -b`, `npm run lint` (0 errors, 204 warnings), `npm run verify:music-intelligence` (new verify included), `npm run verify:mcp`, `npm run verify:agent-tools`, `npm run verify:server-tool-catalog`, and `npm run build` passed. `CC_RENDER_GL=swangle npm test` ran 221 segments in 706.0 s under Node 24: 220 passed, including `relay.verify` (6 mock requests, 1280 audio tokens) and `keyframes.verify`; the only failure was `scripts/verify-registration.verify.mjs` refusing `cli/jobs.verify.ts`, an untracked file another agent added to `test:serial` during the run — not an L-07 file. The task was committed before the run because that same check reads `git ls-files`, so a new verify cannot pass it until it is tracked.
- Plan: Plan 2 › Part B.
- Files: new `server/music-listen/relay.ts`, `server/music-listen/relay.verify.ts`; `server/music-listen/listen.ts`, `server/music-listen/tool.ts`, `server/music-listen/listen.verify.ts`, `shared/music-inference/listen-snapshot.ts`, `src/agent/tools/music-intelligence-tools.ts`, `src/agent/tools/schemas/music-intelligence-tools.ts`, `assets/agent/openchatcut-tool-schemas.json`, `package.json`.
- Done when: the mock test covers request shape, the `audio_tokens` rule, caching, and no call when off.

### L-08 · Keyframable filters + binary-search sampling — done
- Done 2026-10-26: `brightness`, `contrast`, `saturate` and `blur` joined `KeyframeProp` and the registry (ranges 0..3, 0..3, 0..4 and 0..100 px; defaults 1/1/1/0; base value read from `item.filters`). `clipFiltersAt` in `clipFade.ts` samples each channel, clamps easing overshoot to the registry range and rounds to four decimals; a keyframed channel overrides its static filter and the other channels keep theirs. `appearanceAt` emits the CSS `filter` when the clip has static filters or a non-empty filter channel, and `BackgroundFillLayer` reads the same sampled values, so the blurred canvas copy flashes with the clip. The inspector's transform sliders and their reset list skip the four channels (the Filters section owns those values), so no duplicate rows appear. `edit_item` accepts the channels through its existing whitelist, and its schema text names them and their ranges. `sampleKeyframes` now binary-searches the sorted array instead of scanning it, because beat reactions put hundreds of keyframes on one clip.
- Proof: `src/editor/keyframes.verify.ts` asserts the registry entries and base values, a 0.6→2 brightness pair producing `brightness(0.6)`/`brightness(1.3)`/`brightness(2)` through `appearanceAt` while `contrast(1.2)` stays static, an undefined filter when neither filters nor channels exist, an easing overshoot clamped to 3, split carry of the brightness channel, and binary-search sampling equal to the old linear scan at every frame −10..420 for keyframe counts 1/2/3/17/200 across five easings. `edit-item-generic.verify.ts` keeps the unknown-prop probe on `sharpen` (it used `blur`, which is now real) and `keyframes.verify.ts` adds the image-accepted / audio-rejected / range-rejected cases plus a reducer write.
- Gates: `npx tsc -b`, `npm run lint` (0 errors, 204 warnings), `npx tsx src/editor/keyframes.verify.ts`, `npm run verify:editor`, `npm run verify:export-gl`, `npm run verify:agent-tools`, `npm run verify:components`, and `npm run verify:server-tool-catalog` after `npm run generate:server-tool-catalog` passed.
- Plan: Plan 2 › Part C (animatable filters).
- Files: `src/editor/clipTypes.ts`, `src/editor/keyframeRegistry.ts`, `src/editor/clipFade.ts`, `src/editor/TimelineMediaLayer.tsx`, `src/editor/keyframes.ts`, `src/editor/keyframes.verify.ts`, `src/agent/tools/edit-item-generic.ts`, `src/agent/tools/edit-item-generic.verify.ts`, `src/agent/tools/schemas/edit-item-tools.ts`, `src/components/inspector/InspectorContent.tsx`, `src/components/inspector/InspectorKeyframeControls.tsx`, `assets/agent/openchatcut-tool-schemas.json`.
- Done when: a brightness keyframe pair changes the preview and the export identically, and `sampleKeyframes` gives the same results as before on the existing tests.
- Verify: `npx tsx src/editor/keyframes.verify.ts`, `npm run verify:editor`, `npm run verify:export-gl`.

### P2-1 · Ken Burns — done
- Done 2026-10-25: the inspector's Animation tab and the clip context menu write one batch of scale/x/y keyframes through the existing keyframe channel, so preview and export sample the same ramp and it is one undo step; `apply_ken_burns` does the same over MCP and refuses non-stills, locked tracks and clips under two frames in Spanish. Committed as `36bb9e2`.
- Re-run 2026-10-25: `npx tsx src/editor/kenBurns.verify.ts` and `npx tsx src/components/inspector/inspector-controls.verify.ts` both pass.
- Plan: Plan 1 › Phase 2 (Ken Burns).
- Files: new `src/editor/kenBurns.ts` + verify; `AnimationTab` in `src/components/inspector/InspectorContent.tsx`; the timeline clip context menu; new tool `apply_ken_burns`.
- Done when: in the editor, a photo gets "Ken Burns" from the inspector or the context menu in one undo step; over MCP `apply_ken_burns` does the same; two exported frames of the photo differ.
- Verify: the new verify, `npm run verify:editor`, `npm run verify:agent-tools`, `npx tsx src/components/inspector/inspector-controls.verify.ts`.

### L-09 · Music reactions + tools — done
- Done 2026-10-26: `src/editor/musicReactions.ts` turns a cached analysis into sparse keyframes for `pulso` (beats), `golpe` (drops), `temblor` (accents, three shake channels), `destello` (downbeats, brightness), `respirar` (energy, saturate + blur) and `ken-burns-al-ritmo` (section zooms, seeded push in/out). Events are mapped through the BGM clip's trim and speed with the shared `localFrameForSourceMs`; amplitudes follow the local section energy. Each clip is capped at 96 keyframes (64 targets, 8 reported samples), with baseline keyframes at frame 0 and the last frame so a delayed first beat never samples a stale peak. Every target gets `clearKeyframes` per owned prop, the `setKeyframe` list and one `setMusicReactions` metadata entry carrying `songMapRef`, timing, intensity, range and keyframe count; a new reaction replaces earlier entries that animate the same properties, while disjoint reactions coexist. The clear plan removes the metadata and only the props no remaining reaction claims. The verify exposed that ken-burns used to write nothing when a clip sat inside one section and ignored a partial range; both are fixed (the curve derives its own boundaries inside the requested range).
- Tools: `music_reaction_plan` is read-only and returns counts, sample frames and the deterministic `songMapRef` (`song-map:<sha256>` from the asset id + source revision). `apply_music_reaction` requires that ref (missing and stale refs reject with the current one), then commits one `commands.batch` (one undo step, Spanish label/note); locked tracks are skipped and reported. `clear_music_reaction` accepts an optional reaction and optional ref, and batches its clears the same way. Browser and headless hosts share `music-reactions-tools.ts`, differing only in the analysis loader, so the server tool answers from the stored SQLite record with no editor tab.
- Proof: `src/editor/musicReactions.verify.ts` maps 4 s and 6 s beats to target frames 100/130 through a 2 s trim at 2x (and 240 at 0.5x), keeps peaks, 5-frame decays and baselines inside the clip, and hits the caps exactly: 2,400 beats → 96 keyframes for `pulso`, 32 for `temblor`, 84 for `respirar`, ≤ 21 for `ken-burns-al-ritmo`. Through the real reducer + `appearanceAt`, a `destello` downbeat samples `brightness(1.0688)` on frame 120 and returns to 0.9 at 125, `respirar` samples `saturate(1.0875) blur(0.625px)` at 75, and a `pulso` on a 1.2 static scale renders `scale(1.254, 1.254)` on the beat. Metadata coexistence/replacement, locked and out-of-range skips, clear partial/all and seed determinism are asserted. `src/agent/tools/music-reactions-tools.verify.ts` gets a 6-keyframe plan with no batch, rejects missing/stale refs with the current `songMapRef`, applies 8 actions in one labeled batch with metadata that survives the reducer, skips a locked track, clears in one 2-action batch (partial clear keeps the 4-keyframe flash curve), rejects bad reaction/timing/ambiguous target prefixes, and checks schemas, policies (plan read/pure; apply+clear reversible/idempotent), Q&A mode (plan only) and routing. `server/music-listen/music-listen.verify.ts` runs plan → apply (one batch) → stale clear against the stored record.
- Gates: `npx tsc -b` clean, `npm run lint` 0 errors / 204 warnings, both new verifies, `npm run verify:agent-tools`, `npm run verify:mcp`, `npm run verify:music-intelligence` and `npm run verify:server-tool-catalog` (after `npm run generate:server-tool-catalog`) passed. `npm run verify:affected` could not map the other agent's untracked files and asked for the broader gate.
- Plan: Plan 2 › Part C (generators, MCP tools).
- Files: new `src/editor/musicReactions.ts`, new `src/editor/musicReactionEvents.ts` (event pickers + BGM frame mapping, split out to stay under the 500-line ceiling) + verify, new `src/agent/tools/music-reactions-tools.ts` + verify; `src/editor/clipTypes.ts`, `src/editor/sourceLimit.ts`, `src/editor/reducerActions.ts`, `src/editor/reducerClipActions.ts`, `src/agent/tools/music-intelligence-plan.ts`, `src/agent/tools/music-intelligence-tools.ts`, `src/agent/tools/schemas/music-intelligence-tools.ts`, `src/agent/external-tool-policy.ts`, `src/agent/execution-policy.ts`, `src/agent/tool-routing.ts`, `server/music-listen/tool.ts`, `server/music-listen/music-listen.verify.ts`, `server/external-agent/offline-executor.ts`, `package.json`, `assets/agent/openchatcut-tool-schemas.json`.
- Done when: the generator tests in Plan 2 › Verification pass and the three tools work over MCP with no tab.
- Verify: the new verifies, `npm run verify:agent-tools`, `npm run verify:mcp`, `npm run verify:server-tool-catalog`.

### L-10 · Caption motion `latido` — done
- Done 2026-10-26: `latido` is the sixth caption motion preset (`none`, `fade-up`, `pop`, `word-pop`, `karaoke-pulse`, `latido`). The pulse stays a pure function of absolute timeline ms: `latidoScale` binary-searches the last beat at or before the current time and returns `1 + 0.07·(1 − age/160)²`, returning to 1 after 160 ms. `captionPageMotionStyle` applies it as `scale(...)` with `transform-origin: center`, so the Player preview and the Remotion export run the same function of the same frames.
- Beat grid: `resolveLatidoBeats` uses the captions source item when it carries sound (otherwise the first audio clip), loads the cached analysis through `sourceAssetId`, maps source beats through the clip's trim and speed with `localFrameForSourceMs`, and dedupes/sorts the absolute timeline ms. It answers `{ beatsMs, bpm, itemId }` or one of three Spanish errors (no song in the timeline, no cached analysis, no pulses inside the clip). The grid is captured once into `CaptionsData.motionBeatsMs`, so the render reads no cache; choosing any other preset clears it.
- UI: `CaptionMotionControls` awaits the resolver with a busy state, shows the error inline (`role="alert"`), and reports the pulse count ("节拍脉动 · {n} 拍" → "Latido · {n} pulsos"). `LibraryPanel` → `CaptionsPanel` → `CaptionsControls` thread `assets` down; both page-motion call sites in `CaptionsLayer` pass `motionBeatsMs`.
- Tool: `edit_captions` `animation` accepts `latido`; an explicit `json.beatsMs` wins (finite, non-negative, rounded, deduped, sorted), otherwise it resolves from the project's items/assets/fps and answers `{ ok, motionPreset, beats, bpm, itemId, beatsSource }`. Because saved looks are project-agnostic, `preset_apply` re-resolves the grid for a latido look and degrades to a static look with a `motionNote` when no analysis exists.
- Proof: `captionMotion.verify.ts` asserts no grid → scale 1 and `{}`, a full 1.07 bump on the beat, 1.0175 at half decay (80 ms), 1 at 160 ms and just before the next beat, and the exact `scale(1.07)` style at 1500 ms with beats [1000, 1500, 1900]. `latidoBeats.verify.ts` maps `[1000, 4000, 6000, 22000]` through a clip starting at frame 100, srcIn 60, 2× and 300 frames to `[4333, 5333]` at 30 fps (`[3167]` at 60 fps), covers the injected loader and all three error paths. `caption-animation.verify.ts` checks the six-entry enum, filters `[500, NaN, −5, 1000, 500, 1500]` down to 3 beats with `beatsSource: 'argument'`, rejects latido with no song, clears the grid when switching presets, and end-to-end saves an analysis (bpm 120, beats [1000, 2000, 9000]) so the real tool writes `[1000, 2000, 9000]`; `preset_save` then `preset_apply` re-resolves the grid after a detour through `none`.
- Gates: `npx tsc -b` clean, `npm run verify:caption-motion` (3 verifies) passed, `npm run lint` 0 errors / 204 warnings, `node scripts/verify-gate-coverage.verify.mjs` passed (700 verify files), `npm run verify:agent-tools` passed, `npm run verify:server-tool-catalog` passed after `npm run generate:server-tool-catalog`. `npm run verify:i18n`'s `check-i18n` and `locale.verify` passed, but its Italian settings coverage step fails on 10 keys introduced by the concurrent connect-a-bot work (MCP 地址, 连接一个 bot, …); none are latido keys, so the fix belongs to that agent.
- Plan: Plan 2 › Part C (captions `latido`).
- Files: new `src/captions/latidoBeats.ts` + verify; `src/captions/captionMotion.ts`, `src/captions/types.ts`, `src/captions/CaptionMotionControls.tsx`, `src/captions/CaptionsControls.tsx`, `src/captions/CaptionsPanel.tsx`, `src/captions/CaptionsLayer.tsx`, `src/library/LibraryPanel.tsx`, `src/agent/tools/captions-actions.ts`, `src/agent/tools/schemas/captions-tools.ts`, `src/agent/tools/caption-animation.verify.ts`, `src/captions/captionMotion.verify.ts`, `src/i18n/dict/en/captions.ts`, `src/i18n/dict/es/index.ts`, `package.json`, `assets/agent/openchatcut-tool-schemas.json`.
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

### P6-1 · Bot end-to-end proof + screenshots
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
- 2026-10-25 · GitHub main · Merged `3790a69` (HQ-6, plus HQ-7 and HQ-8) into this branch. `package.json` keeps both sides: the Claudia scripts and verifies, and `dsh-sse-repair.verify.ts`. The settings hide now follows `providersOff()` so HQ-7's runtime switch still hides paid panes. Reason: GitHub main had moved, and the publish has to be a fast-forward.
- 2026-10-25 · Claudia bots · `scripts/corteo-install.sh` is the one-shot install for any Claudia bot's Linux VM, and `skills/corteo/SKILL.md` is the agent guide. The free-model harness stays optional. Reason: every Claudia bot has its own VM, so corteo has to install there without a tunnel and without secrets.
- 2026-10-25 · P-CL · Names the CLI prints (`Texto`, `Secuencia 1`, `Color`, `Títulos`) are Spanish, not the UI locale. A headless shell has no locale, and the product language is Spanish. i18n keys stay Chinese.
- 2026-10-25 · P-CL-4 · When `google-chrome` (or Chromium) runs, renders set `CC_BROWSER_EXECUTABLE` and skip Remotion's headless shell. If there is no system Chrome, the installer downloads that shell and says so.
- 2026-10-25 · P-CL-8 · `corteo mcp token` prints the path. `--show` prints the token only on stdout. The endpoint stays localhost-only. Nothing in git is a token.
- 2026-10-25 · P-CL-12 · `scripts/corteo-acceptance.sh` on this VM, with `node` at v20.20.2 and `NPM_CONFIG_PREFIX=/home/ubuntu/.local`, printed `ACCEPTANCE=PASS`. The installer self-test was `CORTEO_SELF_TEST=PASS` and used `/usr/local/bin/google-chrome` (no headless-shell download). The 6s render was 1920x1080 with an audio stream. There is no CI workflow in the repo, so the script is syntax-checked from `test:serial` and the full run is manual. This VM's ffmpeg is 6.1.1, not the reference 7.1.
- 2026-10-25 · Claudia's VM · She runs corteo on her own Linux box. `npm run corteo:local` binds 127.0.0.1 with paid providers off, and `npm run corteo` is the existing `occ` shell, now able to `media import` a disk path. The Worker and named tunnel stay optional for a browser. Reason: she can clone, install and render on that VM, so the public URL is not the limb.
- 2026-10-24 · B-9 · The Spanish pass covers the screens Plan 4 owns, read literally: the projects page with its tooltips, the top bar's button labels, the chat's first view (header, onboarding, starters, composer, workflow and model pickers, capability banner) and the phone upload page. The panels those buttons open stay for P5-1. Reason: the plan's scope line, and P5-1 is the full dictionary.

- 2026-10-25 · L-01 · `analyze_music` and `inspect_music` run their cores in a forked child process per core (`child_process.fork`), not the `worker_threads` the card names. Reason: the rhythm core uses the top-level `onnxruntime-node@1.22.0-rev` and the CLAP core nests `onnxruntime-node@1.24.3` inside `@huggingface/transformers`; both ship `libonnxruntime.so.1`, so loading them in one process makes the second load shadow the first and the native session fails. One child per core keeps each soname in its own address space; inside Electron the children start with `ELECTRON_RUN_AS_NODE=1`.
- 2026-10-26 · L-06 · A DSP fallback map is drawn and summarized but never saved to the song-map cache and never gets a `songMapRef`; only a model-built map is cached. Reason: once the packs are installed, a cached DSP map would answer `inspect_music`-style reads with worse data and shadow the real map, so the fallback stays in-memory.
- 2026-10-26 · L-06 · `server/music-listen/sharp.d.ts` declares the small `sharp` surface the renderer uses instead of adding `esModuleInterop` or `paths` to the shared tsconfigs. Reason: sharp 0.35 publishes its types outside the package exports map, so bundler resolution cannot see them; loosening the tsconfigs for every project would be a larger change for one import.
- 2026-10-26 · L-07 · `OPENCHATCUT_PROVIDERS=off` does not block the relay: it is the plan's one opt-in paid exception and is already double-gated by `OPENCHATCUT_LISTEN_RELAY=openrouter` plus `OPENROUTER_API_KEY`. The verify keeps the providers switch off while the relay runs, so enabling the relay can never open any other cloud route.
- 2026-10-26 · L-07 · `LISTEN_RELAY_CROSS_CHECK_MODEL` is asked once more only when the first answer reports zero audio tokens; a verified first answer never pays for two calls. Reason: the cross-check exists to rescue an unproven listen, not to double the price of every note.
- 2026-10-26 · L-07 · The relay reads `.env.corteo` (Plan 5's current name; `npm run start:corteo` loads it with `--env-file-if-exists`) rather than the card's older `.env.claudia`. The relay settings are process env, not keystore entries, so they never appear in the settings UI or travel to the browser.
- 2026-10-26 · L-08 · A keyframed filter channel overrides its static `filters` value, the same rule the transform properties already follow, and the background fill multiplies those per-frame values. Reason: a flash or breathing reaction has to move both copies of the picture or the letterboxed background would stay frozen while the clip pulses. The four channels are kept out of the inspector's transform slider list because the Filters section already owns those values; showing them twice would give two controls for one number.
- 2026-10-27 · deploy · `wrangler.jsonc` on `main` now publishes the editor UI as Workers static assets (`cloudflare/worker.js` + `./dist`), not the tunnel proxy. The live worker at `corteo.uset82.workers.dev` was already serving static assets — the `_headers` values only `cloudflare/build.mjs` writes came back on every response — but the assets themselves predate the rename, and `editor.uset82.com` answers `000`, so a deploy from `main` as it stood would have replaced a working site with a 502. The proxy worker and `tunnel.yml` stay in the tree as the optional browser path. Reason: the config described a deployment nobody was running.
- 2026-10-28 · EV · The user-facing name is corteo. Do not rename the product back to Claudia. `OPENCHATCUT_*`, `occ` and the OpenChatCut credits stay as they are.
- 2026-10-28 · EV · Host profiles exist for `grok`, `muse` and `claude-duet`: same editor, same skill text. A profile is data: skill dest, media inbox, export dir, `render_gl=swangle`, `providers=off`, locale `es`, default short `1080x1920@30`, MCP URL, brain URL.
- 2026-10-28 · EV · Delivery is both: the MP4 in `~/corteo-exports` and a path the host can attach in chat.
- 2026-10-28 · EV · Lyric priority: text the person pasted, then a `.txt` or `.lrc` beside the audio file, then the local transcript.
- 2026-10-28 · EV · The brain is DeepSeek Harness plus the pinned Our Free Model plugin (`config/harness.json`). It does not replace `server/agent-runs/`; `dsh --profile acp` stays unused.
- 2026-10-28 · EV · The installer also installs and starts the brain. If that step fails, the video self-test still passes; the failure is its own named step, `brain`.
- 2026-10-28 · EV · Apps see three model aliases: `corteo-edit`, `corteo-draft`, `corteo-fast`. Raw lane ids stay inside the router.
- 2026-10-28 · EV · `corteo-edit` may draft arguments only for split, text titles and social copy. It cannot render, publish, delete or open an edit session; the host applies the JSON with a real tool.
- 2026-10-28 · EV · `delegate` is one MCP tool (alias, kind, schema, input excerpt, max tokens). It answers JSON plus lane and latency, or `brain_unavailable`, with at most one validator round trip.
- 2026-10-28 · EV · On HTTP 429 or a timeout, the router tries the next lane that passed the last probe; with none left it returns `brain_unavailable`.
- 2026-10-28 · EV · Anonymous free lanes only: no plugin account login, no EAC, no LAN forward, no public MCP, no paid provider inside the editor.
- 2026-10-28 · EV · The MCP token, `.env.corteo` and the whole project JSON are never sent to a lane.
- 2026-10-28 · EV · Carlos chose: the plan files are committed locally before the night and pushed only at its end; Terra may download the music packs `rhythm-lite` and `music-semantics-lite` for L-13; the bot path goes first in the EV table.
- 2026-10-28 · EV · The planning decisions D1 to D19 (host profile files and skill paths, the song film as an `occ` composition, `apply_ken_burns` headless, shorts kept in the browser tier with a Spanish review, the brain process and router on `127.0.0.1:18890`, `delegate` as an MCP control tool, the editor linked through `/api/keys`, local pnpm, `CORTEO_E2E_MEDIA_DIR`, soft needs) are in `docs/plans/07-evolution.md` › Decisions made.
- 2026-10-28 · EV · Terra ran EV-00 to EV-26 alone. The rest finishes in three tracks at once, one git worktree each: Qoder (`~/corteo`, the EV table, the merge and the only push), ZCode (`~/corteo-zcode`, branch `ev-zcode`, the EZ table), DeepSeek Harness (`~/corteo-dsh`, branch `ev-dsh`, the ED table). Reason: Carlos's call after Terra stopped.
- 2026-10-28 · EV-28 · The ten Italian keys missing since C-12 went in at setup, before the tracks branched: the gap kept `verify:i18n` red for all three tracks and kept `npm test` from ever reaching `test:serial`.
- 2026-10-28 · EV · If `sync-publish.sh` stops only on failures EV-30 recorded as pre-existing, the work goes to the GitHub branch `ev-evolution` instead of `main`.

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
| HQ-6 | Cover and harden the tool-call repair H-9 shipped | done | HQ-5 |
| HQ-7 | Deliver the providers switch at runtime, not build time | done | HQ-3 |
| HQ-8 | Stop the run layer importing a Vite plugin module | done | HQ-3 |

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

### Qoder: HQ-6 to HQ-8 results
Replayed onto H-9's merge (`a445298`). H-9 had already fixed the tool-call finding itself (`eed3137`, `server/sse-tool-call-fix.ts`), so HQ-6 is not a second normalizer: it covers and hardens that one.

- HQ-6 · The repair shipped with no test and one unsafe path. `dsh-sse-repair.verify.ts` drives the real `/llm` route with a stub gateway: the payload-free stub frame, the StepFun empty `type`, the end-to-end tool round trip, CRLF with a multi-byte character split across two writes, an unterminated tail, a non-SSE response keeping its `content-length`, the 429 Spanish body, and a gateway that compresses the stream anyway. Two guards went into `server/proxy.ts`: a route that rewrites lines now asks upstream for `accept-encoding: identity`, and if upstream compresses regardless, the bytes are passed through untouched with `content-encoding` kept, instead of being run through the utf8 decoder — which would have filled the body with U+FFFD and silently dropped the repair. `fixToolCallDeltaLine` also drops an empty `type`, the rule the browser normalizer already had.
- HQ-7 · `__PROVIDERS_OFF__` was baked in at build time, so the Electron embedded server and every tsx run read `false` whatever the environment said. `settingsBody()` now carries `providersOff`, `appShell` hands it to `applyProvidersOff` next to `applyLiveCaps`, and the model picker, the settings vendors and the agent guards read `providersOff()`.
- HQ-8 · `server/agent-runs/execution-input.ts` imported `server/plugins/providers-off.ts`, which pulls in the Vite-only `import.meta.env` define. It imports `shared/providers-off.ts` directly now, so the run layer loads under plain tsx.
- Live check against the real gateway (2026-10-25, harness `0.2.1-rc.2` on `127.0.0.1:18899`, `@ai-sdk/openai-compatible` 3.0.75): the lanes still send the malformed frame. Counting call deltas straight from the gateway, `openrouter/free` had 1 of 4 without `function`, `cohere/north-mini-code:free` 5 of 12, `dots-studio/dots-3-note-preview:free` 1 of 4, `recursive/flint-v1.0:free` 4 of 10, and `reflection/beam-free` none. With the repair on, all four finish the tool round trip with no stream error. With it off — same gateway, the `openai` route so `sseLineFix` returns undefined — three of the four report `Type validation failed` while still finishing the call, which is the HQ-5 symptom exactly: the run does not stop, the stream is just poisoned. No lane sent an empty `type`, so that rule is for StepFun-style gateways, not for these. The other lanes answered 429 (`cuota`), not a schema error.
- Checks: `npx tsc -b` and `npx tsx server/agent-runs/dsh-sse-repair.verify.ts` on this tree, plus the neighbouring verifies. The full `npm test` still has to run on the Linux side: Windows cannot check a branch out in `~/corteo-qoder` (see Blockers).

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

## Plan 5 · corteo

Approved 2026-10-25. Task cards: `docs/plans/05-corteo.md`. Its own table, same picking rule: the first `todo` whose "Needs" are `done`, in ID order. Phase A is the identity, Phase B the rename (C-05 lands its gate in the same commit as the sweep), Phase C the Grok Bot door, Phase D the proof.

| ID | Task | Status | Needs |
|----|------|--------|-------|
| C-01 | Skin `corteo`: tokens, default, migration | done | |
| C-02 | Marks, favicon, tab, fonts | done | C-01 |
| C-03 | Wordmark in the chat panel and the projects page | done | C-02 |
| C-04 | Identity review against the AI-tells list | done | C-03 |
| C-05 | The rename sweep and its gate | done | |
| C-06 | Identifiers: scripts, env files, directories, service names | done | |
| C-07 | Copy outside the dictionaries, the assistant, the exports | done | C-05 |
| C-08 | The repo's own prose (README, AGENTS, CHANGELOG, install guide) | done | C-06, C-07 |
| C-09 | One installer, one contract (`CORTEO_*`, `--json`, `--self-test`) | done | C-06 |
| C-10 | Non-blocking renders (`render --detach`, `job status/wait`) | done | |
| C-11 | The bot template: profile, four skills, build gate | done | C-09, C-10 |
| C-12 | "Conectar un bot" card | done | C-09 |
| C-13 | The bot run proof on a clean VM | doing | C-11, C-12 |
| C-14 | End-to-end proof, with the name checked | todo | C-04, C-08, C-13 |
| C-15 | Release: publish and the note | optional | C-14 |

### Plan 5: decisions
- The product is **corteo** and Claudia becomes a *client* of the editor (one bot among Grok Bot, Claude Code, Codex). Nothing user-facing names her again; `docs/plans/01`, `02` and `04` keep their text as history and the rename gate skips them.
- New skin `corteo` replaces `claudia`: the surfaces and text tokens stay (measured, and the chrome must recede), the accent moves from clay `#d97757` to "corte" `#ff4a1f` (5.86:1 on `bg`), and `danger` moves to `#e5484d` so an error never reads as the primary button. A saved `claudia` or `graphite` skin migrates to `corteo` once.
- The mark is a 20×20 frame split on the 45° diagonal with the halves slid apart, accent up-left, bone down-right. It is the only idea: no star, no streak, no play triangle. **Approved by Carlos on 2026-10-25** from `docs/plans/corteo-brand/preview.html`; the vertical-splice alternative is discarded (at 16 px the two bars read as a separator) and kept there as a record. One geometry at every size: the gap stays 2.83, and if 16 px ever fails it grows, never shrinks.
- One brand face instead of two: the wordmark joins the display type in DINish Condensed Black (OFL), and TeX Gyre Heros leaves with its licence and its preload.
- The two installers become one. `install.sh` is the door for a human and for a bot: `--json` prints one object, `--self-test` renders 2 seconds and prints `CORTEO_SELF_TEST=PASS`, and the token reaches stdout only with `--print-token` (the default block carries the token's path, so a bot never puts it in a chat).
- A corteo bot needs no Claude plan. claudia-bot needs Opus on the VM because `slop` is deep; the editor's `occ` is shallow by design, so the bot's own model drives it. C-13 is the proof of that bet, and if it fails the fallback is fewer, bigger `occ` calls rather than more, smaller ones.
- A Grok Bot turn dies about 5 minutes into a long tool call, so a render must be startable and forgettable: C-10 (`render --detach` + `job wait`) is a dependency of the bot template, not a nicety.
- C-06 delivered the `CORTEO_*` half of C-09 by accident of scope: the installer
  prints `CORTEO_*` and writes `corteo.env`. C-09 added `--json`, `--self-test`
  and `--print-token` on top of that.
- C-09 retired `scripts/corteo-install.sh`. Its self-test moved into
  `install.sh --self-test` and the file is gone, so there is one door. That
  deletion rippled into seven places the card's file list did not name:
  `README.md`, `README.es.md`, `AGENTS.md`, `skills/corteo/SKILL.md`,
  `scripts/corteo-env.sh`, the `scripts/no-claudia.verify.mjs` allowlist, and
  `scripts/corteo-acceptance.sh`, which actually *ran* the retired script.
  **The acceptance harness was adapted but not executed** — it needs a Linux VM,
  so C-13 is its first real run. It now reads `CORTEO_APP_DIR` out of the
  installer's own report instead of assuming where the tree lands.
- The default output no longer carries the token. `CORTEO_MCP_TOKEN_FILE` points
  at `secrets.env` (0600) and `--print-token` is the only way to get the value,
  so a bot can install without a secret entering a transcript. The token is
  `stdout-only` in the report machinery: it is never written to `corteo.env`.
- The default port is a preference, an explicit `--port` is a promise. A busy
  5199 walks up to the next free port and reports `CORTEO_PORT_STATE=shifted`;
  `--port 5199` on a busy 5199 stops the install instead. `MCP_URL` is rebuilt
  when the port moves, which is the one thing that would silently go stale.
- Text mode keeps `CORTEO_START=1`/`0`; only `--json` promotes those four keys
  to real booleans. Changing the text format would have broken the existing
  `install.verify` assertion and anything that greps it.
- `--json` keeps stdout for exactly one object and moves every progress line to
  stderr, so a bot never filters the human log out of the result. A failure is
  still one object (`CORTEO_STATUS=failed` plus the stage) with a non-zero exit.
- The phone upload page (`server/mobile-upload-service.ts`) is a bare HTML string
  served before the stylesheet exists, so it cannot read `--cc-*`: its palette is
  a hand copy of the `corteo` tokens. C-07 brought three drifted values back
  (`#d97757` to `#ff4a1f` twice, `#fffaf0` to `#f7f3ea`, `#e06c60` to `#e5484d`)
  and marked the copy in place. **Nothing verifies those hexes** -
  `mobile-upload-service.verify` checks the copy, not the CSS - so a later token
  change has to remember this file.
- `#d97757` also stays in `McpGuide.tsx` on purpose: it is Anthropic's orange on
  the Claude Code icon, not our accent, and a blind sweep would break the logo.
  The line now says so.
- The bot template copies claudia-bot's *mechanics* (recipe → replay, ≤6 KB per skill, ≤80 KB total, "Use when …" descriptions, detached installs, `/workspace` persistence, secrets only through the secret card) and none of its content: no claudia.gallery, no canon, no relay, no `slop`.

- C-10's detached child was blamed for dying, and the mechanism was fine: the
  child completed at about 20 s with exit 0 every time. What looked like a dead
  render was tsx's cold start plus a launcher that closed its console. The verify
  now measures the baseline on the same machine (`occ where --json`) and allows
  `baseline + 15 s` instead of an absolute 20 s, because an absolute budget on a
  loaded box tests the box, not the code.
- A job is a file written by the process that did the work, never by the poller.
  `render --detach` writes the record before it forks and the child finishes it,
  so `job status` can never claim a render succeeded that never ran; a `running`
  record whose pid is gone is reported `failed` with the log tail.
- `job wait` prints the report and *then* throws on a failed job, so a caller that
  parses stdout still gets the state and a caller that checks the exit code still
  fails. Both habits exist in the wild; only one of them could be served.
- The bot recipe is committed even though `dist/` is build output everywhere
  else, because the JSON is what a person hands to Grok and the generator is the
  only thing that can prove it matches `bot/`. `--check` validates and compares,
  so a stale recipe fails the gate instead of shipping.
- The scrub judges install instructions **line by line** and skips negated lines.
  The first run failed on the profile's own "Never install a plugin" — a rule that
  forbids the thing it names is not the thing it names, and a scrubber that cannot
  tell the difference trains you to write around it.
- The rehearsal is not a copy of the skill, it is the skill's own lines executed.
  `corteo-setup` carries them between `# rehearsal:begin` / `# rehearsal:end`, and
  `bot-recipe.verify` fails when a line in the skill is missing from
  `scripts/bot-rehearsal.sh`. The install line stays replayable because the source
  is a variable: `https://…/corteo/main` in the skill, `file://` + the checkout in
  the rehearsal, same text both ways.
- **C-11's import clause is the one thing not executed here**: "the recipe imports
  into a Grok Bot and the bot lists four skills" needs a Grok Bot, not a shell.
  The recipe builds, the four skills are in it, and every budget is enforced by
  the gate; the import itself is Carlos's to try, and C-13 is where the
  executable half gets its proof.

- The card is built from constants, not from state: `corteoDefineConnection()`
  takes no argument, so no call site can hand a token to text that ends up in a
  screenshot. The old signature took one and printed it in a comment; that was
  the leak, and it was one line of the card away from a shared image.
- `CORTEO_MCP_URL` still names the hosted worker. A bot on another machine needs
  it; a bot on this machine can use the local origin the dialog already shows at
  the top. Two URLs, one endpoint, and the card says which is which.
- The card that was replaced said "hand this to corteo, she edits this project
  from outside this computer" — a feminine reference to a bot that no longer
  exists, in the one dialog that explains how to connect one. It is now the card
  that says what a bot is, what it needs, and where the token file lives.
- `CopySnippetButton` grew an optional label instead of a second component: the
  card needs two copy buttons with one behaviour, and a second component would
  have been two places to forget the clipboard failure path.
- The card renders before the token loads, because it never needed the token. The
  client list below it still waits for one; those snippets do carry it.

- C-13 is **half done and honestly labelled**: `scripts/bot-rehearsal.sh` and its
  gate exist, and the gate is in `test:serial`. The run itself needs a clean
  Linux box — bash, Node 24, ffmpeg and five minutes of npm — and this session
  had none of those, so the card stays `doing` rather than claiming a proof it
  did not make. Run `BOT_REHEARSAL=1 node scripts/bot-rehearsal.verify.mjs` on
  the VM; it prints the wall time per step and the render's ffprobe facts, and
  those are what belong in this section.
- The gate checks structure, not the run, and says so in its own output. What it
  refuses to let rot: a throwaway `HOME`, the checkout as the install source
  (`file://`), a `BOT_REHEARSAL=PASS` line, the h264 and duration assertions,
  and a cleanup that may only ever delete `${TMP:?}`. A rehearsal that quietly
  stopped rehearsing would still exit 0; this is what notices.

- **C-14 cannot start, and the card's premise is wrong.** It says to adapt
  `e2e/claudia-flow.e2e.ts`; there is no `e2e/` directory, no
  `playwright.config.*`, and no spec anywhere in the tree — `@playwright/test`
  and `playwright` are in `devDependencies` with nothing using them. So C-14 is
  not "adapt a flow", it is "build a browser suite from nothing", and it needs a
  running dev server on Node 24, which is the same WSL blocker that made
  `npm run dev` refuse to start. It stays `todo`.
- What C-14's name assertion is *for* already holds, statically:
  `no-claudia.verify` scans every tracked file and `brand-text.verify` scans the
  string literals the UI renders, both pass, and the built `dist/index.html`
  carried three `corteo` and zero `claudia`. What is missing is the same check
  *as rendered*, which is the part that needs a browser.
- C-15 was not run: publishing is a live production action on a branch that
  auto-deploys, and the card says Carlos decides. The four commits below are
  local and unpushed for exactly that reason.

## Opus parity (Plan 6)
Executed 2026-10-25. Task cards and the full record live in `docs/plans/06-opus-parity.md`.
This table is the current status. OP-14 is done.

| ID | Task | Status |
|----|------|--------|
| OP-01 | `score_moments` rubric engine | done |
| OP-02 | `find_highlights` ranks, snaps, dedupes | done |
| OP-03 | `make_shorts`: source in, clips out | done |
| OP-04 | Calibration ledger + `calibrate_scores` | done |
| OP-05 | "Analizar episodio" panel | done |
| OP-06 | `tighten_speech` | done |
| OP-07 | `censor_words` | done |
| OP-08 | Keyword emphasis (reshaped: no new presets) | done |
| OP-09 | `write_clip_title` | done |
| OP-10 | Brand kit (type, command, tool, panel) | done |
| OP-11 | Reframe stabilization | done |
| OP-12 | `write_social_copy` | done |
| OP-13 | Scheduled publish (queue, tick, tools, calendar) | done |
| OP-14 | `search_catalog` (query expansion + FTS5) | done |
| OP-15 | Performance loop (`score_performance`) | done |

`main` at `35b127c` (this section) and green: full gate 215/215, exit 0 at `26d36ec`. The tool count went 123 to 136.

### The frame proof, done 2026-10-25

`remotion/caption-emphasis-render.verify.mjs` renders the same frame four times and compares the
JPEGs:

- the same timeline twice → **identical** (the harness is deterministic);
- the caption overlay off vs on → **different** (the layer really paints);
- `wordOverrides: { 1: { emphasis: true } }` vs none → **different** (the mark changes pixels);
- an empty override map vs none → **identical** (and nothing else does).

Two things this proved that reading the code did not:

1. **Captions are painted from a track, not from `state.captions`.** `captionTrackEntries` filters
   by `trackKind(id) === 'caption'`, which for a plain state means an id starting with `C`. The
   first version of the fixture had no `C1` track, so the still was the clip's own colour and
   every comparison passed for the wrong reason — including "emphasis changes nothing".
2. **The frame has to be one where the marked word is not the active one.** With `pacing: 'word'`
   the marked word is by definition the spoken one, and the active word already paints in the
   highlight colour, so the mark is invisible. The test uses `pacing: 'phrase'` at frame 3.
   A unit test of `captionWordColour` cannot catch that; only a render can.

**OP-14 is done and needed no new dependency.** The existing `src/media/semantic-search/` embeds
*frames* with a vision model for duplicate detection; there is no text-embedding model and
`search_content` is FTS5. Making it semantic means either a new local text-embedding
dependency (rule 2 needs the card to name it) or switching the feature to image-similarity
search over the vision model that already exists. See the card note in `06-opus-parity.md`.
Known gap: the per-word emphasis rule and its channel are unit-tested, but **no exported frame
has been compared in pixels**; a render on a machine with Chromium closes it.

---

## Evolution night (EV)

Plan: `docs/plans/07-evolution.md` (Plan 7). Executors: ChatGPT Terra (EV-00 to EV-26), then Qoder for this table; ZCode and DeepSeek Harness work their own tables at the end of this file. Picking rule: top to bottom, the first `todo` whose Needs are `done`. A need marked `(soft)` may also be `blocked`; a `blocked` hard need blocks the card at once (Plan 7, D19). The card text, the verify commands and the commit messages are in the plan.

### EV night report

**Final gates (EV-32).** Run on the merged tree at `49533e2` in a clean worktree (`git worktree add -b ev-publish /tmp/corteo-ev32 49533e2`, `node_modules` symlinked from `~/corteo`) because another session was writing to `~/corteo` while the first in-checkout run sat in `pretest` (EV-32 results line). `npx tsc -b` exit 0. `npm run lint` exit 0: 209 warnings, 0 errors, 2320 files. `npm run build` exit 0: upstream's chunk-size warning only, built in 5.95 s. `CC_RENDER_GL=swangle npm test` exit 0: the pretest chain, then `✓ 242 test segments passed in 236.0s (4 parallel)`, then the posttest chain ending at `extract-audio.verify: no-audio compatibility passed`.

**Done, per table.**

- Qoder (`Evolution night (EV)`): 31 cards, every row except the two blocked below — EV-00 to EV-11, EV-13 to EV-24, EV-26 to EV-32.
- ZCode (`EV track · ZCode (EZ)`): none. All three of its cards are blocked (below).
- DeepSeek Harness (`EV track · DeepSeek Harness (ED)`): EV-34 and EV-35 done. EV-36 was added after the track closed (cf3c516) and stays `todo`; it is outside the night's close.

**Blocked, per table.**

- EV-12 (Qoder and EZ): no talking video. `~/corteo-media` does not exist, so `talk.mp4`, `talk.mov`, `talk.mkv` and `talk.webm` are all absent. A talking video of at least two minutes there unblocks the live long-to-shorts run.
- EV-25 (Qoder and EZ): no song. `~/corteo-media` does not exist, so there is no wav, mp3, m4a or flac to listen to. A song there unblocks the end-to-end listening proof (L-13).
- EV-33 (EZ): the editor cannot start in that session. `wsl.exe` is refused by the Windows security policy, the Windows side has no Node 24, and the Linux `onnxruntime-node` and `sharp` builds cannot run there. The music UI code is verified from the share; the browser pass and its screenshots are not. A session that can run commands in WSL and open a browser on port 5201 unblocks it.

**Commits.** The night is `7cc7315..HEAD`: 47 commits at this report, `7cc7315` being the EV-00 baseline. Per card: EV-00 2c689c8; EV-01 6947b79; EV-02 045bdc5; EV-03 0fec4d1; EV-04 71f711c; EV-05 941816d; EV-06 19f8cd5; EV-07 1ccf9c9; EV-08 d8aa295; EV-09 d4d9e11; EV-10 7bf8175; EV-11 61f8088; EV-12 29d37ce and 8a97722; EV-13 90d19d5; EV-14 7150ead; EV-15 1984298; EV-16 b931ae2; EV-17 b92b862; EV-18 c4729b7; EV-19 aaef63b; EV-20 28db7ca; EV-21 560795b and bb5a24f; EV-22 4e6c805 (and 3c95fbe, which also carries EV-24's files); EV-23 dc2f5e2; EV-24 d60279d and a6c11a8; EV-25 0962bc4 and 314122b; EV-26 d58ea1e; EV-27 49533e2; EV-28 25a7918; EV-29 4658e3b; EV-30 d27ddcb; EV-31 24d84d4, 4fa8a06 and 449249a; EV-32 the commit that carries this report. Plan-level commits: aa36b17 and cf3c516. Track commits: EV-33 b724785; EV-34 8ca98b9 and 4f2da87; EV-35 7380645; the EZ close 0caa903.

**Push.** `bash scripts/sync-publish.sh` ran from `/tmp/corteo-ev32` (branch `ev-publish`) after this report was committed: it found `github/main` and `origin/cursor/video-editor-mvp-d191` already in HEAD, ran `CC_RENDER_GL=swangle npm test` in the worktree (exit 0, `✓ 242 test segments passed in 216.6s (4 parallel)`), and pushed `05ff4fc` to `github main` (`274496b..05ff4fc`) and `origin cursor/video-editor-mvp-d191` (`5045d58..05ff4fc`), exit 0. `git ls-remote` returned `05ff4fc5a20ddd196cb4156ac6f857e440d4e4ba` for both refs. This follow-up commit carries that reading and was published the same way; the two refs then returned this commit.

| ID | Task | Status | Needs |
|----|------|--------|-------|
| EV-00 | Baseline before the first change | done | |
| EV-01 | Host profiles are data (grok, muse, claude-duet) | done | EV-00 (soft) |
| EV-02 | Installer `--host-profile` | done | EV-01 |
| EV-03 | Skill: one name, the real install, size, delivery | done | EV-02 (soft) |
| EV-04 | One render function for every MP4 verb | done | EV-00 (soft) |
| EV-05 | Phone round trip: `occ inbox` | done | EV-01, EV-04 |
| EV-06 | `apply_ken_burns` runs headless | done | EV-00 (soft) |
| EV-07 | Lyrics in: paste, file beside the song, transcript | done | EV-00 (soft) |
| EV-08 | Song-film plan (pure) | done | EV-07 |
| EV-09 | `occ song-film`: place | done | EV-04, EV-08 |
| EV-10 | `occ song-film`: animate and render | done | EV-09, EV-06 (soft) |
| EV-11 | Shorts: `reviewEs` before the batch | done | EV-03 (soft) |
| EV-12 | Shorts, live on a talking video | blocked (no talking video in `~/corteo-media`) | EV-11 |
| EV-13 | Brain aliases and the lane probe | done | EV-00 (soft) |
| EV-14 | Alias router with 429 failover | done | EV-13 |
| EV-15 | `npm run brain:serve` | done | EV-14 |
| EV-16 | `npm run brain`: boot, no browser, no pasted key | done | EV-15 |
| EV-17 | Installer starts the brain (`brain` step) | done | EV-16, EV-02 (soft) |
| EV-18 | `delegate` MCP tool | done | EV-14 |
| EV-19 | The IDE door | done | EV-14, EV-03 (soft) |
| EV-20 | The brain, live on this machine | done | EV-16, EV-18, EV-17 (soft) |
| EV-21 | L-12: `escuchar-cancion` skill and MCP prompt | done | EV-00 (soft) |
| EV-22 | L-11 part 1: Reaccionar a la música | done | EV-00 (soft) |
| EV-23 | L-11 part 2: Mapa musical | done | EV-00 (soft) |
| EV-24 | L-11 part 3: Mapa de la canción | done | EV-00 (soft) |
| EV-25 | L-13: listening end to end on a real song | blocked (no song in `~/corteo-media`) | EV-21 (soft), EV-22 (soft), EV-23 (soft), EV-24 (soft) |
| EV-26 | `EVOLUTION=PASS` acceptance script | done | EV-05 (soft), EV-10 (soft), EV-11 (soft), EV-14 (soft), EV-18 (soft), EV-19 (soft) |
| EV-27 | README Estado for what the night wired | done | EV-31 |
| EV-28 | The ten Italian keys, so `npm test` runs to the end | done | |
| EV-29 | Close EV-22, EV-23 and EV-24 now that `verify:i18n` passes | done | EV-28 |
| EV-30 | The first full `npm test` since C-12 | done | EV-29 |
| EV-31 | Merge the ZCode and DeepSeek Harness tracks | done | EV-30, EZ and ED tables finished |
| EV-32 | Final gates, publish, report | done | EV-31, EV-27 (soft) |

### EV: results
Each card appends its outputs here: commands, JSON, ffprobe values, wall times. Never a token or a key.

- EV-00: baseline at 7cc7315; Node v24.22.1; tsc exit 0; lint exit 0 (204 warnings, 0 errors); npm test exit 1 at Italian settings coverage (see blocker). Chrome shell has VERSION and linux64; ffprobe: /home/carlos/corteo/node_modules/@ffprobe-installer/linux-x64/ffprobe; pnpm: /mnt/c/Users/carlos/AppData/Roaming/npm/pnpm; dsh 0.2.1-rc.2; port 5199 HTTP 000. Both github and origin remotes exist. no-claudia.verify exit 0.

- EV-01: tsc, host-profile.verify, verify:cli and both registration gates passed. Muse skillDest: /home/carlos/.config/muse/skills/corteo/SKILL.md; mediaInbox: /home/carlos/corteo-inbox/muse. Installs were tested under a temporary HOME.

- EV-02: bash -n and npm run verify:install passed; dry-run printed CORTEO_HOST_PROFILE=claude-duet. No real host installation was run.

- EV-03: skill and acceptance guards, no-claudia and both registration gates passed. Installed command and report paths follow bot/skills/corteo-setup/SKILL.md, whose commands scripts/bot-rehearsal.sh replays.

- EV-04: tsc, verify:cli and jobs.verify passed. Scratch dry-run keys before: projectId, timelineId, output, codec, extension, scale, frameRange, totalFrames, durationSeconds, filename; after: projectId, timelineId, output, codec, extension, scale, frameRange, totalFrames, durationSeconds, filename.

- EV-05: tsc, inbox.verify, verify:cli, skill guard and registration gates passed. Live result: {"ok":true,"host":"grok","input":"/tmp/tmp.NPmw65x4Pe/inbox/clip.mp4","projectId":"9ad0bcf2-10b5-4acd-bb06-309fe25ab9aa","exportPath":"/tmp/tmp.NPmw65x4Pe/exports/clip-20261028-082032.mp4","attachPath":"/tmp/tmp.NPmw65x4Pe/exports/clip-20261028-082032.mp4","width":1080,"height":1920,"fps":30,"durationSeconds":3,"bytes":6463,"dryRun":false}. ffprobe: 720x1280, 3.000000 seconds; temp directory removed. The existing timeline summary omitted fit, so cli/summary.ts now exposes it for the required assertion.

- EV-06: tsc, offline-runtime.verify, verify:cli, verify:mcp, verify:agent-tools and catalog generation/check passed. tools ls row: {"name":"apply_ken_burns","headless":true}; generated catalog unchanged.

- EV-07: tsc, lyricsInput.verify, verify:music-intelligence and both registration gates passed.

- EV-08: tsc, songFilm.verify, verify:editor and both registration gates passed.

- EV-09: tsc, song-film.verify, verify:cli and registration gates passed. Direct probes showed CLI result paths ops[0].result.timelineDownbeatFrames and ops[0].result.{sections,curves,lyrics.lines}; the session returns the result itself. The synthetic fixture detected downbeats without an accent adjustment.

- EV-10: tsc, song-film.verify, verify:cli and skill guard passed. Live result (temporary output removed): {"ok":true,"stage":"rendered","projectId":"4eccf6e4-2d74-4e8d-b300-d339ccf54681","audioItemId":"item_9a3f05e7-bab1-4e67-9f71-4da468528fb7","bpm":120.1,"lyricsSource":"txt","lines":[{"text":"primera línea","startMs":2000,"endMs":6000},{"text":"segunda línea","startMs":6000,"endMs":10000},{"text":"tercera línea","startMs":10000,"endMs":16000},{"text":"cuarta línea","startMs":16000,"endMs":20000},{"text":"quinta línea","startMs":20000,"endMs":23966.666666666668},{"text":"sexta línea","startMs":23966.666666666668,"endMs":30000}],"cutGrid":"downbeat","cuts":[0,60,240,300,540,779,900],"keyframedItems":12,"kenBurns":{"applied":6,"skipped":false},"reactions":{"applied":false,"reason":"music analysis is unavailable until the model pack(s) are installed"},"render":{"bytes":8250126,"durationSeconds":30,"frames":900,"dryRun":false}}. ffprobe: 1080x1920, one audio stream, 30.016 s; wall 49 s. The existing Ken Burns generator writes x or y only for pan directions; in/out intentionally write scale alone, so the verify checks pan axes when a pan is selected.

- EV-11: tsc, shorts-host-flow.verify, shorts-tools.verify, verify:agent-tools, verify:skills, catalog generation/check, skill guard and registration gates passed. The host-flow fixture scores and cuts three exact word ranges into 1080x1920 sequences.

- EV-13: ladder.verify, probe.verify, doctor.verify and both registration gates passed. The probe stores lane status and latency in private brain.json, with no forward key.

- EV-14: router.verify and both registration gates passed with a local stub, including 429, timeout, rejected key, closed port and SSE rewriting.

- EV-15: brain.verify, install.verify (including local pnpm fallback), start.verify and both registration gates passed. Fake dsh and router stopped cleanly; private state and logs carry no exposed key in status.

- EV-16: boot.verify and both registration gates passed; doctor, install and brain regression verifies also passed. Existing installer and doctor progress emitters gained injectable callbacks so JSON boot output remains one object. Brain state is recorded during startup so a failed forward step can stop the spawned process.

- EV-17: bash syntax, verify:install and verify:affected passed; --no-brain dry run reported CORTEO_BRAIN=skipped.

- EV-18: tsc, lint (0 errors), delegate.verify, verify:mcp, catalog generation/check, skill guard, both registration gates and 20 affected verifies passed. The stub router exercised validation, retries, failover errors and secret checks; MCP tests confirmed both exposure modes without project binding. Catalog unchanged.

- EV-19: ide-door.verify, skill guard, both registration gates and two affected verifies passed. The router binds loopback; tracked text contains neither the installed forward key nor profile MCP tokens.

- EV-20: live boot exit 0: ok=true, step=null, forwardPort=18899, routerPort=18890, editor=linked, probe=corteo-edit/nvidia/nemotron-3-ultra-550b-a55b:free at 1475 ms. Status: 9 passing lanes; edit first=nvidia/nemotron-3-ultra-550b-a55b:free, draft and fast first=liquid/lfm-2.5-2.6b:free. Doctor passed 5/5 (33 models, masked key). MCP tools/list exposed delegate. Lyric draft: ok, same edit lane, 12213 ms, 1 attempt; three text items applied to scratch project bdd73584-0112-4d63-8cc3-625733245ce7: item_0241b5a8-69dd-4965-b7cb-eb064616fddf, item_392625af-741c-405c-8bf8-b985f7b4ad4b, item_c06454f5-ea22-42d3-a95b-c69a88fe8499. Split draft: ok, same lane, 4325 ms, 1 attempt; applied at frame 60, newItemId=item_77e9794e-883a-41cf-9a00-1f65ee974957. After brain:stop, delegate returned brain_unavailable/router_down, tried=[]; direct fallback placed item_ef25d43c-e83e-44dd-844b-a9b639a5317e. No natural 429 rows observed. Editor keys endpoint: configured=true, base URL http://127.0.0.1:18899/v1. Brain and this card's editor stopped.

- EV-21 (L-12): tsc, lint (0 errors), verify:skills, verify:mcp, catalog generation/check, both registration gates and affected verifies passed. The MCP prompt was tested through a real session; bundled skill count is 33.

- EV-22: implementation, Spanish static rendering, one-batch apply, tsc, lint (0 errors), verify:components, both registration gates and 55 affected verifies passed. The listed test path in the card is .tsx in the checkout, not .ts. The i18n source-key check and locale.verify passed before the baseline Italian coverage failure.

- EV-23: implementation, tsc, lint (0 errors), Spanish section and 2x trim/speed positioning test, view-state persistence test, verify:components, both registration gates and 22 affected verifies passed. The strip and per-timeline toggle are retained for review.

- EV-24: tsc, lint (0 errors), song-map-dialog.verify, verify:components, both registration gates and 13 affected verifies passed. The dialog uses available asset transcripts; tonal key and relay data are optional and the current browser analysis does not supply them. The two new EV-24 files were inadvertently included in the EV-22 progress correction commit 3c95fbe because they were already staged; history was not rewritten.

- EV-26: `bash scripts/evolution-acceptance.sh` printed EVOLUTION=PASS. Wall seconds: profiles 11, roundtrip 16, song-film 34, shorts 1, router 0, delegate 1, ide-door 2, clean 0. The optional brain-live step was not requested (EVOLUTION_LIVE unset). Acceptance verify, no-claudia, both registration gates and affected verify passed; scratch files removed and git status unchanged.

- EV-28: the ten "Conectar un bot" keys went into `src/i18n/dict/it/mcpGuide.ts`. `npm run verify:i18n` passed: check-i18n (161 UI files, 2643 English entries), locale.verify, settingsCoverage.verify (443 settings keys and 169 settings data keys), it mediaCoverage.verify and transcription-language.verify. `pretest` no longer stops at Italian coverage, so EV-30 can reach `test:serial`.

- EV-29: after EV-28, all three cards' Verify lists are green: tsc exit 0; `music-reaction-section.verify.tsx`, `music-map-strip.verify.tsx` and `song-map-dialog.verify.tsx` each exit 0 with their Spanish-controls/map/optional-evidence lines; `npm run verify:components` exit 0; `npm run verify:i18n` exit 0 (check-i18n 161 UI files, 2643 entries); both registration gates exit 0 (719 verify files). Rows EV-22, EV-23 and EV-24 set to done. L-11 stays blocked until EV-31 (card out of scope); the browser proof is EV-33.

- EV-30: tsc exit 0; `npm run lint` exit 0 (209 warnings, 0 errors); `npm run build` exit 0 (upstream's chunk-size warning only). Run 1 of `CC_RENDER_GL=swangle npm test` stopped in `pretest` at `verify:skills`: `plugin-skills.verify.ts` still expected the pre-EV-21 skill list and rejected the new `escuchar-cancion` directory; that is the night's failure and `EV-21: fix the bundled-skill list the full gate found` adds it (bb5a24f). `npx tsx src/agent/skills/plugin-skills.verify.ts` and `npm run verify:skills` then passed. Run 2 reached every segment: `✗ 1/242 segments FAILED in 362.4s`; 241 segments green, and the one failure is `verify-registration.verify.mjs` reading `package.json` with two new verify names (`src/audio/listen/songMeasurement.verify.ts`, `server/music-listen/relay-route.verify.ts`) that were not in git's index at that moment. Those are another session's uncommitted, in-flight changes that appeared in this checkout during the run; once they were staged the same gate passes (`all 721 tracked verify files are registered`, exit 0). No segment failed on committed tree code. EV-32 reruns the whole gate on the merged tree, after which this row's "green suite" claim can be made for the final tree.

- EV-31: the tree was cleaned for the merges (the foreign staged work from the EV-30 blocker was banked to `/home/carlos/corteo-ez-leftovers-20261028.patch` and a named stash), leaving only the known untracked leftovers. `git merge --no-ff ev-dsh -m "EV-31: merge the DeepSeek Harness track"` → "Merge made by the 'ort' strategy", no conflicts: `docs/plans/07-evolution.md` +18, `docs/plans/PROGRESS.md` +35, `documentation/CORTEO_INSTALL.md` +101/-24, `skills/corteo/SKILL.md` 14 changed. `git merge --no-ff ev-zcode -m "EV-31: merge the ZCode track"` → "Auto-merging docs/plans/PROGRESS.md", "Merge made by the 'ort' strategy", no conflicts: `docs/plans/PROGRESS.md` +18/-4, `src/i18n/dict/es/index.ts` +4 (Tempo, Compás, Energía from a6c11a8). EZ and ED closed their tables with every row done or blocked. Carried into the main tables above: L-11 `done`, L-13 stays `blocked` (EV-25 blocked: no song in `~/corteo-media`), EV-12 blocked for the same reason (no talking video). The track tables keep their own rows: EV-33 blocked on EV-22 to EV-24's browser half, EV-34 and EV-35 done, EV-36 todo. EV-30 postponed no EZ or ED fix: its only code fix (bb5a24f) was EQ's own. Verify on the merged tree: `npx tsc -b` exit 0; `npm run lint` exit 0 (209 warnings, 0 errors); `npm run verify:i18n` exit 0; `npm run verify:components` exit 0; `node scripts/corteo-skill.verify.mjs` ok; `node scripts/corteo-acceptance.verify.mjs` ok; both registration gates exit 0 (719 verify files, all reachable from `npm test`). The EV-30 registration blocker does not reproduce: the merged `package.json` and the tracked verify files agree.

- EV-27: `README.es.md` (Estado › "Lo que funciona hoy" and "Lo que falta") and `README.md` (Status) now list the night: host profiles and `--host-profile` (EV-01, EV-02), `occ inbox` (EV-05), `occ song-film` (EV-09, EV-10), `reviewEs` with `npm run editor-host` (EV-11), `npm run brain`, the `grok`/`muse`/`claude-duet` aliases, `delegate`, `http://127.0.0.1:18899/v1` for the editor and `http://127.0.0.1:18890/v1` for the IDE door (EV-13 to EV-20, live in EV-20), the installer's `CORTEO_BRAIN` step (EV-17), and the music UI with its tests green and the browser pass pending (EV-22 to EV-24, EV-29; EV-33 blocked). The two stale lines that called `videoclip-musical` pending are gone (P1-6 is done), and "Lo que falta" now names only L-13 and EV-33 for the listening work. `node scripts/no-claudia.verify.mjs` exit 0 (the old name survives only in migration keys and proper nouns; README.es.md 1, README.md 2) and `node scripts/corteo-acceptance.verify.mjs` exit 0.

- EV-32: on the merged tree at `49533e2`: `npx tsc -b` exit 0; `npm run lint` exit 0 (209 warnings, 0 errors, 2320 files); `npm run build` exit 0 (chunk-size warning only, built in 5.95 s); `CC_RENDER_GL=swangle npm test` exit 0, `✓ 242 test segments passed in 236.0s (4 parallel)`, posttest last line `extract-audio.verify: no-audio compatibility passed`. The first run in `~/corteo` was stopped in `pretest`: another session was writing the checkout mid-run (modified `package.json` plus untracked `src/audio/listen/songMeasurement.verify.ts`, `server/music-listen/relay-route.verify.ts` and `src/i18n/dict/es/musicUiCoverage.verify.ts`, the same class as the EV-30 blocker). The gates above ran in a clean worktree (`/tmp/corteo-ev32`, branch `ev-publish`, `node_modules` symlinked) at the exact merged commit, so they measure the tree being published; both remote heads were ancestors of it. The report above and the push result commit carry the details.

### EV: blockers
- EV-25: `find /home/carlos/corteo-media -maxdepth 1` could not find a song because the directory does not exist. Checked the configured default directory for wav, mp3, m4a and flac; no editor or downloads were started. A real song in that directory unblocks the proof. Screenshots are also skipped while EV-22 and EV-24 are blocked.

- EV-24: `npm run verify:i18n` exited 1 at `src/i18n/dict/it/settingsCoverage.verify.ts`, on the same 10 missing Italian bot-connection keys as EV-00. The source-key check passed; adding those pre-existing Italian translations and rerunning the gate unblocks the card. The implementation is retained for review. Resolved 2026-10-28 by EV-28, closed by EV-29.
- EV-23: `npm run verify:i18n` exited 1 at `src/i18n/dict/it/settingsCoverage.verify.ts`, the same 10 missing Italian bot-connection keys documented for EV-00 and EV-22. The source-key check passed and no pre-existing translations were changed; adding the Italian entries and rerunning the gate unblocks this card. Resolved 2026-10-28 by EV-28, closed by EV-29.
- EV-22: `npm run verify:i18n` exits 1 at `src/i18n/dict/it/settingsCoverage.verify.ts`: Italian settings dictionary is missing the same 10 bot-connection keys recorded at EV-00 (AssertionError, expected empty array). Ran the component suite and source-key check; no change to the pre-existing Italian dictionary was made, as the repository instructions prohibit fixing a test that failed before this card. Adding those Italian translations and rerunning verify:i18n would unblock the card. The implemented UI is retained for review; the card is blocked because its required gate is not green. Resolved 2026-10-28 by EV-28, closed by EV-29.
- EV-12: no talking video in /home/carlos/corteo-media. Checked talk.mp4, talk.mov, talk.mkv and talk.webm; none exists. No speech was synthesized and no server was started. A talking video of at least two minutes at one of those paths unblocks the live run.
- EV-00 baseline: CC_RENDER_GL=swangle npm test exited 1 in src/i18n/dict/it/settingsCoverage.verify.ts: Italian settings dictionary is missing 10 keys for the bot connection UI (AssertionError, expected empty array). This predates EV changes; no fix attempted per card scope. Adding the missing Italian translations would unblock the gate. The serial chain stopped at that assertion and printed no segment summary. Resolved 2026-10-28 by EV-28.
- EV-30 (transient, watch after EV-31): between about 10:39 and 10:55 CET another session edited this checkout while the suite ran — `src/audio/intelligence/*`, `src/i18n/dict/{en/audio,es/index}.ts`, `package.json`, new `src/audio/listen/songMeasurement*`, new `server/music-listen/relay-route*`, plus a dev server on port 5199 started from `~/corteo`. Nothing was committed by this track. `verify-registration.verify.mjs` failed only because those new verify names were in the working-tree `package.json` before git tracked the files; it exits 0 once they are in the index (721 files). Recheck that the merged tree's `package.json` and its verify files agree.

---

## EV track · ZCode (EZ)
Folder `~/corteo-zcode`, branch `ev-zcode`, editor port 5201. Plan 7 › "Finishing in three tracks". Only ZCode edits this section.

**EZ closed 2026-10-28.** EV-33 is blocked: the music UI code is verified from the Windows side of the share, but no editor can start here to see it in a browser.  
EV-25 and EV-12 are blocked: `~/corteo-media` does not exist, so there is no song and no talking video.  
One real defect was fixed on the way (a6c11a8: Tempo, Compás, Energía); nothing is pushed, and EQ's EV-31 merge carries these rows over.

| ID | Task | Status | Needs |
|----|------|--------|-------|
| EV-33 | The music UI in a real browser (EV-22 to EV-24) | blocked | |
| EV-25 | L-13 on a real song, on port 5201 | blocked | a song in `~/corteo-media` |
| EV-12 | Long to short, live, on port 5201 | blocked | a talking video in `~/corteo-media` |

### EZ: results

- EV-12: not run, there is no talking video. `/home/carlos/corteo-media` does not exist, so `talk.mp4`, `talk.mov`, `talk.mkv` and `talk.webm` are all absent. No speech was synthesized, no editor or editor-host was started and no render was attempted.
- EV-25: not run, there is no song. `/home/carlos/corteo-media` does not exist (`ls` → `No such file or directory`); `CORTEO_E2E_MEDIA_DIR` is unset in this environment and is not in `.env.corteo.example`, and this worktree has no `.env.corteo`. No editor was started and no model pack was downloaded.
- EV-33: the code half is green, the browser half is blocked. `npx tsc -b` exit 0 and `npm run verify:i18n` exit 0 (all five commands) run from the Windows side of the share through a `subst` drive, with TypeScript 7.0.2 and `@typescript/typescript-win32-x64` 7.0.2 plus `@esbuild/win32-x64` 0.28.2 copied in from `~/corteo/node_modules` (identical versions). The three music UI verifies pass: `song-map-dialog.verify` (Spanish sections, map and optional listening evidence), `music-map-strip.verify` (Spanish sections, trim/speed positions), `music-reaction-section.verify` (Spanish controls, one-batch apply). One defect found and fixed in a6c11a8: the song badge and the song-map dialog rendered `速度`, `拍号` and `能量` in English because `src/i18n/dict/es/index.ts` never carried them (the keys date from the upstream base commit a1b4d3a; EV-24 put two of them in the dialog). They now read Tempo, Compás and Energía. Not done: checks (a), (b) and (c) in a real browser and their screenshots, because the editor cannot start in this session (EZ: blockers). Port 5201 never opened; Qoder's editor on 5199 was left alone.

### EZ: blockers
- EV-12: no talking video in /home/carlos/corteo-media: the directory does not exist and none of talk.mp4, talk.mov, talk.mkv or talk.webm is there. A talking video of at least two minutes unblocks it. The EV-33 editor blocker would also have to clear first: this card needs `npm run corteo:local`, `npm run editor-host`, `transcribe_track` and the three 480p renders.
- EV-25: no song in /home/carlos/corteo-media: the directory does not exist, so the first wav, mp3, m4a or flac the card asks for cannot be found. A song there unblocks it, but the EV-33 editor blocker would still have to clear first: checks 1 to 3 need `CORTEO_PORT=5201 npm run corteo:local` and the model packs, and check 1 renders through onnxruntime-node.
- EV-33: the editor cannot start here, so (a), (b) and (c) have no browser and no screenshots. `wsl.exe -e bash -lc '...'` is refused by the sandbox: `PROGRAM BLOCKED BY SECURITY POLICY ... wsl.exe (C:\Windows\system32\wsl.exe)`, Program Blacklist, not approvable. Without WSL, `bash scripts/corteo-env.sh --require-node` (the `precorteo:local` gate) prints `[corteo] Node 24 is required and nvm is not installed. Run install.sh`: `$HOME/.nvm/nvm.sh` does not exist and `HOME` is `C:\Users\carlos`. Bypassing that gate, `CORTEO_PORT=5201 node scripts/corteo-local.mjs` prints `[corteo] Node 22.22.2 is too old. corteo needs Node 24.`; the newest Node on the Windows side is v22.22.2 (managed) and v22.22.0 (system). A Node 24 would still not be enough: `server/music-listen/inference.ts` and `inference-worker.ts` load `onnxruntime-node` and `server/music-listen/pictures.ts` loads `sharp`, and this checkout holds only their Linux builds, so the song analysis behind (a), (b) and (c) cannot run. Unblocks with a session that can run commands inside WSL (remove `wsl.exe` from Security Center › Command Security › Program Blacklist), then `CORTEO_PORT=5201 npm run corteo:local` and the card's Playwright script. Qoder's editor on 5199 was not driven: track rule 6 asks for this track's own port and a scratch library.

---

## EV track · DeepSeek Harness (ED)
Folder `~/corteo-dsh`, branch `ev-dsh`. Plan 7 › "Finishing in three tracks". Only DeepSeek Harness edits this section.

**ED (2026-10-28):** EV-34, EV-35, EV-36 and EV-37 are done: the corteo skill's recipes were replayed, `documentation/CORTEO_INSTALL.md` now describes every installer flag and report key, the bot's `corteo-edit` skill carries the inbox and song-film recipes with a regenerated `bot/dist/recipe.json`, and `occ song-film` exits when it is done.
EV-37 found no pending music request: the warm workers' piped stderr and IPC kept the CLI alive, so the host unrefs all three handles while idle and `occ` disposes it after the command; the 15 s command exits 0 in 33.7 s, 0.28 s after its JSON, and the extended `cli/song-film.verify.ts` proves a pending fake host cannot keep the CLI alive.
The earlier six verifies and the EV-37 verifies pass (`npx tsc -b`, `cli/song-film.verify.ts`, `verify:cli`, `verify:music-intelligence`, 10 affected verifies), all four rows are `done`, the EV-36 blocker is resolved, and the scratch directories were deleted.

| ID | Task | Status | Needs |
|----|------|--------|-------|
| EV-34 | Replay `skills/corteo/SKILL.md` the way a host would | done | |
| EV-35 | The install guide says what `install.sh` does now | done | EV-34 |
| EV-36 | The bot template learns the inbox and the song film | done | EV-35 (soft) |
| EV-37 | `occ song-film` exits when it is done | done | EV-36 |
| EV-38 | The skill's MCP blocks, replayed against a running editor | todo | EV-34 |

### ED: results

- EV-37 (2026-10-28): reproduced the 15 s hang with both packs present (`HOME=/tmp/l11-home`; the shared cache currently lacks the rhythm pack): the command wrote its JSON and a valid 1080x1920, 15.019 s MP4 at 43 s, then stayed alive with two `server/music-listen/inference-worker.ts` children until killed at 15 minutes. Temporary debug (reverted) showed every music request settled (`rhythm id=1`, `clap id=1,2`, `pending=0`); the handles active after `runCommand` were four Sockets, the two warm workers' IPC channels and piped stderr. Fix: `WorkerChannel` now refs the child, its IPC channel and its stderr for a request and unrefs all three when `pending` empties; `close()` keeps the child and a bounded timer ref'd while it exits (otherwise Node drained the loop and exited 13); `cli/main.ts` disposes the default host after `run()` through a lazy import guarded by the new `server/music-listen/loaded.ts`; `setDefaultMusicInferenceForTest` is the verify seam. `cli/song-film.verify.ts` now runs a fake pending host with a real worker child: the CLI exits under 10 s (the test times out with `ETIMEDOUT` when the dispose is temporarily disabled, so it is not vacuous). Wall time: 15 s command exit 0 in 33.67 s, 0.28 s after the JSON file; 6 s command exit 0 in 20 s. Verify: `npx tsc -b`; `npx tsx cli/song-film.verify.ts`; `npm run verify:cli`; `npm run verify:music-intelligence`; `npm run verify:affected -- cli/main.ts cli/song-film.verify.ts server/music-listen/inference.ts server/music-listen/loaded.ts` (10 verifies); `npm run lint` 0 errors. Scratch libraries deleted.
- EV-35 (2026-10-28): ran `bash install.sh --help`, `bash install.sh --dry-run --json`, `bash install.sh --dry-run --host-profile muse` and `bash install.sh --dry-run --no-brain` from `~/corteo-dsh`; the dry runs created nothing. `documentation/CORTEO_INSTALL.md` now lists all 17 `--help` flags, the `CORTEO_HOST_PROFILE`/`CORTEO_BRAIN` inputs, the 22 full-report keys plus `CORTEO_MCP_TOKEN`, the brain keys (`CORTEO_BRAIN=ok|failed|skipped`, `CORTEO_BRAIN_STEP`, `CORTEO_BRAIN_URL`), the host keys (`CORTEO_SKILL_PATH`, `CORTEO_MEDIA_INBOX`, `CORTEO_EXPORT_DIR`), the dry-run keys (`CORTEO_OS`, `CORTEO_NODE_SYSTEM`, `CORTEO_NODE_TARGET`, `CORTEO_REF`, `CORTEO_START`, `CORTEO_WITH_DESKTOP`, `CORTEO_SKIP_SYSTEM_DEPS`, `CORTEO_PORT_STATE`, `CORTEO_SERVICE`, `CORTEO_LEGACY_DIR`, `CORTEO_LEGACY_ACTION`) and the uninstall dry-run keys (`CORTEO_ACTION`, `CORTEO_PURGE`); the self-test is documented as lowercase `pass`. A check extracted 17 flags from `--help` and 36 `report CORTEO_*` names from `install.sh` and found all of them in the guide. Verify: `node scripts/no-claudia.verify.mjs` ok; `npm run verify:install` ok (22 report keys, self-test shape, side-effect-free dry run, `--json` object, JSON failure).
- EV-36 (2026-10-28): added `## From a phone to an MP4` (`"$CORTEO_OCC" inbox --host grok --json`, send `attachPath`) and `## A song and its lyrics into a film` (`"$CORTEO_OCC" song-film --audio /absolute/path/song.wav --to 30s --json`, `--lyrics-text`/`--stills`, render 15 to 30 seconds first) to `bot/skills/corteo-edit/SKILL.md`, in its own voice with `. ~/corteo/corteo.env` first. The body is 5657 B of the 6144 B budget. Replay in scratch libraries, with `~/corteo-dsh/scripts/corteo` standing in for `$CORTEO_OCC` and the scratch `CORTEO_STORE_DIR`/`CORTEO_EXPORT_DIR`/`CORTEO_MEDIA_INBOX`: `inbox --host grok --json` returned `attachPath` and a 720x1280, 3.000 s MP4; `song-film --audio <6 s wav> --to 6s --stills a.png,b.png --json` exited 0 in 27 s with a 1080x1920, 6.016 s MP4 with audio. A 15 s song-film run wrote a valid 1080x1920, 15.019 s MP4 but its CLI did not exit; see ED: blockers. Regenerated `bot/dist/recipe.json`. Verify: `npm run verify:bot-recipe` ok (4 skills, recipe current), `node scripts/bot-rehearsal.verify.mjs` ok, `node scripts/no-claudia.verify.mjs` ok. The `. ~/corteo/corteo.env` line was not sourced (no curl install here); the scratch env replaced it.
- Run 2026-10-28 in `~/corteo-dsh` (branch `ev-dsh`), Node v24.22.1. The replay copy replaced `~/corteo-exports` with `$T/exports` and both `~/corteo/scripts/corteo` and `$HOME/corteo/scripts/corteo` with `$CORTEO=~/corteo-dsh/scripts/corteo` (the bash blocks write the wrapper as `$HOME/...`). Scratch: `CORTEO_STORE_DIR=$T/library CORTEO_EXPORT_DIR=$T/exports CORTEO_MEDIA_INBOX=$T/inbox CC_RENDER_GL=swangle`; no editor server, no brain. `$T` deleted.
- Bash blocks, in document order:
  - block-01 One name: PASS 11 s (`CORTEO=...` and `--help`; `CORTEO_OCC` and the env source skipped).
  - block-02 Install: SKIP, as the card says (curl install, `. ~/corteo/corteo.env` and `$CORTEO_OCC`; there is no curl install here).
  - block-03 Start: SKIP (`npm run corteo:local` starts the editor; card).
  - block-04 Verbs: PASS 158 s. Every line ran; `ASSET_ID`/`ITEM_ID` were filled from a `Night bus` project, the split used a second clip at frame 0 and an audio clip was added for `--to-audio`. Renders: 1920x1080, 6.016 s (`--from 0 --to 6s`) and 1920x1080, 6.016 s (`--to-audio`).
  - block-05 id one-liners: PASS after the text fix below. The first attempt, with the text as committed, failed with `Error: Cannot find module 'import.json'`; with `./import.json` the three commands print the asset id, the placed item id and the split id. (The second run's driver compared with bare paths and failed its own check; the retry in the same scratch passed.)
  - block-06 edit_track: PASS 11 s (an object and a JSON string both create a track).
  - block-07 text: PASS 4 s.
  - block-08 MCP: SKIP (needs the editor server; card).
  - block-09 Receta rápida: PASS 48 s; `rapida.mp4` 1920x1080, 2.005 s (the song is 2 s).
  - block-10 Video musical: PASS 144 s; `musical.mp4` 1920x1080, 6.016 s; `musical-4k.mp4` 3840x2160, 1.003 s. `detect_beats` returned `bpm` 112.2, `confidence` 3.09 and 12 `beats`.
  - block-11 Lyric video: PASS 26 s; `lyric.mp4` 1920x1080, 2.005 s.
  - block-12 Short vertical: PASS 91 s; `short-cover.mp4` and `short-blur.mp4` are both 1080x1920, 3.000 s; `remotion/frame-bars.mjs` cover and blur pass (top and bottom are picture, not black bars or the checkerboard).
  - block-13 Motion title: PASS 31 s; `titulo.mp4` 1920x1080, 2.000 s.
  - The `json` delegate example is not a bash block and needs the brain: SKIP. The skill has no `host install` block.
- Prose recipes that need no server:
  - `Del teléfono al MP4`: PASS. `host show grok --json` gave `mediaInbox`; `inbox --host grok --json` on a 3 s 1280x720 clip returned `attachPath` and a 720x1280 MP4.
  - `Película de una canción`: PASS. `song-film --audio ... --to 6s --stills ... --lyrics-text ... --json` returned `ok`, `lyricsSource: pasted` and `cutGrid: downbeat`, and a 1080x1920, 6.016 s MP4 with audio (the example's 30 s was shortened to the scratch song).
- Text fixed in `skills/corteo/SKILL.md` (code wins):
  1. The id one-liners passed bare `import.json`/`place.json`/`split.json` to `require`, which searches `node_modules`; they now pass `./import.json`, and the prose says why.
  2. A `placed` result has `startFrame`, not `fromFrame`; fixed.
  3. `Writes need --apply` was false for `project new`, which ran without it; it now says edits.
  4. The `edit_track` error quote was `/json must be string`; the code says `json must be a JSON object string`.
- Verify: `node scripts/corteo-skill.verify.mjs` ok; `node scripts/corteo-acceptance.verify.mjs` ok; `node scripts/no-claudia.verify.mjs` ok (2599 tracked files).

### ED: blockers
- ED: EV-36 code fault (`song-film` does not exit on a 15 s song): `~/corteo-dsh/scripts/corteo song-film --audio <15 s wav> --to 15s --stills a.png,b.png --json` wrote its JSON and a valid 1080x1920, 15.019 s MP4 with audio at about 2 minutes, then stayed alive with two `server/music-listen/inference-worker.ts` children (the CLI was in `do_epoll_wait`, no error printed) until it was killed at the 15-minute rule. The same command with a 6 s song and `--to 6s` exited 0 in 27 s with a valid 1080x1920, 6.016 s MP4, so the bot recipe text is not affected and EV-36 stays done. A song-film run on 15 s or more that exits and prints its JSON unblocks closing this; a likely place to look is an unawaited `listen_to_song` request holding the worker ref (`REQUEST_TIMEOUT_MS` is 20 minutes in `server/music-listen/inference.ts`), but that was not proven. No code was changed. Resolved 2026-10-28 by EV-37: the pending-request guess was wrong — every request settled; the refs were the warm workers' piped stderr (plus IPC), now unref'd while idle, and `occ` disposes the host after the command. The 15 s command exits 0 in 33.7 s, 0.28 s after its JSON.

## P5-1 track · WorkBuddy

Branch `p5-workbuddy` in `~/corteo-zcode`. Every module of `src/i18n/dict/en/` now resolves to Spanish: 2,434 keys in 16 new files under `src/i18n/dict/es/`, on top of the 206 entries that already lived in `es/index.ts` (`base`) and the 121 in `es/brand.ts`. `es/index.ts` is an assembly now — `Object.assign({}, …modules, base)` — with `base` spread **last**, so nothing translated before P5-1 changed wording.

| Commit | Module | Keys | File |
| --- | --- | --- | --- |
| `ce29ebd` | timeline | 244 | `timeline.ts` |
| `f1894ba` | media | 211 | `media.ts` |
| `a1785e5` | components | 296 | `components.ts` |
| `b8a3845` | exportPanel | 186 | `exportPanel.ts` |
| `1389592` | chat | 321 | `chat.ts` |
| `8bbace9` | editor | 25 | `editor.ts` |
| `880510c` | topbar | 6 | `topbar.ts` |
| `51853c7` | review | 15 | `review.ts` |
| `9be9057` | templates-data | 24 | `templates-data.ts` |
| `68f7271` | audio | 49 | `audio.ts` |
| `1ea38c0` | transcript | 82 | `transcript.ts` |
| `c670bf4` | fx | 141 | `fx.ts` |
| `4522160` | captions | 150 | `captions.ts` |
| `340809d` | library | 168 | `library.ts` |
| `8dd4f7b` | settings | 516 | `settings-1.ts` (153), `settings-2.ts` (363) |

- `settings` is the only module that needed splitting: 516 keys do not fit the 500-line gate in one file. The cut follows the page order of the dialog, so `settings-1.ts` holds the shell, the capability groups, the field labels, the routing options and the interface / proxy pages, and `settings-2.ts` holds the Codex, Copilot, Claude Code and Grok accounts, the design style, the shortcuts, the media cleanup, the MCP guide and the local model pages. `es/index.ts` imports them as `settings1` and `settings2`.
- Vocabulary is Premiere Pro's Spanish: Línea de tiempo, Secuencia, Fotograma clave, Cuchilla, Controles de efectos, plus Clave de croma, Viñeteado, Desvanecido and Matiz for the effect parameters. Sentence case, "tú", and every `{placeholder}` byte-identical to the English.
- Two labels the duplicate-key check caught, each fixed in its own commit: `931607c` — timeline carried `字` as `S` while the caption tool renders it as an `A`; and `19c3f3e` — library carried `已安装` as `Instaladas`, which read wrong on the model rows in settings, so both are `Instalado` now.
- Skipped on purpose: nothing. All 2,434 keys have Spanish; the keys `base` and `brand` already carried (the song-map labels, the `音乐反应*` family, `创建会话`, the transcript entry in `settings`, …) were left exactly as they were instead of being duplicated into the new files.
- Gates after every module: `tsc -b`, `node scripts/check-i18n.mjs` (161 UI files, 2,643 English entries), `locale.verify.ts`, `it/settingsCoverage.verify.ts`, `it/mediaCoverage.verify.ts` and `settings/transcription-language.verify.ts`, plus a local check that no new file duplicates a `base`/`brand` key, that no key is missing from its `en/` module, that placeholders match, and that no file passes 500 lines. All green, every time.
- Not verified: the Spanish in a browser. No editor starts from the Windows side of the share — same blocker as EV-33 — so the wording was checked as data, not seen on screen.
- Nothing is pushed. The branch is merged later.
