from fastapi import APIRouter, HTTPException, BackgroundTasks
from backend.models.schemas import RenderRequest, RenderStatus
from backend.services.renderer import VideoRenderer
import uuid
from datetime import datetime
import os
import json

router = APIRouter()
renderer = VideoRenderer()

render_jobs = {}

@router.post("/start", response_model=RenderStatus)
async def start_render(request: RenderRequest, background_tasks: BackgroundTasks):
    """Start rendering a project"""
    try:
        project_path = os.path.join("projects", f"{request.project_id}.json")
        
        if not os.path.exists(project_path):
            raise HTTPException(status_code=404, detail="Project not found")
        
        render_id = str(uuid.uuid4())
        
        render_status = RenderStatus(
            id=render_id,
            project_id=request.project_id,
            status="queued",
            started_at=datetime.now().isoformat()
        )
        
        render_jobs[render_id] = render_status
        
        background_tasks.add_task(
            renderer.render_project,
            render_id,
            request.project_id,
            request.resolution,
            request.codec,
            request.quality,
            render_jobs
        )
        
        return render_status
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{render_id}", response_model=RenderStatus)
async def get_render_status(render_id: str):
    """Get the status of a render job"""
    if render_id not in render_jobs:
        raise HTTPException(status_code=404, detail="Render job not found")
    
    return render_jobs[render_id]

@router.get("/list")
async def list_renders():
    """List all render jobs"""
    return list(render_jobs.values())
