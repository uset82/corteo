from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Literal
from enum import Enum

class MediaType(str, Enum):
    VIDEO = "video"
    AUDIO = "audio"
    IMAGE = "image"

class MediaFile(BaseModel):
    id: str
    filename: str
    type: MediaType
    path: str
    url: str
    duration: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    thumbnail: Optional[str] = None
    waveform: Optional[List[float]] = None
    uploaded_at: str

class TimelineClip(BaseModel):
    id: str
    track_id: str
    media_id: str
    start_time: float
    end_time: float
    media_start: float
    media_end: float
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    scale: Optional[float] = None
    speed: float = 1.0
    fade_in: float = 0.0
    fade_out: float = 0.0
    ken_burns: Optional[Dict[str, Any]] = None

class KenBurnsEffect(BaseModel):
    start_x: float = 0.0
    start_y: float = 0.0
    start_scale: float = 1.0
    end_x: float = 0.0
    end_y: float = 0.0
    end_scale: float = 1.0
    easing: str = "linear"

class SubtitleStyle(BaseModel):
    name: str
    font_family: str = "Arial"
    font_size: int = 48
    color: str = "#FFFFFF"
    background: Optional[str] = None
    bold: bool = False
    italic: bool = False
    position: Literal["top", "center", "bottom"] = "bottom"
    alignment: Literal["left", "center", "right"] = "center"
    karaoke: bool = False
    karaoke_color: Optional[str] = "#FF0000"

class SubtitleEntry(BaseModel):
    id: str
    start_time: float
    end_time: float
    text: str
    style_name: str = "default"
    words: Optional[List[Dict[str, Any]]] = None

class Track(BaseModel):
    id: str
    type: Literal["video", "audio", "subtitle"]
    name: str
    order: int
    clips: List[TimelineClip] = []

class Project(BaseModel):
    id: str
    name: str
    width: int = 1920
    height: int = 1080
    fps: int = 30
    tracks: List[Track] = []
    subtitles: List[SubtitleEntry] = []
    subtitle_styles: List[SubtitleStyle] = []
    duration: float = 0.0
    created_at: str
    updated_at: str

class RenderRequest(BaseModel):
    project_id: str
    resolution: Literal["720p", "1080p", "4k"] = "1080p"
    codec: Literal["h264", "hevc"] = "h264"
    quality: Literal["low", "medium", "high"] = "high"

class RenderStatus(BaseModel):
    id: str
    project_id: str
    status: Literal["queued", "processing", "completed", "failed"]
    progress: float = 0.0
    output_path: Optional[str] = None
    error: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

class TranscriptionRequest(BaseModel):
    audio_path: str
    lyrics: Optional[str] = None
    isolate_vocals: bool = False
    language: str = "es"
