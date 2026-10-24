// Countdown time display toggle for timeline
import { useState } from 'react';

export type TimeDisplayMode = 'elapsed' | 'countdown';

interface TimeDisplayProps {
  currentTime: number;
  totalDuration: number;
  mode: TimeDisplayMode;
  onToggleMode: () => void;
}

export function TimeDisplay({ currentTime, totalDuration, mode, onToggleMode }: TimeDisplayProps) {
  const displayTime = mode === 'countdown' ? totalDuration - currentTime : currentTime;
  const isNegative = mode === 'countdown' && displayTime < 0;
  
  return (
    <div
      className="time-display"
      onClick={onToggleMode}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        background: '#1a1a1a',
        borderRadius: '6px',
        fontSize: '13px',
        fontFamily: 'monospace',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'background 0.2s',
      }}
      title="Click to toggle between elapsed and countdown"
    >
      <span style={{ color: '#888', fontSize: '11px' }}>
        {mode === 'countdown' ? '⏱' : '⏲'}
      </span>
      <span style={{ color: '#fff', fontWeight: 500 }}>
        {isNegative && '-'}
        {formatTime(Math.abs(displayTime))}
      </span>
      <span style={{ color: '#666', fontSize: '11px' }}>
        / {formatTime(totalDuration)}
      </span>
    </div>
  );
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30); // Assuming 30fps
  
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(secs)}.${pad(frames)}`;
  }
  return `${minutes}:${pad(secs)}.${pad(frames)}`;
}

function pad(num: number): string {
  return num.toString().padStart(2, '0');
}

// Hook for managing time display state
export function useTimeDisplay(totalDuration: number) {
  const [mode, setMode] = useState<TimeDisplayMode>('elapsed');
  
  const toggleMode = () => {
    setMode(prev => prev === 'elapsed' ? 'countdown' : 'elapsed');
  };
  
  return {
    mode,
    toggleMode,
    formatTime,
  };
}

// Styled component version for integration with OpenChatCut
export function TimelineTimeDisplay({ currentTime, totalDuration }: { currentTime: number; totalDuration: number }) {
  const { mode, toggleMode } = useTimeDisplay(totalDuration);
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 16px', background: '#2a2a2a' }}>
      <TimeDisplay
        currentTime={currentTime}
        totalDuration={totalDuration}
        mode={mode}
        onToggleMode={toggleMode}
      />
      
      <div style={{ fontSize: '11px', color: '#666' }}>
        {mode === 'elapsed' ? 'Elapsed time' : 'Time remaining'}
      </div>
      
      <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#888' }}>
        Click time to toggle countdown
      </div>
    </div>
  );
}
