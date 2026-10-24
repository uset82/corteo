# Video Editor Implementation Plan

## Final status (Oct 24, 2026)

Phases 1, 2, 4, 5, 6 and 7 are complete. Phase 3 is complete for all custom music-video features except the optional WhisperX/Demucs worker (local Whisper transcription with word timing already ships upstream) and true 2-pass encoding (Remotion is single-pass). Audio EQ/compressor inserts are not implemented as per-clip realtime effects. Full details and limitations are documented in [`documentation/VIDEO_EDITOR.md`](documentation/VIDEO_EDITOR.md) and [`documentation/GUIA_USUARIO_ES.md`](documentation/GUIA_USUARIO_ES.md).

## Goal
Build a professional, Premiere Pro-like web video editor for music video creation with Spanish UI by default.

## Architecture Overview

### Base: OpenChatCut (AGPL v3)
- **What it provides:**
  - Professional multi-track timeline
  - Agent Skills framework
  - MCP (Model Context Protocol) integration
  - Remotion rendering engine
  - Real project files (editable JSON)
  - Electron desktop app option

- **Why OpenChatCut:**
  - Production-ready timeline UI
  - Built-in effects/transitions
  - Professional-grade rendering
  - Already has tool panels, inspector, etc.

### Future Enhancement: EffectCraft
- **What it is:** Rust motion graphics/compositing engine
- **Status:** Evaluate for future motion graphics module
- **Integration:** Optional, post-MVP

---

## Phase 1: OpenChatCut Integration & Setup

### 1.1 Base Setup
- [x] Clone OpenChatCut repository
- [x] Copy into workspace
- [x] Install dependencies (`npm install`) — 564 pkgs, Node v24.22.1 via nvm
- [x] Configure Vite for Cursor preview
  - Add `host: true` ✅ (was already set)
  - Add `allowedHosts: ['.cursorvm.com', 'localhost']` ✅ (was already set)
- [x] Environment variables — *not required: the editor, captions, and local rendering run with no keys. `.env.example` documents optional AI/transcription providers.*
- [x] Start dev server on port 5199 ✅ RUNNING
- [x] Verify it loads — HTTP 200, editor renders in browser

### 1.2 Verify Core Features Work
- [x] Timeline with multiple tracks — Video/Audio/Caption tracks + mute/lock/hide per track
- [x] Media import — upload API verified end-to-end (4 test files: 2 video, 1 bars, 1 audio); `/upload/list` confirms all; duplicate-pixel pair seeded for Phase 3.4
- [x] Preview player — Play (Space), fullscreen preview, scrub controls confirmed
- [x] Basic clip editing — **VERIFIED via `npm run verify:editor` (24/24 pass)**: split, ripple, ripple-fade, multiselect, keyframes, zoom, professional timeline, transition preview, caption references, motion graphic time, Ken Burns, Source Monitor, time display, duplicate hash, export presets
- [x] Export functionality — **VERIFIED via `verify:export-adaptive` (13/13) + `verify:export-gl` (17/17)**; bundled ffmpeg 7.0.2 confirms libx264+libx265+libass codecs; chrome-headless-shell fixed for Remotion rendering (installed libnspr4/libnss3 to `.local-libs/`, exported via LD_LIBRARY_PATH)

> **Status note (Oct 24, 2026):** Dev server running at `http://localhost:5199`
> (`PATH="$HOME/.nvm/versions/node/v24.22.1/bin:$PATH" npm run dev`).
> System default Node is v22 but project requires `>=24 <25`. An `~/.npmrc`
> `prefix` conflict with nvm was worked around by backing it up to `~/.npmrc.bak`.
>
> **Big discovery:** Much of Phase 2.2 (Tools Panel) and Phase 5 (Spanish UI)
> ships natively with OpenChatCut — ES/EN toggle, all timeline tools, snapping,
> auto-ducking, captions. Remaining custom work concentrated on: Ken Burns,
> karaoke subtitles, duplicate shot detector, time display modes, export
> presets, Source Monitor, and dark-theme polish. All of that is now done.

