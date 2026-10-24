import React, { useRef, useCallback, useState } from 'react';
import { ZoomIn, ZoomOut, Grid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '@/hooks/useEditorStore';
import { generateId, snapToGrid } from '@/utils/helpers';
import type { MediaFile, TimelineClip } from '@/types';
import './Timeline.css';

const PIXELS_PER_SECOND = 50;
const TRACK_HEIGHT = 60;

export const Timeline: React.FC = () => {
  const { t } = useTranslation();
  const timelineRef = useRef<HTMLDivElement>(null);
  const {
    currentProject,
    playheadPosition,
    zoom,
    setPlayheadPosition,
    setZoom,
    addClipToTrack,
  } = useEditorStore();
  
  const [snapEnabled, setSnapEnabled] = useState(true);
  
  const handleZoomIn = () => setZoom(Math.min(zoom * 1.5, 10));
  const handleZoomOut = () => setZoom(Math.max(zoom / 1.5, 0.1));
  
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !currentProject) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = x / (PIXELS_PER_SECOND * zoom);
    
    setPlayheadPosition(Math.max(0, Math.min(time, currentProject.duration)));
  };
  
  const handleDrop = useCallback((e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    
    try {
      const mediaData = e.dataTransfer.getData('application/json');
      if (!mediaData) return;
      
      const media: MediaFile = JSON.parse(mediaData);
      
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const startTime = x / (PIXELS_PER_SECOND * zoom);
      
      const snappedStart = snapEnabled ? snapToGrid(startTime, 0.5) : startTime;
      
      const clip: TimelineClip = {
        id: generateId(),
        track_id: trackId,
        media_id: media.id,
        start_time: snappedStart,
        end_time: snappedStart + (media.duration || 5),
        media_start: 0,
        media_end: media.duration || 5,
        speed: 1.0,
        fade_in: 0,
        fade_out: 0,
      };
      
      addClipToTrack(trackId, clip);
    } catch (error) {
      console.error('Drop failed:', error);
    }
  }, [zoom, snapEnabled, addClipToTrack]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);
  
  if (!currentProject) {
    return (
      <div className="timeline timeline-empty">
        <p>{t('menu.new')}</p>
      </div>
    );
  }
  
  const duration = Math.max(currentProject.duration, 60);
  const timelineWidth = duration * PIXELS_PER_SECOND * zoom;
  
  return (
    <div className="timeline">
      <div className="timeline-header">
        <h3>{t('timeline.video')}</h3>
        
        <div className="timeline-controls">
          <button
            className={`control-btn ${snapEnabled ? 'active' : ''}`}
            onClick={() => setSnapEnabled(!snapEnabled)}
            title={t('timeline.snap')}
          >
            <Grid size={16} />
          </button>
          
          <button className="control-btn" onClick={handleZoomOut}>
            <ZoomOut size={16} />
          </button>
          
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          
          <button className="control-btn" onClick={handleZoomIn}>
            <ZoomIn size={16} />
          </button>
        </div>
      </div>
      
      <div className="timeline-content" ref={timelineRef} onClick={handleTimelineClick}>
        <TimeRuler duration={duration} zoom={zoom} />
        
        <div className="timeline-tracks">
          {currentProject.tracks.map((track) => (
            <Track
              key={track.id}
              track={track}
              zoom={zoom}
              timelineWidth={timelineWidth}
              onDrop={(e) => handleDrop(e, track.id)}
              onDragOver={handleDragOver}
            />
          ))}
        </div>
        
        <div
          className="playhead"
          style={{
            left: `${playheadPosition * PIXELS_PER_SECOND * zoom}px`,
          }}
        />
      </div>
    </div>
  );
};

const TimeRuler: React.FC<{ duration: number; zoom: number }> = ({ duration, zoom }) => {
  const markers = [];
  const step = zoom > 2 ? 1 : zoom > 1 ? 5 : 10;
  
  for (let i = 0; i <= duration; i += step) {
    markers.push(
      <div
        key={i}
        className="time-marker"
        style={{ left: `${i * PIXELS_PER_SECOND * zoom}px` }}
      >
        <span>{i}s</span>
      </div>
    );
  }
  
  return <div className="time-ruler">{markers}</div>;
};

const Track: React.FC<{
  track: any;
  zoom: number;
  timelineWidth: number;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
}> = ({ track, zoom, timelineWidth, onDrop, onDragOver }) => {
  return (
    <div
      className="timeline-track"
      style={{ height: `${TRACK_HEIGHT}px` }}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <div className="track-label">{track.name}</div>
      
      <div className="track-content" style={{ width: `${timelineWidth}px` }}>
        {track.clips.map((clip: TimelineClip) => (
          <TimelineClipComponent key={clip.id} clip={clip} zoom={zoom} />
        ))}
      </div>
    </div>
  );
};

const TimelineClipComponent: React.FC<{ clip: TimelineClip; zoom: number }> = ({ clip, zoom }) => {
  const { setSelectedClip } = useEditorStore();
  
  const clipWidth = (clip.end_time - clip.start_time) * PIXELS_PER_SECOND * zoom;
  const clipLeft = clip.start_time * PIXELS_PER_SECOND * zoom;
  
  return (
    <div
      className="timeline-clip"
      style={{
        left: `${clipLeft}px`,
        width: `${clipWidth}px`,
      }}
      onClick={() => setSelectedClip(clip)}
    >
      <div className="clip-content">{clip.media_id.substring(0, 8)}</div>
    </div>
  );
};
