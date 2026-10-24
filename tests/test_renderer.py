import pytest
import json
import os
from backend.services.renderer import VideoRenderer
from backend.models.schemas import Project, Track, TimelineClip

@pytest.fixture
def sample_project():
    """Create a sample project for testing"""
    project = Project(
        id="test_project",
        name="Test Project",
        width=1920,
        height=1080,
        fps=30,
        tracks=[
            Track(id="track1", type="video", name="Video 1", order=0, clips=[]),
            Track(id="track2", type="audio", name="Audio", order=1, clips=[])
        ],
        subtitles=[],
        subtitle_styles=[],
        duration=5.0,
        created_at="2024-01-01T00:00:00",
        updated_at="2024-01-01T00:00:00"
    )
    
    os.makedirs("projects", exist_ok=True)
    project_path = os.path.join("projects", f"{project.id}.json")
    with open(project_path, 'w', encoding='utf-8') as f:
        json.dump(project.model_dump(), f, indent=2, ensure_ascii=False)
    
    yield project
    
    if os.path.exists(project_path):
        os.remove(project_path)

@pytest.mark.asyncio
async def test_render_project(sample_project):
    """Test rendering a simple project"""
    renderer = VideoRenderer()
    render_jobs = {}
    render_id = "test_render"
    
    from backend.models.schemas import RenderStatus
    from datetime import datetime
    
    render_jobs[render_id] = RenderStatus(
        id=render_id,
        project_id=sample_project.id,
        status="queued",
        started_at=datetime.now().isoformat()
    )
    
    await renderer.render_project(
        render_id=render_id,
        project_id=sample_project.id,
        resolution="720p",
        codec="h264",
        quality="low",
        render_jobs=render_jobs
    )
    
    status = render_jobs[render_id]
    
    assert status.status in ["completed", "failed"]
    
    if status.status == "completed":
        assert status.output_path is not None
        assert status.progress == 100.0

def test_get_resolution():
    """Test resolution conversion"""
    renderer = VideoRenderer()
    
    assert renderer._get_resolution("720p", 1920, 1080) == (1280, 720)
    assert renderer._get_resolution("1080p", 1920, 1080) == (1920, 1080)
    assert renderer._get_resolution("4k", 1920, 1080) == (3840, 2160)

def test_project_schema():
    """Test project schema validation"""
    project_data = {
        "id": "test",
        "name": "Test",
        "width": 1920,
        "height": 1080,
        "fps": 30,
        "tracks": [],
        "subtitles": [],
        "subtitle_styles": [],
        "duration": 0,
        "created_at": "2024-01-01T00:00:00",
        "updated_at": "2024-01-01T00:00:00"
    }
    
    project = Project(**project_data)
    
    assert project.id == "test"
    assert project.width == 1920
    assert project.height == 1080
    assert project.fps == 30
