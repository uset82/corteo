from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
import aiofiles
import os
import uuid
from datetime import datetime
from backend.models.schemas import MediaFile, MediaType
from backend.services.media_processor import MediaProcessor

router = APIRouter()
processor = MediaProcessor()

@router.post("/upload", response_model=MediaFile)
async def upload_media(file: UploadFile = File(...)):
    """Upload a media file (video, audio, or image)"""
    try:
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm']:
            media_type = MediaType.VIDEO
        elif file_ext in ['.mp3', '.wav', '.flac', '.m4a', '.ogg']:
            media_type = MediaType.AUDIO
        elif file_ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            media_type = MediaType.IMAGE
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        media_id = str(uuid.uuid4())
        filename = f"{media_id}{file_ext}"
        filepath = os.path.join("uploads", filename)
        
        async with aiofiles.open(filepath, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
        
        media_info = await processor.process_media(filepath, media_type)
        
        return MediaFile(
            id=media_id,
            filename=file.filename,
            type=media_type,
            path=filepath,
            url=f"/uploads/{filename}",
            duration=media_info.get("duration"),
            width=media_info.get("width"),
            height=media_info.get("height"),
            thumbnail=media_info.get("thumbnail"),
            waveform=media_info.get("waveform"),
            uploaded_at=datetime.now().isoformat()
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list", response_model=List[MediaFile])
async def list_media():
    """List all uploaded media files"""
    try:
        media_files = []
        uploads_dir = "uploads"
        
        if not os.path.exists(uploads_dir):
            return []
        
        for filename in os.listdir(uploads_dir):
            if filename == '.gitkeep':
                continue
            
            filepath = os.path.join(uploads_dir, filename)
            if os.path.isfile(filepath):
                file_ext = os.path.splitext(filename)[1].lower()
                media_id = os.path.splitext(filename)[0]
                
                if file_ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm']:
                    media_type = MediaType.VIDEO
                elif file_ext in ['.mp3', '.wav', '.flac', '.m4a', '.ogg']:
                    media_type = MediaType.AUDIO
                elif file_ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                    media_type = MediaType.IMAGE
                else:
                    continue
                
                media_info = await processor.get_media_info(filepath, media_type)
                
                media_files.append(MediaFile(
                    id=media_id,
                    filename=filename,
                    type=media_type,
                    path=filepath,
                    url=f"/uploads/{filename}",
                    duration=media_info.get("duration"),
                    width=media_info.get("width"),
                    height=media_info.get("height"),
                    thumbnail=media_info.get("thumbnail"),
                    waveform=media_info.get("waveform"),
                    uploaded_at=datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat()
                ))
        
        return media_files
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{media_id}")
async def delete_media(media_id: str):
    """Delete a media file"""
    try:
        uploads_dir = "uploads"
        deleted = False
        
        for filename in os.listdir(uploads_dir):
            if filename.startswith(media_id):
                filepath = os.path.join(uploads_dir, filename)
                os.remove(filepath)
                deleted = True
                
                thumbnail = filepath.replace(os.path.splitext(filename)[1], "_thumb.jpg")
                if os.path.exists(thumbnail):
                    os.remove(thumbnail)
        
        if not deleted:
            raise HTTPException(status_code=404, detail="Media file not found")
        
        return {"message": "Media file deleted successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/detect-duplicates")
async def detect_duplicate_clips(project_id: str):
    """Detect duplicate video clips in a project using perceptual hashing"""
    try:
        from backend.services.duplicate_detector import DuplicateDetector
        
        project_path = os.path.join("projects", f"{project_id}.json")
        if not os.path.exists(project_path):
            raise HTTPException(status_code=404, detail="Project not found")
        
        detector = DuplicateDetector()
        duplicates = await detector.detect_duplicates(project_id)
        
        return {"duplicates": duplicates}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
