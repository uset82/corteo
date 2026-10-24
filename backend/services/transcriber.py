import re
import uuid
from typing import List, Optional, Dict, Any
from backend.models.schemas import SubtitleEntry

class Transcriber:
    """Handle audio transcription and subtitle processing"""
    
    async def transcribe(
        self,
        audio_path: str,
        lyrics: Optional[str] = None,
        isolate_vocals: bool = False,
        language: str = "es"
    ) -> List[SubtitleEntry]:
        """Transcribe audio using Whisper (requires whisper to be installed)"""
        try:
            try:
                import whisper
            except ImportError:
                print("Whisper not installed. Returning placeholder subtitles.")
                return [
                    SubtitleEntry(
                        id=str(uuid.uuid4()),
                        start_time=0.0,
                        end_time=5.0,
                        text="Whisper not installed. Please install with: pip install openai-whisper",
                        style_name="default"
                    )
                ]
            
            processed_audio = audio_path
            
            if isolate_vocals:
                processed_audio = await self._isolate_vocals(audio_path)
            
            model = whisper.load_model("base")
            
            result = model.transcribe(
                processed_audio,
                language=language,
                word_timestamps=True
            )
            
            subtitles = []
            
            for segment in result['segments']:
                words = []
                if 'words' in segment:
                    for word_info in segment['words']:
                        words.append({
                            'word': word_info.get('word', '').strip(),
                            'start': word_info.get('start', 0),
                            'end': word_info.get('end', 0)
                        })
                
                subtitle = SubtitleEntry(
                    id=str(uuid.uuid4()),
                    start_time=segment['start'],
                    end_time=segment['end'],
                    text=segment['text'].strip(),
                    style_name="default",
                    words=words if words else None
                )
                subtitles.append(subtitle)
            
            if lyrics:
                subtitles = self._align_with_lyrics(subtitles, lyrics)
            
            return subtitles
        
        except Exception as e:
            print(f"Transcription error: {e}")
            return []
    
    async def _isolate_vocals(self, audio_path: str) -> str:
        """Isolate vocals using demucs (placeholder - requires demucs installation)"""
        return audio_path
    
    def _align_with_lyrics(self, subtitles: List[SubtitleEntry], lyrics: str) -> List[SubtitleEntry]:
        """Align transcribed subtitles with provided lyrics"""
        return subtitles
    
    def parse_srt(self, content: str) -> List[SubtitleEntry]:
        """Parse SRT subtitle file"""
        subtitles = []
        
        pattern = r'(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n(.+?)(?:\n\n|\n*$)'
        matches = re.finditer(pattern, content, re.DOTALL)
        
        for match in matches:
            start_time = self._srt_time_to_seconds(match.group(2))
            end_time = self._srt_time_to_seconds(match.group(3))
            text = match.group(4).strip()
            
            subtitle = SubtitleEntry(
                id=str(uuid.uuid4()),
                start_time=start_time,
                end_time=end_time,
                text=text,
                style_name="default"
            )
            subtitles.append(subtitle)
        
        return subtitles
    
    def parse_ass(self, content: str) -> List[SubtitleEntry]:
        """Parse ASS subtitle file"""
        subtitles = []
        
        lines = content.split('\n')
        for line in lines:
            if line.startswith('Dialogue:'):
                parts = line.split(',', 9)
                if len(parts) >= 10:
                    start_time = self._ass_time_to_seconds(parts[1].strip())
                    end_time = self._ass_time_to_seconds(parts[2].strip())
                    text = parts[9].strip()
                    
                    text = re.sub(r'\{[^}]*\}', '', text)
                    
                    subtitle = SubtitleEntry(
                        id=str(uuid.uuid4()),
                        start_time=start_time,
                        end_time=end_time,
                        text=text,
                        style_name="default"
                    )
                    subtitles.append(subtitle)
        
        return subtitles
    
    def export_srt(self, subtitles: List[SubtitleEntry]) -> str:
        """Export subtitles to SRT format"""
        srt_content = ""
        
        for idx, subtitle in enumerate(subtitles, 1):
            start_time = self._seconds_to_srt_time(subtitle.start_time)
            end_time = self._seconds_to_srt_time(subtitle.end_time)
            
            srt_content += f"{idx}\n"
            srt_content += f"{start_time} --> {end_time}\n"
            srt_content += f"{subtitle.text}\n\n"
        
        return srt_content
    
    def export_ass(self, subtitles: List[SubtitleEntry]) -> str:
        """Export subtitles to ASS format"""
        ass_header = """[Script Info]
Title: Video Editor Export
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        
        ass_content = ass_header
        
        for subtitle in subtitles:
            start_time = self._seconds_to_ass_time(subtitle.start_time)
            end_time = self._seconds_to_ass_time(subtitle.end_time)
            
            ass_content += f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{subtitle.text}\n"
        
        return ass_content
    
    def _srt_time_to_seconds(self, time_str: str) -> float:
        """Convert SRT time format to seconds"""
        hours, minutes, seconds = time_str.replace(',', '.').split(':')
        return int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    
    def _ass_time_to_seconds(self, time_str: str) -> float:
        """Convert ASS time format to seconds"""
        hours, minutes, seconds = time_str.split(':')
        return int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    
    def _seconds_to_srt_time(self, seconds: float) -> str:
        """Convert seconds to SRT time format"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = seconds % 60
        milliseconds = int((secs % 1) * 1000)
        secs = int(secs)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"
    
    def _seconds_to_ass_time(self, seconds: float) -> str:
        """Convert seconds to ASS time format"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = seconds % 60
        centiseconds = int((secs % 1) * 100)
        secs = int(secs)
        return f"{hours:01d}:{minutes:02d}:{secs:02d}.{centiseconds:02d}"
