# Plan 6: Opus parity (long video → viral shorts, locally)

> Executed 2026-10-25. All fifteen cards are done, OP-14 included. The frame proof lives in
> `remotion/caption-emphasis-render.verify.mjs`.
> Renamed from Plan 5 when `05-corteo.md` took that number. Task status and the next task to pick live in
> `docs/plans/PROGRESS.md`, not here. An agent takes OP tasks only when the user asks for them.
> Paths are relative to the repo root. If a path here and the code disagree, the code wins: fix
> this file in the same commit.

## Goal

Make Claudia able to do, from one conversation, what people pay OpusClip for: take one long
video, find the moments worth posting, cut them into vertical captioned clips, and put them on
a schedule — without leaving the editor and without a paid API.

Parity of capability, not of architecture. Opus is a cloud render farm with a rented model
behind it. Claudia is the editor itself: the timeline stays the source of truth, every step is
undoable, and every step is also an MCP tool, so Claudia can run the whole pipeline headless.

## 1. What OpusClip actually is

Researched 2026-10-25 from `opus.pro`, `help.opus.pro` (its pages have a clean `.md` twin) and
the Opus blog. Opus is not an editor: it is a supervised batch pipeline with a good scoring
model and a very good publishing tail.

### 1.1 The real pipeline

Public framing is four stages — Analyze, Curate, Edit, Share. The per-project order is eleven
steps:

1. Ingest — public URL, or local upload.
2. Configure — clip model, genre, prompt/keywords, clip length, caption preset, brand template,
   time range.
3. Transcribe — ASR with word timestamps and speaker diarization; optionally your own SRT.
4. Multimodal analysis — per-frame visual, audio and sentiment signals; on-screen text, sounds.
5. Chapter segmentation — the video is split into chapters *before* selection; Opus credits its
   coherence gains to this.
6. Moment scoring — Hook / Flow / Value / Trend → a 0–99 Virality Score, sorted descending.
7. Cut — windows become clips; non-adjacent windows may be stitched.
8. Reframe — face/subject tracking crop, layout switching per scene.
9. Caption and enhance — word captions, emoji, keyword highlights, auto headline.
10. Brand render — the template's `renderPref` applied, watermark on free plans.
11. Publish — calendar queue, download, XML, API or webhook.

Two clip models are a product decision, not an implementation detail: **ClipBasic** reads the
transcript only (keyword must be spoken); **ClipAnything** does per-frame multimodal analysis
and can clip video with no dialogue at all.

### 1.2 Feature inventory

| Opus feature | What it does | Mechanism |
|---|---|---|
| Clip / explore | 1–10 clips per upload, length presets | scored transcript windows |
| ClipAnything | natural-language prompt finds any moment | prompt-driven multimodal retrieval |
| Virality score | 0–99 per clip, default sort | model trained on (clip, performance) pairs |
| AI Reframe | 9:16, 1:1, 16:9, 4:5 with subject tracking | face/subject tracking crop |
| Subject tracking | keep a chosen subject framed | active-speaker detection + click-to-track |
| Layouts | Fill/Fit/Split/Three/Four/Screen, B-roll PIP | scene detection + speaker-to-slot |
| Animated captions | per-word sync, per-speaker colours | word timestamps + style templates |
| AI emojis / keywords | emoji and emphasis on key words | LLM over caption text |
| Auto headline | one-line hook in the opening seconds | LLM from transcript |
| Brand template | saved render preset for every project | deterministic `renderPref` |
| Speech cleanup | fillers, pauses, bad takes | transcript detection, human approval |
| Speech enhancement | voice isolation, noise removal | source separation |
| Censor | profanity bleep/mute | word list + audio |
| AI B-roll | context footage or images | paid generator + Pexels |
| AI dubbing | dub in your cloned voice | hosted voice clone |
| Thumbnail generator | YouTube thumbnail from a link | image model |
| Export to XML | open the cut in Premiere/Resolve | XML project file |
| Calendar / scheduler | queue a month of posts | OAuth connectors |
| Team workspace | shared projects and brand | multi-tenant |
| API + MCP | ~25 `opusclip_*` tools | hosted service |
| OpusSearch | search any scene across the catalog | catalog + embeddings |

