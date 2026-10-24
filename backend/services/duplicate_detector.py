import imagehash
from PIL import Image
import subprocess
import os
import json
from typing import List, Dict, Any, Tuple
import tempfile

class DuplicateDetector:
    """Detect duplicate video clips using perceptual hashing"""
    
    def __init__(self, threshold: int = 5):
        """
        Initialize detector
        
        Args:
            threshold: Maximum hash difference to consider clips as duplicates
        """
        self.threshold = threshold
    
    async def detect_duplicates(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Detect duplicate clips in a project
        
        Returns list of duplicate groups
        """
        project_path = os.path.join("projects", f"{project_id}.json")
        
        with open(project_path, 'r', encoding='utf-8') as f:
            project_data = json.load(f)
        
        clips = []
        for track in project_data.get('tracks', []):
            if track['type'] == 'video':
                clips.extend(track.get('clips', []))
        
        clip_hashes = {}
        
        for clip in clips:
            media_path = self._find_media_path(clip['media_id'])
            if media_path:
                frame_hash = await self._get_video_hash(media_path, clip['media_start'])
                clip_hashes[clip['id']] = {
                    'clip': clip,
                    'hash': frame_hash,
                    'media_id': clip['media_id']
                }
        
        duplicates = []
        checked = set()
        
        clip_ids = list(clip_hashes.keys())
        for i, clip_id1 in enumerate(clip_ids):
            if clip_id1 in checked:
                continue
            
            group = [clip_id1]
            
            for clip_id2 in clip_ids[i+1:]:
                if clip_id2 in checked:
                    continue
                
                hash1 = clip_hashes[clip_id1]['hash']
                hash2 = clip_hashes[clip_id2]['hash']
                
                if hash1 and hash2:
                    diff = hash1 - hash2
                    if diff <= self.threshold:
                        group.append(clip_id2)
                        checked.add(clip_id2)
            
            if len(group) > 1:
                duplicates.append({
                    'clips': [clip_hashes[cid]['clip'] for cid in group],
                    'count': len(group)
                })
                checked.add(clip_id1)
        
        return duplicates
    
    async def _get_video_hash(self, video_path: str, timestamp: float = 1.0) -> imagehash.ImageHash:
        """Extract a frame from video and compute perceptual hash"""
        try:
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
                tmp_path = tmp.name
            
            cmd = [
                'ffmpeg',
                '-ss', str(timestamp),
                '-i', video_path,
                '-vframes', '1',
                '-q:v', '2',
                '-y',
                tmp_path
            ]
            
            subprocess.run(cmd, capture_output=True, check=True)
            
            image = Image.open(tmp_path)
            phash = imagehash.phash(image)
            
            os.unlink(tmp_path)
            
            return phash
        
        except Exception as e:
            print(f"Error computing video hash: {e}")
            return None
    
    def _find_media_path(self, media_id: str) -> str:
        """Find media file path by ID"""
        uploads_dir = "uploads"
        
        for filename in os.listdir(uploads_dir):
            if filename.startswith(media_id):
                return os.path.join(uploads_dir, filename)
        
        return None
