import subprocess
import json
import os
from datetime import datetime
from typing import Dict, Any
from backend.models.schemas import Project, TimelineClip, SubtitleEntry

class VideoRenderer:
    """Render video projects using FFmpeg"""
    
    async def render_project(
        self,
        render_id: str,
        project_id: str,
        resolution: str,
        codec: str,
        quality: str,
        render_jobs: Dict[str, Any]
    ):
        """Render a video project"""
        try:
            render_jobs[render_id].status = "processing"
            render_jobs[render_id].progress = 0.0
            
            project_path = os.path.join("projects", f"{project_id}.json")
            with open(project_path, 'r', encoding='utf-8') as f:
                project_data = json.load(f)
                project = Project(**project_data)
            
            width, height = self._get_resolution(resolution, project.width, project.height)
            
            output_filename = f"{render_id}.mp4"
            output_path = os.path.join("renders", output_filename)
            
            filter_complex = self._build_filter_complex(project, width, height)
            
            cmd = self._build_ffmpeg_command(
                project, filter_complex, output_path, width, height, codec, quality
            )
            
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )
            
            for line in process.stderr:
                if 'time=' in line:
                    try:
                        time_str = line.split('time=')[1].split()[0]
                        hours, minutes, seconds = time_str.split(':')
                        current_time = int(hours) * 3600 + int(minutes) * 60 + float(seconds)
                        progress = min((current_time / project.duration) * 100, 99.0) if project.duration > 0 else 0
                        render_jobs[render_id].progress = progress
                    except:
                        pass
            
            process.wait()
            
            if process.returncode == 0:
                render_jobs[render_id].status = "completed"
                render_jobs[render_id].progress = 100.0
                render_jobs[render_id].output_path = f"/renders/{output_filename}"
                render_jobs[render_id].completed_at = datetime.now().isoformat()
            else:
                render_jobs[render_id].status = "failed"
                render_jobs[render_id].error = "FFmpeg rendering failed"
        
        except Exception as e:
            render_jobs[render_id].status = "failed"
            render_jobs[render_id].error = str(e)
    
    def _get_resolution(self, resolution: str, default_width: int, default_height: int) -> tuple:
        """Get width and height for resolution preset"""
        resolutions = {
            "720p": (1280, 720),
            "1080p": (1920, 1080),
            "4k": (3840, 2160)
        }
        return resolutions.get(resolution, (default_width, default_height))
    
    def _build_filter_complex(self, project: Project, width: int, height: int) -> str:
        """Build FFmpeg filter_complex for the project"""
        filters = []
        
        video_tracks = [t for t in project.tracks if t.type == "video"]
        
        for track_idx, track in enumerate(video_tracks):
            for clip_idx, clip in enumerate(track.clips):
                input_idx = track_idx * len(track.clips) + clip_idx
                
                clip_filters = []
                
                if clip.ken_burns:
                    kb = clip.ken_burns
                    duration = clip.end_time - clip.start_time
                    zoompan_filter = (
                        f"zoompan=z='zoom+{(kb.get('end_scale', 1.0) - kb.get('start_scale', 1.0)) / duration}':"
                        f"x='iw/2-(iw/zoom/2)+{kb.get('end_x', 0) - kb.get('start_x', 0)}':"
                        f"y='ih/2-(ih/zoom/2)+{kb.get('end_y', 0) - kb.get('start_y', 0)}':"
                        f"d=1:s={width}x{height}"
                    )
                    clip_filters.append(zoompan_filter)
                
                if clip.scale and clip.scale != 1.0:
                    scale_w = int(width * clip.scale)
                    scale_h = int(height * clip.scale)
                    clip_filters.append(f"scale={scale_w}:{scale_h}")
                
                clip_filters.append(f"scale={width}:{height}:force_original_aspect_ratio=decrease")
                clip_filters.append(f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2")
                
                if clip.fade_in > 0:
                    clip_filters.append(f"fade=t=in:st={clip.start_time}:d={clip.fade_in}")
                if clip.fade_out > 0:
                    clip_filters.append(f"fade=t=out:st={clip.end_time - clip.fade_out}:d={clip.fade_out}")
                
                if clip_filters:
                    filters.append(f"[{input_idx}:v]{','.join(clip_filters)}[v{input_idx}]")
        
        if len(filters) > 1:
            overlay_chain = "[v0]"
            for i in range(1, len(filters)):
                overlay_chain += f"[v{i}]overlay[tmp{i}];"
            overlay_chain = overlay_chain.replace(f"[tmp{len(filters)-1}]", "[outv]")
            filters.append(overlay_chain)
        elif len(filters) == 1:
            filters.append("[v0]null[outv]")
        
        return ";".join(filters) if filters else "[0:v]null[outv]"
    
    def _build_ffmpeg_command(
        self,
        project: Project,
        filter_complex: str,
        output_path: str,
        width: int,
        height: int,
        codec: str,
        quality: str
    ) -> list:
        """Build FFmpeg command"""
        cmd = ['ffmpeg']
        
        video_tracks = [t for t in project.tracks if t.type == "video"]
        for track in video_tracks:
            for clip in track.clips:
                media_path = None
                for root, dirs, files in os.walk("uploads"):
                    for file in files:
                        if file.startswith(clip.media_id):
                            media_path = os.path.join(root, file)
                            break
                
                if media_path:
                    cmd.extend(['-i', media_path])
        
        audio_tracks = [t for t in project.tracks if t.type == "audio"]
        if audio_tracks and audio_tracks[0].clips:
            audio_clip = audio_tracks[0].clips[0]
            audio_path = None
            for root, dirs, files in os.walk("uploads"):
                for file in files:
                    if file.startswith(audio_clip.media_id):
                        audio_path = os.path.join(root, file)
                        break
            if audio_path:
                cmd.extend(['-i', audio_path])
        
        cmd.extend(['-filter_complex', filter_complex])
        cmd.extend(['-map', '[outv]'])
        
        if audio_tracks and audio_tracks[0].clips:
            cmd.extend(['-map', f'{len(video_tracks[0].clips)}:a'])
        
        if codec == 'h264':
            cmd.extend(['-c:v', 'libx264'])
            cmd.extend(['-preset', quality])
        elif codec == 'hevc':
            cmd.extend(['-c:v', 'libx265'])
            cmd.extend(['-preset', quality])
        
        cmd.extend(['-c:a', 'aac', '-b:a', '192k'])
        cmd.extend(['-movflags', '+faststart'])
        cmd.extend(['-y', output_path])
        
        return cmd
