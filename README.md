# Video Editor - Browser-Based Video Editor for Musicians

A self-hostable, browser-based video editor optimized for music video creation. Built with Python (FastAPI) and React/TypeScript.

## Features

- **Multi-track timeline**: Video, audio, and subtitle tracks with zoom, scrubbing, and snapping
- **Media library**: Import and manage video clips, images, and audio files
- **Clip editing**: Drag-and-drop, trim, split, ripple delete, speed change, and transitions
- **Ken Burns effects**: Smooth pan/zoom on still images with sub-pixel precision
- **Subtitles**: Import/export SRT/ASS, word-level karaoke highlighting, and custom styles
- **Auto-transcription**: Transcribe audio using Whisper with optional vocal isolation
- **Duplicate detection**: Perceptual hashing to detect reused footage
- **Preview**: Real-time browser preview with playhead control
- **Render**: Server-side rendering with FFmpeg to 720p/1080p/4K
- **Project management**: Save/load projects as JSON (EDL)
- **Bilingual UI**: Spanish and English interface with toggle
- **CLI tool**: Render projects from command line

## Quick Start

### Prerequisites

- Docker and Docker Compose
- 4GB+ RAM recommended

### One-Command Start

```bash
docker compose up
```

The application will be available at:
- Frontend: http://localhost:5174
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Usage

### Web Interface

1. **Upload Media**: Click "Subir Medios" or drag files into the media library
2. **Create Timeline**: Drag media from library to timeline tracks
3. **Edit Clips**: Click clips to select, drag to reorder, resize edges to trim
4. **Add Subtitles**: Use the subtitle editor to import or create subtitles
5. **Preview**: Use play/pause controls and scrub timeline
6. **Export**: Click "Exportar Video" to render final video

### CLI Tool

Render a project from the command line:

```bash
python cli.py render project.json --resolution 1080p --codec h264 --quality high --output video.mp4
```

Options:
- `--resolution`: 720p, 1080p, or 4k (default: 1080p)
- `--codec`: h264 or hevc (default: h264)
- `--quality`: low, medium, or high (default: high)
- `--output`: Output file path (default: output.mp4)

## Project JSON Schema

Projects are saved as JSON files with this structure:

```json
{
  "id": "project-uuid",
  "name": "My Video",
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "duration": 120.0,
  "tracks": [
    {
      "id": "track-uuid",
      "type": "video",
      "name": "Video 1",
      "order": 0,
      "clips": [
        {
          "id": "clip-uuid",
          "track_id": "track-uuid",
          "media_id": "media-uuid",
          "start_time": 0.0,
          "end_time": 10.0,
          "media_start": 0.0,
          "media_end": 10.0,
          "speed": 1.0,
          "fade_in": 0.5,
          "fade_out": 0.5,
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
      ]
    }
  ],
  "subtitles": [
    {
      "id": "subtitle-uuid",
      "start_time": 0.0,
      "end_time": 5.0,
      "text": "Hello world",
      "style_name": "default",
      "words": [
        {
          "word": "Hello",
          "start": 0.0,
          "end": 2.5
        },
        {
          "word": "world",
          "start": 2.5,
          "end": 5.0
        }
      ]
    }
  ],
  "subtitle_styles": [
    {
      "name": "default",
      "font_family": "Arial",
      "font_size": 48,
      "color": "#FFFFFF",
      "bold": false,
      "italic": false,
      "position": "bottom",
      "alignment": "center",
      "karaoke": false
    }
  ],
  "created_at": "2024-01-01T00:00:00",
  "updated_at": "2024-01-01T00:00:00"
}
```

## Development

### Backend Development

```bash
cd /workspace
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Development

```bash
cd /workspace/frontend
npm install
npm run dev
```

### Running Tests

```bash
pip install -r requirements-test.txt
pytest tests/
```

## Architecture

### Backend (Python/FastAPI)

- **FastAPI**: REST API server
- **FFmpeg**: Video processing and rendering
- **Whisper**: Audio transcription
- **ImageHash**: Duplicate frame detection
- **Librosa**: Audio waveform generation

### Frontend (React/TypeScript)

- **React 18**: UI framework
- **TypeScript**: Type safety
- **Zustand**: State management
- **i18next**: Internationalization
- **Vite**: Build tool and dev server

### Storage

- `uploads/`: Uploaded media files
- `projects/`: Project JSON files
- `renders/`: Rendered output videos

## API Endpoints

### Media
- `POST /api/media/upload` - Upload media file
- `GET /api/media/list` - List all media
- `DELETE /api/media/{id}` - Delete media
- `POST /api/media/detect-duplicates` - Detect duplicate clips

### Projects
- `POST /api/projects/create` - Create new project
- `GET /api/projects/list` - List all projects
- `GET /api/projects/{id}` - Get project by ID
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project

### Render
- `POST /api/render/start` - Start render job
- `GET /api/render/status/{id}` - Get render status
- `GET /api/render/list` - List all render jobs

### Transcription
- `POST /api/transcription/transcribe` - Transcribe audio
- `POST /api/transcription/import-srt` - Import SRT file
- `POST /api/transcription/import-ass` - Import ASS file
- `POST /api/transcription/export-srt` - Export to SRT
- `POST /api/transcription/export-ass` - Export to ASS

## Subtitle Styles

Three preset styles are included:

- **default**: White Arial text at bottom center
- **verse**: White Georgia serif at bottom center (for verses)
- **chant**: Large bold red Impact text centered with yellow karaoke (for chants)

Custom styles can be added via the subtitle editor.

## Ken Burns Effect

For smooth pan/zoom on still images:

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

The effect is computed per-frame with sub-pixel precision to avoid FFmpeg zoompan jitter.

## Keyboard Shortcuts

- **Space**: Play/Pause
- **Home**: Jump to start
- **End**: Jump to end
- **←/→**: Skip backward/forward 1 second
- **Delete**: Delete selected clip
- **Ctrl+S**: Save project
- **Ctrl+E**: Export video

## Time Display

Click the time display to toggle between:
- **Elapsed**: Shows time from start (default)
- **Countdown**: Shows remaining time (negative)

## Transcription

Auto-transcribe audio with Whisper:

1. Add audio track to timeline
2. Click "Transcribir Audio"
3. (Optional) Paste lyrics for better alignment
4. (Optional) Enable vocal isolation with demucs
5. Select language (Spanish default)
6. Subtitles will be generated with word-level timing

## Duplicate Detection

Detect reused footage with perceptual hashing:

1. Click "Detect Duplicates" in project menu
2. System compares video frames using pHash
3. Clips with similar frames are highlighted
4. Review and remove duplicates as needed

## Troubleshooting

### Port Already in Use

If ports 8000 or 5174 are in use, edit `docker-compose.yml`:

```yaml
ports:
  - "8001:8000"  # Backend
  - "5175:5173"  # Frontend
```

### FFmpeg Not Found

Make sure FFmpeg is installed in the Docker container. The provided Dockerfile includes FFmpeg.

### Upload Fails

Check disk space in `uploads/` directory and ensure write permissions.

### Render Fails

Check backend logs:

```bash
docker compose logs backend
```

Common issues:
- Missing media files
- Invalid project JSON
- Insufficient memory for high-resolution renders

## License

MIT License - Free for personal and commercial use

## Credits

- Built with inspiration from [veedstudio/open-edit](https://github.com/veedstudio/open-edit)
- Uses FFmpeg for video processing
- Transcription powered by OpenAI Whisper
- Perceptual hashing via ImageHash

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

## Support

For issues and questions, please open a GitHub issue.
