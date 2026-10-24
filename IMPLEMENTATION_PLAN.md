# Video Editor Implementation Plan

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
- [ ] Install dependencies (`npm install`)
- [ ] Configure Vite for Cursor preview
  - Add `host: true`
  - Add `allowedHosts: ['.cursorvm.com', 'localhost']`
- [ ] Set up environment variables (AI features optional)
- [ ] Start dev server on port 5199
- [ ] Verify it loads

### 1.2 Verify Core Features Work
- [ ] Timeline with multiple tracks
- [ ] Media import (drag & drop)
- [ ] Preview player
- [ ] Basic clip editing (trim, split, move)
- [ ] Export functionality

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

### 2.2 Tools Panel Implementation
- [ ] **Selection tool (V)**: Default, select/move clips
- [ ] **Razor tool (C)**: Split clips at playhead
- [ ] **Ripple edit tool (B)**: Trim and shift subsequent clips
- [ ] **Slip/Slide tool (Y)**: Adjust clip content without moving
- [ ] **Text tool (T)**: Add text/subtitles
- [ ] **Hand tool (H)**: Pan timeline
- [ ] **Zoom tool (Z)**: Zoom timeline

### 2.3 Inspector/Properties Panel
**Keyframe support for:**
- [ ] Position (X, Y with bezier curves)
- [ ] Scale (uniform & independent)
- [ ] Rotation (0-360°)
- [ ] Opacity (0-100%)

**Color Correction:**
- [ ] Exposure slider
- [ ] Contrast slider
- [ ] Saturation slider
- [ ] Temperature slider
- [ ] LUT support (.cube files)

**Audio:**
- [ ] Volume slider (-∞ to +12 dB)
- [ ] Fade in/out curves
- [ ] Audio effects (EQ, compressor)

### 2.4 Effects & Transitions
- [ ] Effects browser (searchable)
- [ ] Transition browser
- [ ] Drag-to-apply to clips
- [ ] Effect controls in inspector

