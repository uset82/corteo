export const formatTime = (seconds: number, countdown = false): string => {
  if (countdown) {
    seconds = Math.max(0, seconds);
  }
  
  const hrs = Math.floor(Math.abs(seconds) / 3600);
  const mins = Math.floor((Math.abs(seconds) % 3600) / 60);
  const secs = Math.floor(Math.abs(seconds) % 60);
  const ms = Math.floor((Math.abs(seconds) % 1) * 100);
  
  const sign = countdown && seconds < 0 ? '-' : '';
  
  if (hrs > 0) {
    return `${sign}${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  
  return `${sign}${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export const parseTime = (timeStr: string): number => {
  const parts = timeStr.split(':');
  
  if (parts.length === 2) {
    const [mins, secs] = parts;
    return parseInt(mins) * 60 + parseFloat(secs);
  } else if (parts.length === 3) {
    const [hrs, mins, secs] = parts;
    return parseInt(hrs) * 3600 + parseInt(mins) * 60 + parseFloat(secs);
  }
  
  return 0;
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export const snapToGrid = (value: number, gridSize: number): number => {
  return Math.round(value / gridSize) * gridSize;
};