### 1.3 The numbers worth knowing

- Score is **0–99** (not 0–100) over four named dimensions; Opus hides it on the free plan.
  Their own docs call it "a ranking signal, not a green light".
- Trained on millions of (clip, performance) pairs from TikTok, Reels and Shorts. That is the
  one asset we cannot copy, and this plan does not pretend otherwise.
- 1 credit = 1 source minute. 10 h max input, 30 GB upload. 25 languages, everything after
  Portuguese marked beta.
- Clip count scales with source length: 3–10 min → 3–14 clips; 30–60 min → 23–32; >2 h → up to 55.
- Default clip length is Auto (0–3 min); ClipAnything markets up to 15 min.
- Their published weaknesses: talking-head bias; music and animation score low; clips that need
  setup to make sense; same-speaker bias on panels; one score across every platform.
- Prompts are explicitly forbidden from setting length, aspect ratio or edits. Prompt =
  retrieval only; render config lives in the template. That separation is worth copying verbatim.

### 1.4 The MCP surface (the shape to match)

`submit_project` (url + captions + reframe + filler removal + brand template in one call),
`list_clips` (ranked, with scores), `get_transcript`, `get_editing_script` /
`apply_editing_script`, `create_censor_job`, `export_clip` (HD, 4K or Premiere XML),
`create_social_copy_job`, `schedule_publish`, plus projects, collections, brand templates,
social accounts and usage.

Two of those are the product: **one call that just does it**, and **ranked output with a number
and a reason**. Everything else is packaging.

## 2. Parity scoreboard

What "be like Opus" concretely means, feature by feature. `exists` = wired today; `partial` =
the pieces are there but not assembled; `missing` = no equivalent.

| Opus feature | Claudia today | Where it lands |
|---|---|---|
| Clip from long video | **partial** — `find_highlights` cuts and trims, no scores | OP-02 |
| ClipAnything (prompt-driven, no-dialogue) | **missing** — selection is transcript-only | OP-01 (`direction`, visual profile), OP-03 |
| Virality score 0–99 | **missing** | OP-01 |
| AI Reframe / subject tracking | **exists** — geometry-first + energy-grid fallback | OP-11 polish |
| Animated per-word captions | **exists** — 23 styles, karaoke, motion | OP-08 adds shorts presets |
| Keyword / emoji emphasis | **missing** | OP-08 |
| Auto headline | **missing** | OP-09 |
| Brand template | **missing** | OP-10 |
| Speech cleanup | **partial** — silence removal, word-strike script grammar, no filler pass | OP-06 |
| Censor | **missing** | OP-07 |
| Speech enhancement | **exists** — `isolate_voice` + `normalize_loudness` | — |
| AI B-roll | **partial** — stock search and generation tools exist, never automatic | out of scope: paid image gen |
| AI dubbing | **missing by rule** — providers are paid | out of scope (AGENTS.md rule 1) |
| Thumbnail generator | **exists** — `video-thumbnail-generator` skill, `view_asset_frames` | — |
| Export to XML | **exists** — FCPXML + Jianying draft | — |
| Scheduler / one-click publish | **partial** — 9 platforms, immediate only, no queue | OP-12, OP-13 |
| Team workspace | n/a — single user, local | out of scope |
| API + MCP | **exists, larger** — 123 tools, headless tier | OP-03 adds the async job shape |
| OpusSearch / catalog | **done** — `search_catalog`: the phrase is rewritten by the free model, then the existing FTS5 index is queried with every term | OP-14 |
| Performance feedback loop | **missing** | OP-15 (optional) |

Read the two `missing by rule` rows as a promise: they are why a local, unpaid editor exists in
the first place, not gaps to apologize for.

## 3. What already works (verified in this checkout)

- **`find_highlights`** reads the word-level transcript, asks an LLM to pick self-contained
  moments, duplicates each into a 9:16 sequence and trims it, with an information-density
  fallback. No score, no reasons, no ranking.
