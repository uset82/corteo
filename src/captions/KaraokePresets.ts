// Karaoke caption presets for music videos
export interface CaptionStyle {
  name: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor?: string;
  bold: boolean;
  italic: boolean;
  position: 'top' | 'center' | 'bottom';
  alignment: 'left' | 'center' | 'right';
  karaoke: boolean;
  karaokeColor?: string;
  outline?: {
    color: string;
    width: number;
  };
  shadow?: {
    offsetX: number;
    offsetY: number;
    blur: number;
    color: string;
  };
}

// Preset styles for music videos
export const KARAOKE_PRESETS: CaptionStyle[] = [
  {
    name: 'verse',
    fontFamily: 'Georgia, serif',
    fontSize: 44,
    color: '#FFFFFF',
    bold: false,
    italic: false,
    position: 'bottom',
    alignment: 'center',
    karaoke: true,
    karaokeColor: '#FFD700',
    outline: {
      color: '#000000',
      width: 2,
    },
    shadow: {
      offsetX: 2,
      offsetY: 2,
      blur: 4,
      color: 'rgba(0,0,0,0.6)',
    },
  },
  {
    name: 'chant',
    fontFamily: 'Impact, sans-serif',
    fontSize: 72,
    color: '#FF0000',
    bold: true,
    italic: false,
    position: 'center',
    alignment: 'center',
    karaoke: true,
    karaokeColor: '#FFFF00',
    outline: {
      color: '#000000',
      width: 3,
    },
    shadow: {
      offsetX: 3,
      offsetY: 3,
      blur: 6,
      color: 'rgba(0,0,0,0.8)',
    },
  },
  {
    name: 'default',
    fontFamily: 'Arial, sans-serif',
    fontSize: 48,
    color: '#FFFFFF',
    bold: false,
    italic: false,
    position: 'bottom',
    alignment: 'center',
    karaoke: false,
    outline: {
      color: '#000000',
      width: 2,
    },
  },
];

// Word-level timing for karaoke
export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface KaraokeCaption {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  styleName: string;
  words?: WordTiming[];
}

// ASS file parser
export function parseASS(content: string): KaraokeCaption[] {
  const captions: KaraokeCaption[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('Dialogue:')) {
      const parts = line.split(',');
      if (parts.length >= 10) {
        const start = assTimeToSeconds(parts[1].trim());
        const end = assTimeToSeconds(parts[2].trim());
        const text = parts.slice(9).join(',').replace(/\{[^}]*\}/g, '').trim();
        
        captions.push({
          id: `caption-${Date.now()}-${Math.random()}`,
          startTime: start,
          endTime: end,
          text,
          styleName: 'default',
        });
      }
    }
  }
  
  return captions;
}

// SRT file parser
export function parseSRT(content: string): KaraokeCaption[] {
  const captions: KaraokeCaption[] = [];
  const blocks = content.trim().split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length >= 3) {
      const timeLine = lines[1];
      const match = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      
      if (match) {
        const start = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 1000;
        const end = parseInt(match[5]) * 3600 + parseInt(match[6]) * 60 + parseInt(match[7]) + parseInt(match[8]) / 1000;
        const text = lines.slice(2).join('\n').trim();
        
        captions.push({
          id: `caption-${Date.now()}-${Math.random()}`,
          startTime: start,
          endTime: end,
          text,
          styleName: 'default',
        });
      }
    }
  }
  
  return captions;
}

// Export to ASS format
export function exportToASS(captions: KaraokeCaption[], styles: CaptionStyle[]): string {
  let ass = `[Script Info]
Title: Music Video Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
`;

  // Add styles
  for (const style of styles) {
    const alignment = getASSAlignment(style.position, style.alignment);
    const primaryColor = colorToASS(style.color);
    const outlineColor = style.outline ? colorToASS(style.outline.color) : '&H00000000';
    const karaokeColor = style.karaokeColor ? colorToASS(style.karaokeColor) : primaryColor;
    
    ass += `Style: ${style.name},${style.fontFamily},${style.fontSize},${primaryColor},${karaokeColor},${outlineColor},&H00000000,${style.bold ? -1 : 0},${style.italic ? -1 : 0},0,0,100,100,0,0,1,${style.outline?.width || 2},0,${alignment},10,10,10,1\n`;
  }

  ass += `\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

  // Add captions
  for (const caption of captions) {
    const start = secondsToASSTime(caption.startTime);
    const end = secondsToASSTime(caption.endTime);
    const style = caption.styleName || 'default';
    
    let text = caption.text;
    
    // Add karaoke timing if available
    if (caption.words && caption.words.length > 0) {
      text = caption.words.map(word => {
        const duration = Math.round((word.end - word.start) * 100);
        return `{\\k${duration}}${word.word}`;
      }).join('');
    }
    
    ass += `Dialogue: 0,${start},${end},${style},,0,0,0,,${text}\n`;
  }

  return ass;
}

// Export to SRT format
export function exportToSRT(captions: KaraokeCaption[]): string {
  let srt = '';
  
  captions.forEach((caption, index) => {
    const start = secondsToSRTTime(caption.startTime);
    const end = secondsToSRTTime(caption.endTime);
    
    srt += `${index + 1}\n`;
    srt += `${start} --> ${end}\n`;
    srt += `${caption.text}\n\n`;
  });
  
  return srt;
}

// Helper functions
function assTimeToSeconds(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
}

function secondsToASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(2);
  return `${h}:${m.toString().padStart(2, '0')}:${s.padStart(5, '0')}`;
}

function secondsToSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function colorToASS(hex: string): string {
  // Convert #RRGGBB to &HBBGGRR
  const r = hex.substring(1, 3);
  const g = hex.substring(3, 5);
  const b = hex.substring(5, 7);
  return `&H00${b}${g}${r}`;
}

function getASSAlignment(position: string, alignment: string): number {
  // ASS alignment: 1-3 bottom, 4-6 middle, 7-9 top
  // Within each row: 1/4/7 left, 2/5/8 center, 3/6/9 right
  const posMap = { bottom: 0, center: 3, top: 6 };
  const alignMap = { left: 1, center: 2, right: 3 };
  return (posMap[position] || 0) + (alignMap[alignment] || 2);
}