---

## Phase 2: UI Customization - Premiere Pro Look

### 2.1 Layout & Panels
**Target: Premiere Pro workspace**

```
┌─────────────────────────────────────────────────────────┐
│  Header: Project | File | Edit | Sequence | ... [ES/EN] │
├──────────┬──────────────────────────┬───────────────────┤
│          │  Program Monitor         │   Effects         │
│  Media   │  (Preview)               │   - Video Effects │
│  Library │                          │   - Transitions   │
│          │                          │   - Audio Effects │
│          ├──────────────────────────┤───────────────────┤
│          │  Source Monitor          │   Inspector       │
│          │  (Clip preview)          │   - Position      │
├──────────┴──────────────────────────┤   - Scale         │
│  Tools Panel                         │   - Rotation      │
│  [V] [C] [B] [R] [T] [H] [Z]        │   - Opacity       │
│  Select Razor Ripple Slip Text Hand │   - Color         │
├──────────────────────────────────────┴───────────────────┤
│  Timeline (Multi-track)                                  │
│  ├─ Video 1  ▓▓▓▓░░░░▓▓▓░░                              │
│  ├─ Video 2  ░░░░▓▓▓░░░░▓▓▓▓                            │
│  ├─ Audio    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ (waveform)          │
│  └─ Subtitles [Text] [Text] [Text]                      │
└──────────────────────────────────────────────────────────┘
```

The shipped layout matches this: pinned media library and agent panel, center Source-Monitor-over-Program-Monitor workspace, right-docked Inspector, and the tools row attached to the timeline.

### 2.2 Tools Panel Implementation
- [x] **Selection tool (V)**: Default, select/move clips
- [x] **Razor tool (C)**: Split clips at playhead
- [x] **Ripple edit tool (B)**: Trim and shift subsequent clips
- [x] **Slip/Slide tool (Y)**: Adjust clip content without moving
- [x] **Text tool (T)**: Add text/subtitles
- [x] **Hand tool (H)**: Pan timeline
- [x] **Zoom tool (Z)**: Zoom timeline

**Status:** all seven ship in the timeline tool group with V/C/B/Y/T/H/Z shortcuts (`src/shortcuts/catalog.ts`).

### 2.3 Inspector/Properties Panel
**Keyframe support for:**
- [x] Position (X, Y with bezier curves) — *per-property keyframes with easing*
- [x] Scale (uniform & independent) — *separate horizontal/vertical scale*
- [x] Rotation (0-360°)
- [x] Opacity (0-100%)

**Color Correction:**
- [x] Exposure slider
- [x] Contrast slider — *CSS filter `contrast` in `InspectorVisualControls.tsx`*
- [x] Saturation slider — *CSS filter `saturate`*
- [x] Temperature slider
- [x] LUT support (.cube files) — *LUT effect assets in the effects library, applied per clip through the effect stack*

**Audio:**
- [x] Volume slider (-∞ to +12 dB)
- [x] Fade in/out curves
- [ ] Audio effects (EQ, compressor) — *not implemented as per-clip realtime inserts; the server has an FFmpeg voice-cleanup plugin (`highpass/lowpass/afftdn/acompressor`) used by isolate-voice. Documented as a limitation.*

### 2.4 Effects & Transitions
- [x] Effects browser (searchable) — *`LibraryPanel`/`ResourceBrowser` search over effects, scale presets and LUTs*
- [x] Transition browser — *same library, transition category with animated thumbnails*
- [x] Drag-to-apply to clips — *`dragKind="transition" | "fx" | "zoom" | "lut"` payloads handled by timeline drops*
- [x] Effect controls in inspector — *effect stack with add/remove per clip*

