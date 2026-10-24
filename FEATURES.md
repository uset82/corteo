# Video Editor - Feature Guide

## Getting Started

The video editor is now running with both frontend and backend services:

- **Frontend**: http://localhost:5173 (React + TypeScript)
- **Backend API**: http://localhost:8000 (FastAPI + Python)
- **API Docs**: http://localhost:8000/docs (Swagger UI)

## Core Features Implemented

### 1. Multi-Track Timeline
- **Video Tracks**: Two video tracks for layering clips
- **Audio Track**: One audio track for the main song with waveform visualization
- **Subtitle Track**: One subtitle track with word-level timing
- **Timeline Controls**:
  - Zoom in/out (10% to 1000%)
  - Snap to grid (toggle with grid icon)
  - Playhead scrubbing
  - Time ruler with markers

### 2. Media Library
- **Upload**: Drag and drop or click to upload
- **Supported Formats**:
  - Video: MP4, MOV, AVI, MKV, WebM
  - Audio: MP3, WAV, FLAC, M4A, OGG
  - Image: JPG, PNG, GIF, WebP
- **Features**:
  - Thumbnail generation for videos
  - Waveform visualization for audio
  - Duration display
  - Drag to timeline

### 3. Clip Editing
- **Basic Operations**:
  - Drag clips to timeline
  - Trim by dragging edges
  - Reorder by dragging
  - Delete selected clips
- **Advanced Features**:
  - Speed adjustment (0.1x to 10x)
  - Fade in/out transitions
  - Ken Burns pan/zoom for images
  - Crossfade between clips

### 4. Ken Burns Effects
Smooth pan and zoom on still images with sub-pixel precision:
```json
{
  "ken_burns": {
    "start_x": 0,
    "start_y": 0,
    "start_scale": 1.0,
    "end_x": 100,
    "end_y": 100,
    "end_scale": 1.5,
    "easing": "linear"
  }
}
```

### 5. Subtitles & Transcription
- **Import/Export**: SRT and ASS formats
- **Styles**: Three presets (default, verse, chant)
- **Karaoke**: Word-level highlighting with custom colors
- **Auto-Transcription**: Whisper integration (optional install)
  - Vocal isolation support
  - Lyrics alignment
  - Word-level timestamps

### 6. Duplicate Detection
Perceptual hashing to detect reused footage:
```bash
curl -X POST "http://localhost:8000/api/media/detect-duplicates?project_id=PROJECT_ID"
```

### 7. Preview & Playback
- **Controls**:
  - Play/Pause (Space)
  - Skip forward/back (Arrow keys)
  - Jump to start/end (Home/End)
- **Time Display**:
  - Elapsed time mode
  - Countdown mode (click to toggle)
  - Shows total duration

### 8. Rendering
**Server-Side Rendering** with FFmpeg:
- **Resolutions**: 720p, 1080p, 4K
- **Codecs**: H.264, HEVC (H.265)
- **Quality**: Low, Medium, High
- **Features**:
  - Progress tracking
  - Background processing
  - +faststart for web streaming

**CLI Tool**:
```bash
python3 cli.py render project.json \
  --resolution 1080p \
  --codec h264 \
  --quality high \
  --output output.mp4
```

### 9. Project Management
- **Save/Load**: Projects stored as JSON
- **Programmatic Access**: AI-editable EDL format
- **Auto-Save**: Projects saved on every change
- **Schema Documentation**: See README.md

### 10. Bilingual UI
- **Default**: Spanish (for Spanish-speaking users)
- **Toggle**: Click globe icon to switch to English
- **Persistent**: Language preference saved locally

## API Examples

### Create a Project
```bash
curl -X POST "http://localhost:8000/api/projects/create?name=My%20Video&width=1920&height=1080&fps=30"
```

### Upload Media
```bash
curl -X POST -F "file=@video.mp4" http://localhost:8000/api/media/upload
```

### Start Render
```bash
curl -X POST "http://localhost:8000/api/render/start" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "PROJECT_ID",
    "resolution": "1080p",
    "codec": "h264",
    "quality": "high"
  }'
```

### Check Render Status
```bash
curl "http://localhost:8000/api/render/status/RENDER_ID"
```

## Project Structure

```
/workspace/
├── backend/
│   ├── api/           # API endpoints
│   ├── services/      # Business logic
│   ├── models/        # Pydantic schemas
│   └── main.py        # FastAPI app
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # State management
│   │   ├── utils/       # API & helpers
│   │   └── i18n/        # Translations
│   └── package.json
├── uploads/           # Media files
├── projects/          # Project JSON
├── renders/           # Output videos
├── tests/            # Test suite
├── cli.py            # CLI tool
├── docker-compose.yml
└── README.md
```

## Next Steps for Users

1. **Upload your media**: Click "Subir Medios" or drag files into the library
2. **Arrange clips**: Drag media from library to timeline tracks
3. **Add subtitles**: Import SRT/ASS or use auto-transcription
4. **Preview**: Use playback controls to review your edit
5. **Export**: Click "Exportar Video" when ready
6. **Download**: Rendered video will be available in renders folder

## Optional Enhancements

To enable full transcription features:
```bash
pip install openai-whisper torch
```

To enable vocal isolation:
```bash
pip install demucs
```

## Testing

Run the test suite:
```bash
pip install -r requirements-test.txt
python3 -m pytest tests/ -v
```

## Performance Tips

- Use lower resolutions for faster previews
- Enable snap-to-grid for precise editing
- Batch render during off-hours for large projects
- Use H.264 for wider compatibility
- Use HEVC for smaller file sizes (slower encode)

## Known Limitations

1. Preview is currently canvas-based (no real-time video decode)
2. Transcription requires manual whisper installation
3. Ken Burns computation is CPU-intensive for long durations
4. Maximum project duration: 10 hours (adjustable in code)

## Support

See README.md for full documentation and API reference.