- **`auto_reframe`** is arguably better than Opus's: `src/geometry/visual-geometry.ts`
  person/face segments first, an energy-grid pixel sampler as fallback, writing
  `__openchatcutReframeCurve` keyframes.
- **`read_script` / `apply_script`** turn the timeline into `timeline.md`, where striking a word
  deletes that video. That is Opus's editing-script idea in a form an LLM handles better than
  frame numbers.
- **Captions**: 23 styles, per-word karaoke, motion controls, translation, SRT/ASS/VTT import,
  cue editing, safe-zone placement.
- **Publishing**: `publish_to_social` + `track_social_publish` through Upload-Post to TikTok,
  Instagram, YouTube, LinkedIn, Facebook, X, Threads, Pinterest and Bluesky, with a
  preview/confirm gate. No scheduling anywhere in the repo.
- **Packaging**: `isolate_voice`, `normalize_loudness`, `detect_beats`, `sync_cuts_to_music`,
  `apply_caption_avoidance`, `place_graphics_in_safe_zone`, `apply_layout`, `update_watermark`,
  `detect_scenes`, `search_stock_media`.
- **123 MCP tools**, role-based skills, server-direct offline tools.
- Local ASR is word-level but **has no speaker diarization** (the cloud providers that do are
  paid, so rule 1 keeps them off).

## 4. The real gaps, ranked

1. No score, so no way to say *why* clip 3 beats clip 7 — the single most visible Opus behaviour.
2. No one call from source to finished clips; today it is a chain of seven tools that a skill
   has to remember in order.
3. No chapter-first segmentation, so candidates come from flat sliding windows and lose the
   arc that makes a clip coherent.
4. No async job contract for long runs, so a 40-minute source is a wall of blocking tool calls.
5. No scheduler: publishing stops at "now".
6. No social copy, so the user hand-writes every caption.
7. No brand preset, so a batch looks different from clip to clip.

## 5. Forking: what the open-source world actually offers

The short answer, after reviewing sixteen projects: **nothing is forkable wholesale** — every
clipping engine is Python-first, and the host forbids Python at runtime. What is portable is
prompt text, scoring math, the job contract and crop smoothing, and the best of it is MIT.

### 5.1 Candidates