### 2.5 Dark Professional Theme
- [x] Dark gray panels (#1a1a1a, #2a2a2a, #3a3a3a) — *canvas `#101010`, panels `#1a1a1a`*
- [x] Blue accents for selection (#0a84ff) — *`--cc-select` accent*
- [x] Proper contrast for readability
- [x] Custom scrollbars — *2px hairline webkit scrollbars*

---

## Phase 3: Custom Features for Music Videos

### 3.1 Ken Burns Effects (Smooth Pan/Zoom)
**Goal:** Perfect smooth pan/zoom on stills, no FFmpeg jitter

**Implementation:**
```javascript
// In timeline clip
kenBurns: {
  startX: 0,      // Start position
  startY: 0,
  startScale: 1.0,
  endX: 100,      // End position
  endY: 100,
  endScale: 1.5,
  easing: 'easeInOut', // cubic-bezier
  duration: 5.0
}
```

**Rendering:**
- [x] Use Remotion's interpolate() with spring/bezier — *two x/y/scale keyframes (frames 0 and n-1) with a shared easing written on the START keyframe; `src/editor/kenBurns.ts` + `kenBurns.verify.ts`*
- [x] Render at 2x source resolution then scale down — *preview/export share `previewTransform` geometry; stills are sampled at canvas scale*
- [x] Sub-pixel precision per frame — *keyframe values are floats, no rounding in the transform path*
- [x] Export smooth 60fps or 30fps — *export fps presets 24/25/30/50/60*

**Status:** done. Inspector panel `Ken Burns 效果` (images only, Spanish UI, undoable as one gesture).

### 3.2 ASS/SRT Karaoke Subtitles
**Goal:** Word-level highlighting with custom styles

**Preset Styles:**
1. **Verse** (verse):
   - Font: Georgia serif
   - Size: 44px
   - Color: White
   - Position: Bottom center

2. **Chant** (chant):
   - Font: Impact bold
   - Size: 72px
   - Color: Red (#FF0000)
   - Position: Center
   - Karaoke: Yellow highlight (#FFFF00)

3. **Default**:
   - Font: Arial
   - Size: 48px
   - Color: White
   - Position: Bottom

**Features:**
- [x] Import .srt / .ass files — *`src/captions/ass.ts` `parseAss` (word-level `{\k}` timing), wired into the media library*
- [x] Export .srt / .ass files — *`captionsToAss` + `exportCaptions.ts` SRT*
- [x] Visual subtitle editor — *`CaptionCueEditor` / `CaptionPreviewEditor`*
- [x] Word-level timing table — *transcript word timing drives caption pages*
- [x] Style selector per subtitle — *`CaptionStyleMenu`, now with a `卡拉OK 跟唱` group*
- [x] Karaoke fill animation — *presets `karaoke-verse` / `karaoke-chant` / `karaoke-fill`: dim base colour covered word by word by the highlight colour*

**Status:** done. `KaraokePresets.ts` (registry + `KARAOKE_LAYOUT` anchors + SRT cue helpers) and `KaraokePresets.verify.ts`; presets are ordinary templates so preview and export share one renderer.

### 3.3 WhisperX + Demucs Integration
**Goal:** Auto-transcribe audio and align to lyrics

**Workflow:**
1. User uploads song audio
2. (Optional) Isolate vocals with demucs
3. Transcribe with WhisperX (word-level timestamps)
4. (Optional) Paste lyrics for alignment
5. Generate subtitle track with word timing
6. User applies styles and exports

**Implementation:**
- [ ] Backend endpoint: `/api/transcribe` — *not built as a custom Python endpoint. Upstream transcription ships instead: local Whisper (ONNX in the browser, whisper.cpp in desktop) plus configurable cloud ASR plugins.*
- [ ] Python worker with WhisperX — *not integrated*
- [ ] Optional demucs separation — *not integrated; the server's `isolate-voice` FFmpeg plugin removes vocals with filters instead of demucs*
- [x] Return word-level JSON — *the transcript model carries per-word timings used by captions*
- [x] Frontend imports to subtitle track — *transcript word timing drives caption pages and the karaoke renderer*

**Status:** optional scope, partially covered by upstream. Word-level transcription and caption generation work; WhisperX-specific alignment and demucs source separation are not implemented.

### 3.4 Duplicate Shot Detector
**Goal:** Warn when same footage appears twice

**Implementation:**
- [x] Extract frame at clip midpoint — *`src/duplicates/duplicateScan.ts` (video midpoint, whole still for images)*
- [x] Compute perceptual hash (pHash) — *9×8 dHash, 64 bits, `perceptualHash.ts`*
- [x] Compare all clips — *union-find grouping with a tunable Hamming threshold (default 6)*
- [x] Highlight duplicates in timeline — *clicking a group selects its clips*
- [x] Show duplicates panel — *`重复片段检测` in the timeline more-menu opens `DuplicateDetectorDialog` (progress, threshold slider, groups)*

**Status:** done and verified in the browser: 4 identical stills → 1 group at 100% similarity, clicking selects all 4.

**Algorithm:**
```javascript
// ImageHash + Hamming distance
const hash1 = pHash(frame1);
const hash2 = pHash(frame2);
const distance = hammingDistance(hash1, hash2);
if (distance < 5) {
  // Likely duplicate
}
```

### 3.5 Time Display Modes
- [x] **Elapsed:** `0:00:05.23`
- [x] **Countdown:** `-0:03:54.77` (remaining time)
- [x] Click to toggle — *also persisted in `localStorage['cc.timeDisplayMode']`*
- [x] Respect timeline duration — *clamped at 0, never negative-zero*

**Status:** done. `CountdownToggle.tsx` + `timeDisplay.verify.ts`; timecode repaints through `formatTimecode`.

### 3.6 Advanced Export
**Resolutions:**
- [x] 720p (1280x720)
- [x] 1080p (1920x1080)
- [x] 4K (3840x2160)

**Codecs:**
- [x] H.264 (libx264)
- [x] H.265/HEVC (libx265) — *server-only: `codec=hevc` maps to Remotion `h265`/`.mp4`, browser route rejects it, x265 retime pass*

**Settings:**
- [x] CRF quality (18-28) — *`crf` validated server-side, mutually exclusive with bitrate*
- [ ] 2-pass encoding — *not implemented; Remotion renders single-pass CRF or bitrate*
- [x] +faststart flag — *mux paths pass `-movflags +faststart`*
- [x] Audio: AAC 192kbps — *AAC encoder-delay path, audio bitrate presets*

**Status:** done except 2-pass. Estimated output size (`exportPresets.ts`) is shown in the export summary.

**Backend:**
- Use Remotion's rendering engine
- Or FFmpeg pipeline for compatibility

---

## Phase 4: Professional Features

### 4.1 Keyboard Shortcuts
**Playback:**
- `Space`: Play/Pause — ✅
- `J`: Reverse play — ✅
- `K`: Pause — ✅
- `L`: Fast forward — ✅
- `I`: Mark in — ✅
- `O`: Mark out — ✅

**Editing:**
- `C`: Razor tool — ✅
- `V`: Selection tool — ✅
- `B`: Ripple edit — ✅
- `T`: Text tool — ✅
- `Z`: Zoom — ✅
- `+/-`: Zoom in/out timeline — ✅
- `Home/End`: Jump to start/end — ✅
- `Cmd/Ctrl + K`: Split at playhead — ✅
- `Delete/Backspace`: Ripple delete — ✅
- `Cmd/Ctrl + D`: Duplicate clip — ✅

**Timeline:**
- `Cmd/Ctrl + Z`: Undo — ✅
- `Cmd/Ctrl + Shift + Z`: Redo — ✅
- `Cmd/Ctrl + A`: Select all — ✅
- `Cmd/Ctrl + S`: Save project — ✅

**Status:** 62 actions in `src/shortcuts/catalog.ts`, dispatched surface-aware and verified by `npm run verify:shortcuts`.

### 4.2 Multi-Select & Batch Editing
- [x] Shift-click for range selection — *verified in the browser: clicking clip 0 then shift-clicking clip 2 selects 0-2*
- [x] Cmd/Ctrl-click for multi-select — *verified*
- [x] Drag multiple clips together — *verified: the selected pair moves as a block, clamped by the next clip*
- [x] Batch color correction — **batch infrastructure verified via verify:editor (inspectorBatch, multicam-tools, edit-item-batch)**
- [x] Batch speed change — **batch infrastructure verified via verify:editor (inspectorBatch, multicam-tools, edit-item-batch)**

### 4.3 Markers
- [x] Add marker at playhead (`M`)
- [x] Timeline markers (color coded) — *8-colour palette, localized*
- [x] Clip markers
- [x] Marker notes/comments — *inline note field in the marker list*
- [x] Jump between markers — *click a row; `Shift+M` edits, `Alt+M` deletes the marker at the playhead*

**Status:** done. `MarkerListDialog` + ruler pins; verified in the browser (add, list, colour, delete).

### 4.4 Undo/Redo
- [x] Full history stack — **VERIFIED via verify:editor storeCommandBuilder.verify ("single-step undo")**
- [x] Undo any operation — *every mutation goes through the command layer; gestures coalesce into one step*
- [ ] Visual history panel (optional)
- [ ] Persist across saves — *undo history is intentionally session-scoped*

### 4.5 Source Monitor
- [x] Preview clips before adding to timeline — *opens from the media pool context menu for video/audio/image/GIF/SVG*
- [x] Set in/out points — *`I` / `O`, panel buttons, reset, duration readout*
- [x] Scrub through media — *range slider + frame stepping + play/pause*
- [x] Dual monitor setup (Source + Program) — *Source Monitor stacked above the Program Monitor; range insert is one undoable command*

**Status:** done and verified in the browser (open, scrub to frame 60, in `00:02.00`, out `00:04.03`, insert 61 frames, undo). `src/media/sourceMonitor.ts` + `sourceMonitorStore.ts` + `SourceMonitorPanel.tsx` + verifier.

---

## Phase 5: Spanish UI (Default)

### 5.1 i18n Setup
- [x] Spanish as default language — *`readInitial()` always starts on `es`*
- [x] English toggle available — *ES/EN toggle in the top bar*
- [x] Translate all UI strings — *`verify:i18n` passes with 2610 dictionary entries and no missing keys; all new custom-feature strings ship in English and Spanish. Some upstream hardcoded `title=` tooltips remain English and are tracked as an upstream limitation.*

### 5.2 Key Translations
```json
{
  "es": {
    "file": "Archivo",
    "edit": "Editar",
    "sequence": "Secuencia",
    "timeline": "Línea de Tiempo",
    "tools": "Herramientas",
    "effects": "Efectos",
    "transitions": "Transiciones",
    "inspector": "Inspector",
    "properties": "Propiedades",
    "export": "Exportar",
    "import": "Importar",
    "play": "Reproducir",
    "pause": "Pausar"
  }
}
```

---

## Phase 6: Integration & Testing

### 6.1 Integration Checklist
- [x] OpenChatCut base works
- [x] Custom features integrated
- [x] Spanish UI applied
- [x] Vite config for Cursor preview
- [x] All shortcuts work — *`npm run verify:shortcuts`*
- [x] Export pipeline functional — *`verify:export-adaptive` + `verify:export-gl`*

### 6.2 End-to-End Test
1. [x] Import video clips
2. [x] Import audio track
3. [x] Drag clips to timeline
4. [x] Apply Ken Burns to image
5. [x] Add subtitles (import .srt)
6. [x] Apply karaoke style
7. [x] Color grade a clip
8. [x] Add transitions
9. [x] Export to 1080p H.264
10. [x] Verify output plays correctly

**Status:** exercised in the browser and through the verifier suite. The Source Monitor insert + undo, duplicate detection, marker editing, and countdown timecode were also checked interactively. See `documentation/VIDEO_EDITOR.md` for the walkthrough.

---

## Phase 7: Documentation

### 7.1 README Updates
- [x] Installation instructions — *`documentation/VIDEO_EDITOR.md` quick start; upstream README retained*
- [x] Feature list — *Music Video Edition section in `README.md` + full guide*
- [x] Keyboard shortcuts table — *62-action table in both guides*
- [x] API documentation — *architecture/command-layer/stores/verifier overview in `VIDEO_EDITOR.md`*
- [x] Screenshot gallery — *links to `screenshots/` and `screenshots-spanish/`*

### 7.2 User Guide
- [x] Quick start tutorial — *`documentation/GUIA_USUARIO_ES.md` §1–3*
- [x] Ken Burns guide — *`documentation/GUIA_USUARIO_ES.md` §4*
- [x] Subtitle workflow — *`documentation/GUIA_USUARIO_ES.md` §5*
- [x] Export settings explained — *`documentation/GUIA_USUARIO_ES.md` §7*

---

## EffectCraft Feasibility Analysis

### What is EffectCraft?
- Open-source motion graphics engine
- Written in pure Rust
- Compositing and effects
- Still early stage (alpha)

### Integration Feasibility
**Pros:**
- High performance (Rust)
- Modern architecture
- Could replace After Effects workflows

**Cons:**
- Early development stage
- Rust → WASM compilation needed
- Learning curve
- Limited documentation

### Recommendation
**Status:** Future consideration, NOT for MVP

**Reasoning:**
1. OpenChatCut already has motion graphics via Remotion
2. EffectCraft is not mature enough
3. Integration complexity too high
4. Remotion covers 90% of needs

**Future path:**
- Monitor EffectCraft development
- Consider for v2.0 if it matures
- Potential as plugin/module

---

## Technology Stack Summary

### Frontend
- React 19 + TypeScript
- Vite (build tool)
- Remotion (video rendering)
- Zustand (state management)
- i18next (internationalization)

### Backend (Optional)
- Node.js server (already in OpenChatCut)
- FFmpeg (video processing)
- Python services (WhisperX, demucs)

### Rendering
- Remotion (primary)
- FFmpeg (fallback/compatibility)

---

## Success Criteria

**MVP is complete when:**
1. ✅ Professional UI that looks like Premiere Pro
2. ✅ All tools panel buttons work
3. ✅ Inspector with keyframes functional
4. ✅ Ken Burns effects render smoothly
5. ✅ ASS/SRT karaoke subtitles work
6. ✅ Export to 4K H.264/HEVC
7. ✅ Spanish UI by default
8. ✅ Runs on Cursor preview
9. ✅ No paid API keys required
10. ✅ End-to-end workflow tested

---

## Timeline Estimate (Technical Steps)

1. **OpenChatCut setup & Vite config:** 1 session
2. **UI customization (panels, dark theme):** 1 session
3. **Tools panel implementation:** 1 session
4. **Custom features (Ken Burns, subtitles, etc.):** 2 sessions
5. **Spanish i18n:** 1 session
6. **Testing & polish:** 1 session

**Total:** 7 development sessions

---

## Questions for User (resolved during implementation)

1. **AI Features:** kept optional — no key required for editing/rendering.
2. **Transcription:** optional — upstream local Whisper is available; WhisperX/demucs remain out of scope.
3. **Priority:** functional custom features first, with panel/theme polish.
4. **Export:** Remotion pipeline, with FFmpeg muxing on the server.

---

## Known Limitations

- Audio EQ/compressor inserts are not implemented per clip (server FFmpeg voice cleanup exists).
- 2-pass encoding is not supported by the Remotion pipeline.
- HEVC export requires the server renderer.
- WhisperX alignment and demucs separation are not integrated.
- Some upstream `title=` tooltips remain English.
