// Enhanced export options for 4K H.264/HEVC
export interface ExportOptions {
  resolution: '720p' | '1080p' | '4k';
  codec: 'h264' | 'hevc';
  quality: 'low' | 'medium' | 'high' | 'maximum';
  fps: 24 | 30 | 60;
  format: 'mp4' | 'mov';
  audioCodec: 'aac' | 'opus';
  audioBitrate: 128 | 192 | 256 | 320;
}

export const RESOLUTION_PRESETS = {
  '720p': { width: 1280, height: 720, label: '720p HD' },
  '1080p': { width: 1920, height: 1080, label: '1080p Full HD' },
  '4k': { width: 3840, height: 2160, label: '4K Ultra HD' },
};

export const CODEC_INFO = {
  h264: {
    name: 'H.264 (AVC)',
    description: 'Best compatibility, widely supported',
    fileSize: 'Standard',
  },
  hevc: {
    name: 'H.265 (HEVC)',
    description: 'Smaller file size, newer devices',
    fileSize: '~50% smaller',
  },
};

export const QUALITY_PRESETS = {
  low: { crf: 28, label: 'Low (Fast, larger files)' },
  medium: { crf: 23, label: 'Medium (Balanced)' },
  high: { crf: 18, label: 'High (Recommended)' },
  maximum: { crf: 15, label: 'Maximum (Slow, best quality)' },
};

// React component for enhanced export dialog
import { useState } from 'react';

interface EnhancedExportDialogProps {
  onExport: (options: ExportOptions) => void;
  onCancel: () => void;
}

export function EnhancedExportDialog({ onExport, onCancel }: EnhancedExportDialogProps) {
  const [options, setOptions] = useState<ExportOptions>({
    resolution: '1080p',
    codec: 'h264',
    quality: 'high',
    fps: 30,
    format: 'mp4',
    audioCodec: 'aac',
    audioBitrate: 192,
  });
  
  const handleChange = (updates: Partial<ExportOptions>) => {
    setOptions({ ...options, ...updates });
  };
  
  const resolution = RESOLUTION_PRESETS[options.resolution];
  const codecInfo = CODEC_INFO[options.codec];
  const qualityInfo = QUALITY_PRESETS[options.quality];
  
  return (
    <div className="enhanced-export-dialog" style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '500px',
      background: '#2a2a2a',
      borderRadius: '8px',
      padding: '24px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      zIndex: 1000,
    }}>
      <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 600 }}>Export Video</h2>
      
      {/* Resolution */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500 }}>
          Resolution
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {(['720p', '1080p', '4k'] as const).map(res => (
            <button
              key={res}
              onClick={() => handleChange({ resolution: res })}
              style={{
                padding: '12px',
                background: options.resolution === res ? '#3b82f6' : '#1a1a1a',
                border: options.resolution === res ? '2px solid #3b82f6' : '1px solid #444',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontWeight: 600 }}>{RESOLUTION_PRESETS[res].label}</div>
              <div style={{ fontSize: '10px', color: '#aaa', marginTop: '4px' }}>
                {RESOLUTION_PRESETS[res].width} × {RESOLUTION_PRESETS[res].height}
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Codec */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500 }}>
          Video Codec
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {(['h264', 'hevc'] as const).map(codec => (
            <button
              key={codec}
              onClick={() => handleChange({ codec })}
              style={{
                padding: '12px',
                background: options.codec === codec ? '#3b82f6' : '#1a1a1a',
                border: options.codec === codec ? '2px solid #3b82f6' : '1px solid #444',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontWeight: 600 }}>{CODEC_INFO[codec].name}</div>
              <div style={{ fontSize: '10px', color: '#aaa', marginTop: '4px' }}>
                {CODEC_INFO[codec].description}
              </div>
              <div style={{ fontSize: '10px', color: '#10b981', marginTop: '2px' }}>
                {CODEC_INFO[codec].fileSize}
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Quality */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500 }}>
          Quality
        </label>
        <select
          value={options.quality}
          onChange={(e) => handleChange({ quality: e.target.value as any })}
          style={{
            width: '100%',
            padding: '10px',
            background: '#1a1a1a',
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '12px',
          }}
        >
          {Object.entries(QUALITY_PRESETS).map(([key, info]) => (
            <option key={key} value={key}>{info.label}</option>
          ))}
        </select>
      </div>
      
      {/* Frame Rate */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500 }}>
          Frame Rate
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {([24, 30, 60] as const).map(fps => (
            <button
              key={fps}
              onClick={() => handleChange({ fps })}
              style={{
                padding: '10px',
                background: options.fps === fps ? '#3b82f6' : '#1a1a1a',
                border: options.fps === fps ? '2px solid #3b82f6' : '1px solid #444',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {fps} fps
            </button>
          ))}
        </div>
      </div>
      
      {/* Audio */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500 }}>
          Audio Bitrate
        </label>
        <select
          value={options.audioBitrate}
          onChange={(e) => handleChange({ audioBitrate: parseInt(e.target.value) as any })}
          style={{
            width: '100%',
            padding: '10px',
            background: '#1a1a1a',
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '12px',
          }}
        >
          <option value={128}>128 kbps</option>
          <option value={192}>192 kbps (Recommended)</option>
          <option value={256}>256 kbps</option>
          <option value={320}>320 kbps (Maximum)</option>
        </select>
      </div>
      
      {/* Estimated file size */}
      <div style={{ padding: '12px', background: '#1a1a1a', borderRadius: '6px', marginBottom: '20px', fontSize: '11px', color: '#aaa' }}>
        📊 Estimated: ~{estimateFileSize(options)} MB per minute
      </div>
      
      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '10px 20px',
            background: '#1a1a1a',
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => onExport(options)}
          style={{
            padding: '10px 20px',
            background: '#10b981',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Export Video
        </button>
      </div>
    </div>
  );
}

function estimateFileSize(options: ExportOptions): number {
  const { resolution, codec, quality } = options;
  
  // Rough estimates in MB per minute
  const baseSize = {
    '720p': 50,
    '1080p': 100,
    '4k': 400,
  }[resolution];
  
  const codecMultiplier = codec === 'hevc' ? 0.5 : 1.0;
  const qualityMultiplier = {
    low: 0.6,
    medium: 0.8,
    high: 1.0,
    maximum: 1.3,
  }[quality];
  
  return Math.round(baseSize * codecMultiplier * qualityMultiplier);
}
