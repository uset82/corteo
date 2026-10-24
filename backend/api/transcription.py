from fastapi import APIRouter, HTTPException, UploadFile, File
from backend.models.schemas import TranscriptionRequest, SubtitleEntry
from backend.services.transcriber import Transcriber
import os
import uuid
from typing import List

router = APIRouter()
transcriber = Transcriber()

@router.post("/transcribe")
async def transcribe_audio(request: TranscriptionRequest) -> List[SubtitleEntry]:
    """Transcribe audio using Whisper and align with lyrics"""
    try:
        if not os.path.exists(request.audio_path):
            raise HTTPException(status_code=404, detail="Audio file not found")
        
        subtitles = await transcriber.transcribe(
            audio_path=request.audio_path,
            lyrics=request.lyrics,
            isolate_vocals=request.isolate_vocals,
            language=request.language
        )
        
        return subtitles
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/import-srt")
async def import_srt(file: UploadFile = File(...)) -> List[SubtitleEntry]:
    """Import subtitles from SRT file"""
    try:
        content = await file.read()
        text = content.decode('utf-8')
        
        subtitles = transcriber.parse_srt(text)
        return subtitles
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/import-ass")
async def import_ass(file: UploadFile = File(...)) -> List[SubtitleEntry]:
    """Import subtitles from ASS file"""
    try:
        content = await file.read()
        text = content.decode('utf-8')
        
        subtitles = transcriber.parse_ass(text)
        return subtitles
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export-srt")
async def export_srt(subtitles: List[SubtitleEntry]) -> dict:
    """Export subtitles to SRT format"""
    try:
        srt_content = transcriber.export_srt(subtitles)
        
        output_id = str(uuid.uuid4())
        output_path = os.path.join("renders", f"{output_id}.srt")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(srt_content)
        
        return {
            "url": f"/renders/{output_id}.srt",
            "content": srt_content
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export-ass")
async def export_ass(subtitles: List[SubtitleEntry]) -> dict:
    """Export subtitles to ASS format"""
    try:
        ass_content = transcriber.export_ass(subtitles)
        
        output_id = str(uuid.uuid4())
        output_path = os.path.join("renders", f"{output_id}.ass")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(ass_content)
        
        return {
            "url": f"/renders/{output_id}.ass",
            "content": ass_content
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