| Repo | Stars | Stack | Licence | Take | Fork? | Effort |
|---|---|---|---|---|---|---|
| [zhouxiaoka/autoclip](https://github.com/zhouxiaoka/autoclip) | 9.7k | Python + React/Tauri | MIT | platform rule table, portrait layouts, MCP async job | idea | M |
| [OpenCut-app/OpenCut](https://github.com/OpenCut-app/OpenCut) | 96.1k | TS/Next | MIT | timeline and export UX only | idea | L |
| [modelscope/FunClip](https://github.com/modelscope/FunClip) | 6.4k | Python/Gradio + FunASR | MIT | `N. [start-end] text` contract + timestamp snapping | idea | S |
| [Anil-matcha/AI-Youtube-Shorts-Generator](https://github.com/Anil-matcha/AI-Youtube-Shorts-Generator) | 5.6k | Python CLI | MIT | virality prompt, chunk/dedupe constants | idea | S |
| [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app) | 37.8k | TS/Next | AGPL-3.0 | provider matrix, token refresh, calendar model | idea | L |
| [inovector/mixpost](https://github.com/inovector/mixpost) | 3.9k | Laravel/Vue | MIT | per-provider constraints table | idea | M |
| [SubtitleEdit/subtitleedit](https://github.com/SubtitleEdit/subtitleedit) | 14.7k | C# | MIT | line-break/CPS rules, ASS karaoke tags | idea | S |
| [FujiwaraChoki/supoclip](https://github.com/FujiwaraChoki/supoclip) | 1.9k | Python + Next | AGPL-3.0 | score axes, performance-feedback schema | idea | L |
| [jipraks/yt-short-clipper](https://github.com/jipraks/yt-short-clipper) | 1.1k | React 19 + TS + Vite | MIT | AI-direction contract, reframe enum | idea | M |
| [ClipsAI/clipsai](https://github.com/ClipsAI/clipsai) | 557 | Python/WhisperX | MIT | diarization-driven crop plan | idea | M |
| [kleZ799/clipmint](https://github.com/kleZ799/clipmint) | 20 | Python + WebView | MIT | **three-stage finalize**, 5-axis scorecard, crop math | idea | M |
| [tryvinci/vinci-clips](https://github.com/tryvinci/vinci-clips) | 156 | TS + MediaPipe | AGPL-3.0 dual | client-side MediaPipe crop loop | idea | L |
| [cellinlab/jev-highlight-cutter](https://gitee.com/cellinlab/jev-highlight-cutter) | 0 | Python CLI (Gitee) | MIT | **the best documented scoring rubric found** | idea | S |
| [KazKozDev/auto-vertical-reframe](https://github.com/KazKozDev/auto-vertical-reframe) | 24 | Python YOLO/MediaPipe | MIT | track smoothing, dead zone | idea | S |

Rejected outright: [openvideodev/react-video-editor](https://github.com/openvideodev/react-video-editor)
(source-available OpenVideo Licence; copying code is forbidden), `xenova/whisper-web` (no licence,
redundant ASR), [etro-js/etro](https://github.com/etro-js/etro) (GPL, redundant next to
Remotion), [diffusionstudio/core](https://github.com/diffusionstudio/core) (MPL, WebCodecs —
interesting, not needed).

### 5.2 The steal list, in order

1. **clipmint's three-stage finalize** — the LLM proposes spans, `boundaries.refine()` snaps them
   to sentence boundaries, then `signals.rescore()` blends measured audio against the model
   (`MODEL_WEIGHT = 0.62`), and only then dedupe (>25 % footage overlap). Without the snap and
   the rescore, a small local model's timestamps land mid-word and the rubric is decorative.
2. **clipmint's scorecard with reasons** — Hook / Moment / Look / Energy / Pace, each with one
   sentence of justification, so the user reads "strong moment, weak hook" instead of a number.
3. **Jev's rubric gates (Gitee, MIT)** — weights 30/15/25/15/15 with renormalisation when a
   dimension is unavailable; hard gates at completeness ≥ 0.65 and evidence ≥ 0.65; out at
   composite < 55; and a deterministic duration budget that never truncates a sentence to hit a
   target.
4. **Anil's virality prompt constants** — eight ranked signals (hook, emotional peak, opinion
   bomb, revelation, conflict, quotable, story peak, practical value), a content-type classifier
   pass *before* ranking, 1200 s chunks with 60 s overlap on long sources, >50 %-overlap
   candidates collapse to the higher score, strict JSON out.
5. **yt-short-clipper's direction contract** — free-text steering that outranks the built-in
   principles, a clock range (`2:00-2:50`) that bypasses the duration filter, array order = clip
   order, `{user_direction}` in the system prompt, 58–120 s default span.
6. **autoclip's async job contract** — start returns `project_id` + `poll_after_sec`; status
   returns progress, stage and eta; terminal states `completed | partial | failed | interrupted |
   cancelled`; then the export kit. Also its per-platform rule table and "N scored clips, the
   rest as alternates".
7. **clipmint's crop math** — dead zone 12 %, ease 0.45 s, speaker-switch margin 1.15×, minimum
   shot 2 s. A pure function from a track to keyframes, which is exactly what
   `setReframeKeyframe` consumes.
8. **SubtitleEdit's typography rules** — max characters per line and characters-per-second caps
   for caption line breaking, and ASS `\k` tags emitted from word timestamps for the export.
9. **FunClip's sentence-span contract** — the model returns `N. [start-end] text` and the code
   snaps to ASR token boundaries with fuzz; the cleanest way to implement "clip from the words
   *hasta que entra el coro*".

### 5.3 Licence notes

- MIT and safe to copy code from: autoclip, clipmint, Anil, FunClip, ClipsAI, yt-short-clipper,
  SubtitleEdit, mixpost, Jev, auto-vertical-reframe.
- AGPL-3.0: postiz, supoclip, vinci-clips. Compatible with this repo's AGPL in principle, but
  all three are Python or Next.js apps that cannot run here.
- Never copy: react-video-editor's OpenVideo Licence; `xenova/whisper-web` has no licence at all.
- Practical rule: **copy the numbers and the prompt text, write the code in TypeScript next to
  the code that already does the neighbouring job**, and keep a comment naming the source.

### 5.4 Gitee and GitCode

- Gitee's search is JS-only and its public API returns `[]` unauthenticated; repositories are
  mostly mirrors of GitHub (`Janisa/autoclip`, `GitSharp/pyJianYingDraft`). One original find,
  and it is a good one: `cellinlab/jev-highlight-cutter` — a scoring rubric better documented
  than anything on GitHub, though its code is Python plus a paid API.
- GitCode is now branded AtomGit and is overwhelmingly a GitHub mirror (`GitHub_Trending/*`,
  `gh_mirrors/*`), with inflated star counts (MoneyPrinterTurbo shows 135k against ~78k
  upstream). Search for 视频切片 returns 7 repositories, 长视频转短视频 returns 2 792 but the top
  hits are text-to-video generators, not clippers. Nothing forkable; `ChopperBot` (Java
  livestream clipper) and `MioSub` (TS ASR→ASS burn, needs a Gemini key) are the only
  interesting non-mirrors.
- Conclusion: the Chinese ecosystem adds no capability the GitHub list lacks. Port the rubric,
  skip the code.

## 6. The plan

Fifteen tasks in four phases. Every task ships UI + MCP tool + a `*.verify.ts`, per `AGENTS.md`,
and the verify is registered in `test:serial`.

### Phase A — the score and the one call

**OP-01 · `score_moments`: a transparent rubric engine** · effort M · needs —
- New `src/agent/shorts/`, pure and testable, no React:
  - `chapters.ts` — chapter segmentation: transcript topic shifts (word-gap + lexical change)
    crossed with `detect_scenes` boundaries, so candidates come from chapters, not flat windows.
  - `signals.ts` — deterministic per-candidate features: hook words in the first 3 s, question
    and claim openers, sentence completeness, words/second and variance, silence ratio,
    quotability (first person, numbers, named entities), laughter and exclamations, and an energy
    delta from `src/audio/beats.ts`.
  - `rubric.ts` — one free-LLM pass (the existing `llm-proxy`: DeepSeek Harness or a local
    Ollama/LM Studio) using the ported prompt: content-type classifier first, then eight ranked
    signals, strict JSON with a sub-score and one reason sentence per dimension.
  - `score.ts` — the blend and the gates: deterministic 60 / model 40, sentence-boundary snap,
    audio rescore before ranking, dedupe on >40 % overlap, and the Jev-style gates (completeness
    and evidence) that drop incoherent candidates instead of down-ranking them.
- Public subscores are **Hook, Flow, Value, Sound**. Trend is deliberately absent: it needs
  platform trend data we do not have, and faking it would be the exact dishonesty this plan
  forbids. `trend: null` with an explanation in the tool result.
- `modelUsed: false` path must return the deterministic score alone, so the feature works with
  providers off.
- MCP `score_moments` (`itemId`, `direction`, `minSeconds`/`maxSeconds`, `count`, `profile`,
  `timeRange`, `topic`).
- Verify: fixture transcript, stable ranking, every score carrying sub-scores and reasons, and
  the no-model path green.

**OP-02 · `find_highlights` ranks, snaps and dedupes** · effort S · needs OP-01
- Sort by score, honour `minScore`, apply sentence snap and dedupe, and return
  `[{sequenceId, startFrame, endFrame, score, subscores, reason, risks}]` plus `rejected[]` with
  why. The heuristic fallback stays for sources with no transcript.
- No new tool; the existing schema gains `minScore`, `profile`, `direction`.

**OP-03 · `make_shorts`: source in, clips out** · effort L · needs OP-02
- Composes what exists — transcript, score, one sequence per accepted moment, reframe, caption
  style, optional headline, render queue — and adds nothing the individual tools cannot do.
- Async contract ported from autoclip: returns `analysisId`, `pollAfterSec`, per-clip stage, and
  terminal `completed | partial | failed | cancelled`; `track_progress` reports it. Alternates
  (scored but not selected) are returned, capped, so the user can promote one.
- Per-platform rule table: aspect, minimum duration, caption preset, title limit. Opus's split
  survives: `direction` steers retrieval only; render config comes from the brand kit.
- Degrades honestly: no browser tab → `reframe: 'skipped'` and a centre crop; no model →
  deterministic scores.

**OP-04 · Calibration ledger** · effort M · needs OP-01
- `server/shorts-calibration.ts` on the existing SQLite store: `(projectId, sourceId, startFrame,
  endFrame, score, decision approved|rejected, at)`.
- `calibrate_scores` returns weight nudges and a suggested `minScore` from history;
  `score_moments` accepts `calibration: true`. Under 12 decisions it returns identity weights and
  says so — no pretend learning.

**OP-05 · "Analizar episodio" panel** · effort M · needs OP-03
- A panel (media-pool context menu and the clip panel) listing candidates: score chip with the
  four sub-scores, a three-frame strip, the reason line, the risk flags, a checkbox and "Crear N
  clips". Score is the default sort, like Opus. Spanish copy: "Potencial", "Gancho", "Flujo",
  "Valor", "Sonido", "Descartar".

### Phase B — packaging

**OP-06 · `tighten_speech`** · effort M
- One call in the `read_script` grammar: Spanish fillers ("eh", "este…", "o sea", "¿no?", "po…"),
  dead air over a threshold (default 0.5 s, matching Opus), repeated false starts. Never
  truncates a sentence to hit a target.
- Human in the loop, like Opus: a review list of what would be removed, with playhead jumps,
  before anything is deleted. One undo step; locked tracks skipped.

**OP-07 · `censor_words`** · effort S
- Transcript hits against a Spanish profanity list plus a user list; three modes — mute, tone,
  or burn `****`. Volume keyframes or caption-run overrides through `ctx.commands`, so one call
  is one undo. Panel lists hits with jumps.

**OP-08 · Keyword emphasis (reshaped 2026-10-25: no new presets)** · effort M
- **Dropped: the four new presets.** The repo already ships 22 caption templates, and
  `tiktok`, `story`, `bold-outline` and `bili` cover bold karaoke, yellow highlight, heavy
  outline and boxed white. Four near-duplicates buy a longer menu, not a better short. If one
  specific look is genuinely missing, name it and add *one* style.
- **Also already shipped:** line breaking (`CAPTION_MAX_CHARS_PER_LINE`,
  `CAPTION_MAX_VISUAL_LINES`, `paginate`) and ASS emission from word timestamps in
  `src/captions/exportCaptions.ts`. Do not rebuild either.
- **The real gap is per-word emphasis.** `CaptionStyle.highlightColor` colours the *active*
  word by time, and `CaptionWordOverride` carries only `hidden` / `text` / `forceBreak` /
  `timingOffsetMs`; `src/captions/resolve.ts` is the single place overrides are honoured. So:
  - add `emphasis?: boolean` to `CaptionWordOverride` and to the caption action that writes it;
  - carry it through resolve → runs → layer (`resolve.ts`, `captionWordRuns.ts`,
    `CaptionsLayer.tsx`) **and** the Remotion caption component, or preview and export disagree;
  - `keywordCandidates(words)` (pure): numbers, proper nouns, ALL-CAPS words, with a cap.
- Done when: an emphasised word renders in the preview **and** in an exported frame, the flag
  survives save/load, and a cue with no emphasis renders byte-identically to today.
- Verify: `src/captions/keywordEmphasis.verify.ts` (selection + override application) plus one
  exported frame compared against a fixture, because this one is visual.

**OP-09 · `write_clip_title`** · effort S
- Quotable line, not a summary; ≤ 6 words; written as a headline in the caption safe zone via
  `place_graphics_in_safe_zone`. Applied to the top N clips only — Opus caps at ten for cost
  reasons; we cap at the batch size and say why.

**OP-10 · Brand kit** · effort L · the document change is the cost
- `BrandKit` on `ProjectDoc`: logo asset, fonts, palette, caption preset, safe margins,
  intro/outro, watermark position, default transitions — the `renderPref` equivalent.
- Order that keeps it honest:
  1. type + `normalizeBrandKit` with defaults, and a reader that returns defaults for projects
     saved before the field existed. Do **not** write a migration that rewrites every project:
     the store already tolerates an absent field, and a rewrite is risk without benefit.
  2. `apply_brand_kit` over a batch of sequences, through existing commands only
     (`update_watermark`, `manage_design_style`, caption `template`, `search_fonts`).
  3. the "Marca" Settings page.
  4. `make_shorts` already documents a `brandKitId`; wire it to this instead of leaving it a
     promise in a description.
- Done when: a kit saved on one project applies to another project's clips in one call, and a
  project saved before the field opens unchanged and looks the same.
- Verify: `src/brand/brandKit.verify.ts` (defaults, round trip, apply plan) plus
  `verify:components` for the Settings page.

**OP-11 · Reframe stabilization** · effort S · done 2026-10-25 (one half deferred)
- Shipped: `src/reframe/stabilize.ts`, wired into `auto_reframe` after both detection paths —
  dead zone 12 %, ease 0.45 s, minimum shot 2 s (clipmint's crop math, MIT).
- Deferred, with the reason: the cheap modes `centred-black-bars` / `centred-blurred-fill`.
  `AspectFit` is `contain | cover` only and is a **sequence-level** property, while
  `auto_reframe` is clip-level: setting it from the clip tool would silently re-frame every
  other clip in the sequence. Doing it honestly needs a sequence-level mode or a per-clip
  background fill.

### Phase C — the publishing tail

**OP-12 · `write_social_copy`** · effort M
- Per-platform title, description and hashtags with the real limits (YouTube 100-char title /
  5 000-char description, Instagram and TikTok 2 200, X 280), stored on the sequence as
  `socialCopy` and prefilled into the publish preview.
- No invented trend hashtags: if the model has no basis, it returns fewer hashtags.

**OP-13 · Scheduled publish** · effort L · needs OP-12
- `server/publish/schedule.ts` (pure queue maths) + `server/plugins/publish-schedule.ts`: a
  durable queue in the profile's SQLite (`scheduledFor` ISO, per-platform rows, attempts, last
  error), a 30 s tick while the dev server runs, idempotent resume after a restart, and a
  declared missed-slot rule (publish late, record it).
- MCP: `schedule_publish`, `list_scheduled_publishes`, `cancel_scheduled_publish`;
  `publish_to_social` gains `when`.
- UI: a week calendar ("Programar") with platform chips and drag-to-reschedule.
- **Do not weaken the publish gate.** A scheduled post still needs the preview/confirm pair at
  scheduling time; the tick may only execute what a human approved, and it must refuse an entry
  whose preview no longer matches the render (`preview_mismatch` already exists for this).
- Done when: a post scheduled two minutes out publishes with no tab open, a restart mid-wait
  does not double-post, and cancelling before the slot leaves nothing behind.
- Verify: `server/publish/schedule.verify.ts` (queue + due maths) and
  `server/plugins/publish-schedule.verify.ts` (route + tick against a stubbed uploader).

### Phase D — optional

**OP-14 · `search_catalog`** · effort L · done
- `search_content` already does FTS5 across chats, captions and transcripts in every project.
  Extend it to visual descriptions and embeddings so "find the part where I explain the chorus"
  finds a scene, not just a word. Only if the earlier phases earn it.

**OP-15 · Performance loop** · effort M · optional
- Import a CSV of published views/retention, join it to the calibration ledger, report score
  bands against real performance, and offer recalibrated weights. No platform API, no scraping.

### OP-14: how it was done, 2026-10-25

The card asked for "visual descriptions and embeddings". Checked first, and the repo has no
text-embedding model: `src/media/semantic-search/` embeds **frames** with a vision model for
duplicate detection, and `search_content` is FTS5 over chats, captions and transcripts.

Rather than add a dependency, the semantic step moved **in front of** the index: the free local
model rewrites the phrase into the words an editor would have written, then the existing index is
queried with each term and the hits are merged by `(project, ref)` and ranked by how many terms
matched. The user's literal phrase is always one of the terms, so expansion can only add recall —
if the model is off, the search degrades to exactly what it was before.

`src/agent/search/queryExpansion.ts` + `src/agent/tools/catalog-search-tools.ts`, six tests.
The alternative — image similarity over the vision model — is recorded here as the road not
taken: it needs no model either, but it answers "find scenes that look like this" rather than
"find where I explain the chorus".

### The one visual gap

`keywordEmphasis` is proven at the rule level (`captionWordColour`) and at the channel level
(`applyWordOverrides` → `word.emphasis` → the layer), and preview and export share
`CaptionsLayer`. What is **not** proven is pixels: no exported frame has been compared. Closing
it needs a render verify on top of `remotion/serve-bundle.mjs` + `renderStill` (the existing
`video-decoder-render.verify.mjs` is the model to copy), two stills of the same cue — one with
emphasis, one without — and a pixel compare at the word. That webpack bundle is ~150 MB and the
run takes minutes per still, which is why it was not attempted at the end of a long session.

## 7. Rules this plan respects

1. **No paid API.** Scoring uses the free DeepSeek Harness gateway or a local Ollama/LM Studio;
   everything else is DSP, ffmpeg or an existing local model. Opus's AI B-roll, dubbing, voice
   clone and thumbnail generator are out of scope **by rule**, not by omission.
2. **No new runtime.** No Python, no new framework or UI library. Ports are prompts, constants
   and math, re-implemented in TypeScript next to the code that already does the neighbouring
   job, with the source named in a comment.
3. **UI + MCP + verify** per task, registered in `test:serial`, tool catalog regenerated.
4. **Spanish UI, English code.** Potencial, Gancho, Flujo, Valor, Sonido, Apretar el habla,
   Censurar, Marca, Programar.
5. **The timeline stays the editor of record.** `make_shorts` produces ordinary sequences with
   ordinary keyframes; nothing becomes a special Opus-style read-only project.

## 8. Risks

- **The score will be weaker than Opus's.** The mitigation is the rubric framing, the visible
  sub-scores, the gates that reject incoherent candidates instead of scoring them low, and
  calibration from the user's own decisions. The failure mode to avoid is a confident number
  nobody trusts.
- **Free-model latency.** Score in 20-minute chunks with 60 s overlap (Anil's constants), cache
  by content hash, bound concurrency, and keep the deterministic path usable alone.
- **Scheduling only runs while the server runs.** Document it in the UI; a missed slot publishes
  late and says so.
- **Reframe needs a tab** for pixel sampling; the geometry path works headless. Say which one ran.
- **Scope creep.** The non-goals are listed on purpose; anything that needs a hosted model stays
  off even when it would be easy.

## 9. Decisions made while writing this

- **Four sub-scores, one of them ours.** Opus shows Hook/Flow/Value/Trend. We show
  Hook/Flow/Value/Sound and return `trend: null`, because we have no trend feed and a fabricated
  trend score would be the one thing a test cannot catch.
- **Chapter-first, not window-first.** The plan segments before it scores, following Opus's own
  account of where its coherence comes from — this is the cheapest structural win available.
- **Scheduling is built, not forked.** A queue is a table, a tick and a calendar; forking a
  Next.js scheduler would add a second app and a second database for no gain. Postiz and mixpost
  contribute their provider rules only.
- **`make_shorts` is a composition, not an engine.** If it needs editing logic the individual
  tools lack, that logic belongs in the tool first.
- **No "AI Producer" equivalent.** Opus's newest feature writes a story and generates the video.
  That is Plan 1's `videocut` skill territory and it needs paid generation APIs.
- **The fork answer is deliberately unromantic.** Sixteen repositories were reviewed; none can
  be forked into a React 19 + Remotion app, and pretending otherwise would waste a phase. The
  value is in nine artefacts, all MIT, listed in §5.2.
