import subprocess
import json
import os
from typing import Dict, Any, List
import numpy as np

class MediaProcessor:
    """Process media files to extract metadata and generate thumbnails/waveforms"""
    
    async def process_media(self, filepath: str, media_type: str) -> Dict[str, Any]:
        """Process media file and return metadata"""
        info = await self.get_media_info(filepath, media_type)
        
        if media_type == "video":
            info["thumbnail"] = await self.generate_thumbnail(filepath)
        elif media_type == "audio":
            info["waveform"] = await self.generate_waveform(filepath)
        elif media_type == "image":
            info["thumbnail"] = filepath
        
        return info
    
    async def get_media_info(self, filepath: str, media_type: str) -> Dict[str, Any]:
        """Get media file information using ffprobe"""
        try:
            cmd = [
                'ffprobe',
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                filepath
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            data = json.loads(result.stdout)
            
            info = {}
            
            if 'format' in data:
                info['duration'] = float(data['format'].get('duration', 0))
            
            for stream in data.get('streams', []):
                if stream.get('codec_type') == 'video':
                    info['width'] = stream.get('width')
                    info['height'] = stream.get('height')
                    break
            
            return info
        
        except Exception as e:
            print(f"Error getting media info: {e}")
            return {}
    
    async def generate_thumbnail(self, video_path: str) -> str:
        """Generate thumbnail for video"""
        try:
            output_path = video_path.replace(os.path.splitext(video_path)[1], "_thumb.jpg")
            
            cmd = [
                'ffmpeg',
                '-i', video_path,
                '-ss', '00:00:01',
                '-vframes', '1',
                '-vf', 'scale=320:-1',
                '-y',
                output_path
            ]
            
            subprocess.run(cmd, capture_output=True, check=True)
            
            return f"/uploads/{os.path.basename(output_path)}"
        
        except Exception as e:
            print(f"Error generating thumbnail: {e}")
            return None
    
    async def generate_waveform(self, audio_path: str, samples: int = 1000) -> List[float]:
        """Generate waveform data for audio visualization"""
        try:
            import librosa
            
            y, sr = librosa.load(audio_path, sr=None)
            
            hop_length = len(y) // samples
            if hop_length < 1:
                hop_length = 1
            
            rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
            
            normalized = (rms / np.max(rms)).tolist()
            
            return normalized[:samples]
        
        except Exception as e:
            print(f"Error generating waveform: {e}")
            return []
