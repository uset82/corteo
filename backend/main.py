from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.api import media, projects, render, transcription
import os

app = FastAPI(title="Video Editor API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
os.makedirs("projects", exist_ok=True)
os.makedirs("renders", exist_ok=True)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/renders", StaticFiles(directory="renders"), name="renders")

app.include_router(media.router, prefix="/api/media", tags=["media"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(render.router, prefix="/api/render", tags=["render"])
app.include_router(transcription.router, prefix="/api/transcription", tags=["transcription"])

@app.get("/")
async def root():
    return {"message": "Video Editor API", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
