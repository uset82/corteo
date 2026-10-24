from fastapi import APIRouter, HTTPException
from typing import List
import json
import os
import uuid
from datetime import datetime
from backend.models.schemas import Project, Track, SubtitleStyle

router = APIRouter()

@router.post("/create", response_model=Project)
async def create_project(name: str, width: int = 1920, height: int = 1080, fps: int = 30):
    """Create a new project"""
    try:
        project_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        
        default_styles = [
            SubtitleStyle(
                name="default",
                font_family="Arial",
                font_size=48,
                color="#FFFFFF",
                position="bottom",
                alignment="center"
            ),
            SubtitleStyle(
                name="verse",
                font_family="Georgia",
                font_size=44,
                color="#FFFFFF",
                position="bottom",
                alignment="center"
            ),
            SubtitleStyle(
                name="chant",
                font_family="Impact",
                font_size=72,
                color="#FF0000",
                bold=True,
                position="center",
                alignment="center",
                karaoke=True,
                karaoke_color="#FFFF00"
            )
        ]
        
        project = Project(
            id=project_id,
            name=name,
            width=width,
            height=height,
            fps=fps,
            tracks=[
                Track(id=str(uuid.uuid4()), type="video", name="Video 1", order=0),
                Track(id=str(uuid.uuid4()), type="video", name="Video 2", order=1),
                Track(id=str(uuid.uuid4()), type="audio", name="Audio", order=2),
                Track(id=str(uuid.uuid4()), type="subtitle", name="Subtitles", order=3)
            ],
            subtitle_styles=default_styles,
            created_at=now,
            updated_at=now
        )
        
        project_path = os.path.join("projects", f"{project_id}.json")
        with open(project_path, 'w', encoding='utf-8') as f:
            json.dump(project.model_dump(), f, indent=2, ensure_ascii=False)
        
        return project
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list", response_model=List[Project])
async def list_projects():
    """List all projects"""
    try:
        projects = []
        projects_dir = "projects"
        
        if not os.path.exists(projects_dir):
            return []
        
        for filename in os.listdir(projects_dir):
            if filename.endswith('.json') and filename != '.gitkeep':
                project_path = os.path.join(projects_dir, filename)
                with open(project_path, 'r', encoding='utf-8') as f:
                    project_data = json.load(f)
                    projects.append(Project(**project_data))
        
        return sorted(projects, key=lambda p: p.updated_at, reverse=True)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str):
    """Get a specific project"""
    try:
        project_path = os.path.join("projects", f"{project_id}.json")
        
        if not os.path.exists(project_path):
            raise HTTPException(status_code=404, detail="Project not found")
        
        with open(project_path, 'r', encoding='utf-8') as f:
            project_data = json.load(f)
            return Project(**project_data)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{project_id}", response_model=Project)
async def update_project(project_id: str, project: Project):
    """Update a project"""
    try:
        project_path = os.path.join("projects", f"{project_id}.json")
        
        if not os.path.exists(project_path):
            raise HTTPException(status_code=404, detail="Project not found")
        
        project.updated_at = datetime.now().isoformat()
        
        with open(project_path, 'w', encoding='utf-8') as f:
            json.dump(project.model_dump(), f, indent=2, ensure_ascii=False)
        
        return project
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Delete a project"""
    try:
        project_path = os.path.join("projects", f"{project_id}.json")
        
        if not os.path.exists(project_path):
            raise HTTPException(status_code=404, detail="Project not found")
        
        os.remove(project_path)
        
        return {"message": "Project deleted successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
