# Music Video Editor Guide

A Spanish-first, Premiere Pro-style editing workspace built on top of [OpenChatCut](https://github.com/0xsline/OpenChatCut) (AGPL v3). This fork keeps the upstream agent-native architecture and adds the tools a music-video workflow needs: smooth Ken Burns moves on stills, karaoke subtitles, duplicate-shot detection, dual time display, advanced export presets, and a Source Monitor.

<p align="center">
  <img src="../screenshots/03-full-editor.png" alt="Editor overview" width="900" />
</p>

---

## Quick start

Requirements: **Node.js 24.x** (the project declares `>=24 <25`), npm 10+, and a Chromium-compatible browser.

```bash
npm install
npm run dev          # http://localhost:5199
```

The UI starts in **Spanish**; switch to English with the ES/EN toggle in the top bar. AI features are optional — the editor, captions, and local rendering work with no API keys. If you want cloud generation or transcription, copy `.env.example` to `.env` and fill in only the providers you use.

Build and preview a production bundle:

```bash
npm run build
npm run preview
```

---

## Interface tour

| Area | What it does |
| --- | --- |
| Top bar | Project name, ES/EN switch, undo/redo, export, settings |
| Media pool (left) | Import/drag media, search, right-click for **Abrir en el monitor de origen** |
| Preview workspace (center) | Source Monitor above the Program Monitor |
| Inspector (right) | Transform keyframes, filters, colour, audio, Ken Burns, effects |
| Timeline (bottom) | Video/audio/caption tracks, tools, markers, snapping, zoom |
| Effects library | Searchable transitions, effects, scale presets, LUTs — drag onto a clip |

Screenshots: [`01-editor-overview.png`](../screenshots/01-editor-overview.png) · [`03-full-editor.png`](../screenshots/03-full-editor.png) · [`04-editor-with-panels.png`](../screenshots/04-editor-with-panels.png) · [`dashboard-spanish.png`](../screenshots-spanish/dashboard-spanish.png)

---

## Music-video feature tour

### Ken Burns (pan & zoom on stills)

Select an image clip on the timeline and open **Inspector → Efecto Ken Burns** (images only). The panel writes two transform keyframes — one at the clip start, one at the clip end — with a shared easing curve. Because the geometry is evaluated with fractional values in both preview and export, motion is sub-pixel smooth at any frame rate, with no FFmpeg jitter. The whole gesture is a single undo step.

- Start/end position (X/Y) and scale
- Easing selection (`easeInOut` and friends)
- Preview and export share the same `previewTransform` path
- Export fps presets: 24 / 25 / 30 / 50 / 60

Implementation: `src/editor/kenBurns.ts`, `src/components/inspector/KenBurnsControls.tsx`, verifier `src/editor/kenBurns.verify.ts`.

### Karaoke subtitles (ASS/SRT)

The caption engine supports word-level fill animation:

| Preset | Look |
| --- | --- |
| **Karaoke balada** (`karaoke-verse`) | Georgia serif, white, bottom center |
| **Karaoke grito** (`karaoke-chant`) | Impact bold, red, centered, yellow highlight |
| **Karaoke relleno** (`karaoke-fill`) | Arial, white, bottom, colour sweep |

- Import `.srt` / `.ass` (word-level `{\k}` timing is parsed) and export `.srt` / `.ass`
- Visual cue editor plus a word-timing table driven by transcript timings
- Styles are ordinary caption templates, so preview and export render identically

Implementation: `src/captions/KaraokePresets.ts`, `src/captions/ass.ts`, `src/captions/exportCaptions.ts`.

### Duplicate shot detector

Timeline **more menu → Detección de Fragmentos Duplicados**. The scanner samples a frame at each clip midpoint (whole still for images), computes a 64-bit dHash, and groups clips within a tunable Hamming threshold (default 6). Clicking a group selects every matching clip so you can remove repeated footage. Verified with four identical stills: one group at 100% similarity.

Implementation: `src/duplicates/perceptualHash.ts`, `src/duplicates/duplicateScan.ts`, `src/components/DuplicateDetector.tsx`.

### Time display modes

Click the timeline timecode to toggle between **elapsed** (`0:00:05.23`) and **countdown** (`-0:03:54.77`). The mode is persisted in `localStorage['cc.timeDisplayMode']`, clamped at zero, and repaints through `formatTimecode`.

Implementation: `src/components/timeline/CountdownToggle.tsx`, verifier `src/components/timeline/timeDisplay.verify.ts`.

### Source Monitor

Right-click any video, audio, image, GIF, or SVG in the media pool and choose **Abrir en el monitor de origen**. The Source Monitor sits above the Program Monitor and gives you a true two-up viewing workflow:

- Scrub, play/pause, step one frame, jump Home/End
- Set in/out points with `I` / `O` (or the panel buttons)
- Range duration readout and reset
- **Insertar en la línea de tiempo** inserts exactly the selected range at the playhead, as one undoable command

Implementation: `src/media/sourceMonitor.ts` (pure helpers), `src/media/sourceMonitorStore.ts`, `src/components/preview/SourceMonitorPanel.tsx`, verifier `src/media/sourceMonitor.verify.ts`.

### Markers

- `M` adds a marker at the playhead; `Mod+M` adds and opens the editor
- `Shift+M` / `Alt+M` modify / delete the marker at the playhead
- `Shift+↑` / `Shift+↓` jump between markers
- Eight colour labels, inline notes, click-to-seek marker list
- Clip markers are separate from project markers

### Colour and image controls

Inspector filters expose **brightness, contrast, saturation, blur**, plus an **exposure** and **temperature** pass for colour correction. Auto-grade performs a local sample analysis for small brightness/contrast/saturation corrections. LUT support is available through the LUT effect assets (`.cube` files in the effects library), applied per clip through the effect stack.

---

## Keyboard shortcuts

`Mod` is **Cmd** on macOS and **Ctrl** on Windows/Linux. The in-app list lives at **Mod+Alt+K**.

### Playback

| Action | Keys |
| --- | --- |
| Play / Pause | `Space` |
| Previous / next frame | `←` / `→` |
| Step back / forward 1 s | `Shift+←` / `Shift+→` |
| Shuttle back / forward / pause | `J` / `L` / `K` |
| Jog one frame | `K+J` / `K+L` |
| Go to start / end | `Home` / `End` |
| Previous / next edit | `↑` / `↓` |
| Mark in / out / clear | `I` / `O` / `X` |
| Mark clip at playhead | `/` |
| Fullscreen preview | `` ` `` |

### Editing

| Action | Keys |
| --- | --- |
| Undo / Redo | `Mod+Z` / `Mod+Shift+Z` or `Mod+Y` |
| Copy / Cut / Paste | `Mod+C` / `Mod+X` / `Mod+V` |
| Paste effects | `Mod+Alt+V` or `Mod+Shift+B` |
| Duplicate clip | `Mod+D` |
| Split at playhead | `Mod+K` or `Enter` |
| Ripple delete | `Backspace` / `Delete` |
| Lift (leave gap) | `Shift+Backspace` / `Shift+Delete` |
| Select all | `Mod+A` |
| Select clips forward | `Shift+Y` |
| Selection / Ripple / Slip / Razor | `V` / `B` / `Y` / `C` |
| Pen / Text / Hand / Zoom | `P` / `T` / `H` / `Z` |
| Nudge left / right (1 or 5 frames) | `E` / `R` (hold `Shift` for 5) |
| Trim to in / out | `Q` / `W` |
| Move clip up / down a track | `Alt+↑` / `Alt+↓` |
| Snap to left / right boundary | `Ctrl+E` / `Ctrl+R` |
| Save version | `Mod+S` |

### Timeline view and markers

| Action | Keys |
| --- | --- |
| Zoom in / out | `Mod+=` / `Mod+-` (or `=` / `-`) |
| Zoom to fit | `Shift+Z` |
| Toggle snapping | `S` |
| Add marker | `M` |
| Add marker + open editor | `Mod+M` |
| Modify / delete marker at playhead | `Shift+M` / `Alt+M` |
| Previous / next marker | `Shift+↑` / `Shift+↓` |
| Focus AI chat | `Tab` |

Shortcut dispatch is surface-aware: timeline editing keys only fire when focus is in the timeline (project-level actions such as undo, redo, save, shortcuts, and ask-AI work everywhere). See `src/shortcuts/shortcutScope.ts`.

---

## Export

Open the export dialog from the top bar. Settings:

| Setting | Options |
| --- | --- |
| Resolution | 720p (1280×720), 1080p (1920×1080), 4K (3840×2160) |
| Codec | H.264 (libx264), H.265/HEVC (libx265, server render) |
| Quality | CRF 18–28, or a target bitrate (mutually exclusive) |
| Frame rate | 24 / 25 / 30 / 50 / 60 |
| Audio | AAC 192 kbps (encoder-delay compensated) |
| Container | MP4 with `+faststart` (progressive playback) |

Estimated output size is shown in the summary (`src/export/exportPresets.ts`). Rendering runs through Remotion; the server route adds the HEVC retime pass and muxes with `-movflags +faststart`. Browser export is available when no server is present, with the codecs the browser can encode.

**Known limitations**

- 2-pass encoding is not implemented — Remotion renders single-pass CRF or bitrate.
- HEVC export requires the server renderer; the browser route rejects it.
- Audio EQ/compressor inserts are not implemented in the client DSP chain. Voice cleanup is available as a server-side FFmpeg plugin (`highpass/lowpass/afftdn/acompressor`), not as per-clip realtime inserts.

---

## Architecture and internal API

The editor is a command-driven React 19 app. UI surfaces never mutate the project directly; they call typed commands, which keeps undo/redo, toolbar buttons, and keyboard shortcuts in lockstep.

- **Editor commands** — `src/editor/` command layer (`addMediaItem`, `setItemTiming`, `split`, transitions, track ops, …). Every gesture coalesces into one history step.
- **Cross-panel stores** — small `useSyncExternalStore` modules such as `src/media/sourceMonitorStore.ts` and the duplicate-detector store, so panels stay decoupled.
- **Pure helpers + verifiers** — geometry/range logic lives in pure modules (`sourceMonitor.ts`, `kenBurns.ts`, `perceptualHash.ts`, `timeDisplay.ts`) with matching `*.verify.ts` scripts run by `tsx`.
- **Rendering** — Remotion composes the same project document used by preview; export routes live under `src/export/` and `server/plugins/export-*`.
- **i18n** — Chinese-key dictionaries with lazy locale loading; Spanish and English entries are required for every new UI string (`npm run verify:i18n`).
- **Agent/MCP** — upstream tool surface remains available; the custom features are ordinary timeline/caption commands, so agents can drive them too.

### Verification

```bash
npx tsc -b --force
npm run verify:i18n
npm run verify:editor
npm run verify:shortcuts
npm run verify:export-adaptive
npm run verify:export-gl
```

The music-video additions have dedicated verifiers:

```bash
npx tsx src/editor/kenBurns.verify.ts
npx tsx src/media/sourceMonitor.verify.ts
npx tsx src/components/timeline/timeDisplay.verify.ts
npx tsx src/captions/KaraokePresets.verify.ts
npx tsx src/duplicates/perceptualHash.verify.ts
npx tsx src/export/exportPresets.verify.ts
```

---

## End-to-end workflow (verified)

1. Import video, audio, and stills into the media pool
2. Drag clips to the timeline and arrange the song structure
3. Apply a Ken Burns move to each still
4. Import an `.srt`, choose a karaoke style, and adjust word timings
5. Grade clips with exposure/temperature or filters
6. Add transitions at section changes
7. Open the Source Monitor, set in/out, and insert a selected range
8. Export 1080p H.264, then play the output back

Browser checks were performed for import, timeline drag, Ken Burns, captions/karaoke, colour grade, transitions, Source Monitor insert + undo, duplicate detection, and export. Automated checks cover the pure logic and command layer as listed above.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `npm install` blocks lifecycle scripts | npm 11+ ignores them by default; the repo's `.npmrc`/script policy allows the required ones — see the upstream install notes |
| Wrong Node version | Use Node 24 (`nvm use 24`); the project requires `>=24 <25` |
| Export fails on Linux/WSL | Install the Chromium shared libraries (`libnspr4`, `libnss3`) or point `LD_LIBRARY_PATH` at `.local-libs/` |
| Spanish text still shows Chinese | Run `npm run verify:i18n`; add the missing key to both `src/i18n/dict/en/*` and `src/i18n/dict/es/index.ts` |
| Dev server unreachable from a VM host | `server.host` and `allowedHosts` are already configured in `config/vite.config.ts` |

---

## License and credits

This project is a modified fork of OpenChatCut, licensed under **AGPL v3**. See [`LICENSE`](../LICENSE) and the upstream [README](../README.md). The custom music-video modules listed above are distributed under the same license.
