import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '@/hooks/useEditorStore';
import { formatTime } from '@/utils/helpers';
import './PreviewPlayer.css';

export const PreviewPlayer: React.FC = () => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    currentProject,
    playheadPosition,
    isPlaying,
    timeDisplayMode,
    setPlayheadPosition,
    setIsPlaying,
    setTimeDisplayMode,
  } = useEditorStore();
  
  const [currentTime, setCurrentTime] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying && currentProject) {
        const newTime = playheadPosition + 0.033;
        
        if (newTime >= currentProject.duration) {
          setIsPlaying(false);
          setPlayheadPosition(0);
        } else {
          setPlayheadPosition(newTime);
          setCurrentTime(newTime);
        }
      }
    }, 33);
    
    return () => clearInterval(interval);
  }, [isPlaying, playheadPosition, currentProject, setPlayheadPosition, setIsPlaying]);
  
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };
  
  const handleSkipBack = () => {
    setPlayheadPosition(Math.max(0, playheadPosition - 1));
  };
  
  const handleSkipForward = () => {
    if (currentProject) {
      setPlayheadPosition(Math.min(currentProject.duration, playheadPosition + 1));
    }
  };
  
  const toggleTimeMode = () => {
    setTimeDisplayMode(timeDisplayMode === 'elapsed' ? 'countdown' : 'elapsed');
  };
  
  const displayTime = timeDisplayMode === 'countdown' && currentProject
    ? currentProject.duration - currentTime
    : currentTime;
  
  return (
    <div className="preview-player">
      <div className="preview-canvas">
        <canvas ref={canvasRef} className="preview-canvas-element" />
        {!currentProject && (
          <div className="preview-placeholder">
            <p>{t('menu.new')}</p>
          </div>
        )}
      </div>
      
      <div className="preview-controls">
        <button onClick={handleSkipBack} className="control-btn">
          <SkipBack size={20} />
        </button>
        
        <button onClick={handlePlayPause} className="control-btn control-btn-primary">
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>
        
        <button onClick={handleSkipForward} className="control-btn">
          <SkipForward size={20} />
        </button>
        
        <div className="time-display" onClick={toggleTimeMode} title={t('preview.elapsed')}>
          <Clock size={16} />
          {timeDisplayMode === 'countdown' && '-'}
          {formatTime(displayTime)}
          {currentProject && ` / ${formatTime(currentProject.duration)}`}
        </div>
      </div>
    </div>
  );
};