### 2.5 Dark Professional Theme
- [ ] Dark gray panels (#1a1a1a, #2a2a2a, #3a3a3a)
- [ ] Blue accents for selection (#0a84ff)
- [ ] Proper contrast for readability
- [ ] Custom scrollbars

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
- [ ] Use Remotion's interpolate() with spring/bezier
- [ ] Render at 2x source resolution then scale down
- [ ] Sub-pixel precision per frame
- [ ] Export smooth 60fps or 30fps

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
- [ ] Import .srt / .ass files
- [ ] Export .srt / .ass files
- [ ] Visual subtitle editor
- [ ] Word-level timing table
- [ ] Style selector per subtitle
- [ ] Karaoke fill animation

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
- [ ] Backend endpoint: `/api/transcribe`
- [ ] Python worker with WhisperX
- [ ] Optional demucs separation
- [ ] Return word-level JSON
- [ ] Frontend imports to subtitle track

**Requirements:**
```bash
# Optional - only if user wants transcription
pip install openai-whisper whisperx demucs torch
```

### 3.4 Duplicate Shot Detector
**Goal:** Warn when same footage appears twice

**Implementation:**
- [ ] Extract frame at clip midpoint
- [ ] Compute perceptual hash (pHash)
- [ ] Compare all clips
- [ ] Highlight duplicates in timeline (yellow border)
- [ ] Show duplicates panel

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
- [ ] **Elapsed:** `0:00:05.23`
- [ ] **Countdown:** `-0:03:54.77` (remaining time)
- [ ] Click to toggle
- [ ] Respect timeline duration

### 3.6 Advanced Export
**Resolutions:**
- [ ] 720p (1280x720)
- [ ] 1080p (1920x1080)
- [ ] 4K (3840x2160)

**Codecs:**
- [ ] H.264 (libx264)
- [ ] H.265/HEVC (libx265)

**Settings:**
- [ ] CRF quality (18-28)
- [ ] 2-pass encoding
- [ ] +faststart flag
- [ ] Audio: AAC 192kbps

**Backend:**
- Use Remotion's rendering engine
- Or FFmpeg pipeline for compatibility

---

## Phase 4: Professional Features

### 4.1 Keyboard Shortcuts
**Playback:**
- `Space`: Play/Pause
- `J`: Reverse play
- `K`: Pause
- `L`: Fast forward
- `I`: Mark in
- `O`: Mark out

**Editing:**
- `C`: Razor tool
- `V`: Selection tool
- `B`: Ripple edit
- `T`: Text tool
- `Z`: Zoom
- `+/-`: Zoom in/out timeline
- `Home/End`: Jump to start/end
- `Cmd/Ctrl + K`: Split at playhead
- `Delete/Backspace`: Ripple delete
- `Cmd/Ctrl + D`: Duplicate clip

**Timeline:**
- `Cmd/Ctrl + Z`: Undo
- `Cmd/Ctrl + Shift + Z`: Redo
- `Cmd/Ctrl + A`: Select all
- `Cmd/Ctrl + S`: Save project

### 4.2 Multi-Select & Batch Editing
- [ ] Shift-click for range selection
- [ ] Cmd/Ctrl-click for multi-select
- [ ] Drag multiple clips together
- [ ] Batch color correction
- [ ] Batch speed change

### 4.3 Markers
- [ ] Add marker at playhead (`M`)
- [ ] Timeline markers (color coded)
- [ ] Clip markers
- [ ] Marker notes/comments
- [ ] Jump between markers

### 4.4 Undo/Redo
- [ ] Full history stack
- [ ] Undo any operation
- [ ] Visual history panel (optional)
- [ ] Persist across saves

### 4.5 Source Monitor
- [ ] Preview clips before adding to timeline
- [ ] Set in/out points
- [ ] Scrub through media
- [ ] Dual monitor setup (Source + Program)

---

## Phase 5: Spanish UI (Default)

### 5.1 i18n Setup
- [ ] Spanish as default language
- [ ] English toggle available
- [ ] Translate all UI strings

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
- [ ] OpenChatCut base works
- [ ] Custom features integrated
- [ ] Spanish UI applied
- [ ] Vite config for Cursor preview
- [ ] All shortcuts work
- [ ] Export pipeline functional

### 6.2 End-to-End Test
1. Import video clips
2. Import audio track
3. Drag clips to timeline
4. Apply Ken Burns to image
5. Add subtitles (import .srt)
6. Apply karaoke style
7. Color grade a clip
8. Add transitions
9. Export to 1080p H.264
10. Verify output plays correctly

---

## Phase 7: Documentation

### 7.1 README Updates
- [ ] Installation instructions
- [ ] Feature list
- [ ] Keyboard shortcuts table
- [ ] API documentation
- [ ] Screenshot gallery

### 7.2 User Guide
- [ ] Quick start tutorial
- [ ] Ken Burns guide
- [ ] Subtitle workflow
- [ ] Export settings explained

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

## Next Steps

1. **NOW:** Finish OpenChatCut integration
   - Complete Vite config
   - Install dependencies
   - Get it running
   - Verify base features

2. **THEN:** Customize UI
   - Add tools panel
   - Enhance inspector
   - Apply dark theme

3. **FINALLY:** Add custom features
   - Ken Burns
   - Karaoke subtitles
   - WhisperX integration
   - Export enhancements

---

## Questions for User

1. **AI Features:** Should I enable the conversational AI features (requires LLM key) or keep them optional?

2. **Transcription:** Is WhisperX + demucs a must-have for MVP or can it be optional?

3. **Priority:** Which is more important - perfect UI polish or functional custom features?

4. **Export:** Remotion rendering or FFmpeg pipeline?

---

**Ready to proceed with Phase 1: OpenChatCut Integration?**
