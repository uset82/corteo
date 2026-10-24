export interface MediaFile {
  id: string;
  filename: string;
  type: 'video' | 'audio' | 'image';
  path: string;
  url: string;
  duration?: number;
  width?: number;
  height?: number;
  thumbnail?: string;
  waveform?: number[];
  uploaded_at: string;
}

export interface TimelineClip {
  id: string;
  track_id: string;
  media_id: string;
  start_time: number;
  end_time: number;
  media_start: number;
  media_end: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scale?: number;
  speed: number;
  fade_in: number;
  fade_out: number;
  ken_burns?: KenBurnsEffect;
}

export interface KenBurnsEffect {
  start_x: number;
  start_y: number;
  start_scale: number;
  end_x: number;
  end_y: number;
  end_scale: number;
  easing: string;
}

export interface SubtitleStyle {
  name: string;
  font_family: string;
  font_size: number;
  color: string;
  background?: string;
  bold: boolean;
  italic: boolean;
  position: 'top' | 'center' | 'bottom';
  alignment: 'left' | 'center' | 'right';
  karaoke: boolean;
  karaoke_color?: string;
}

export interface SubtitleEntry {
  id: string;
  start_time: number;
  end_time: number;
  text: string;
  style_name: string;
  words?: Array<{ word: string; start: number; end: number }>;
}

export interface Track {
  id: string;
  type: 'video' | 'audio' | 'subtitle';
  name: string;
  order: number;
  clips: TimelineClip[];
}

export interface Project {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  tracks: Track[];
  subtitles: SubtitleEntry[];
  subtitle_styles: SubtitleStyle[];
  duration: number;
  created_at: string;
  updated_at: string;
}

export interface RenderStatus {
  id: string;
  project_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  output_path?: string;
  error?: string;
  started_at?: string;
  completed_at?: string;
}
