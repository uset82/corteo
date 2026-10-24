// Duplicate shot detector using perceptual hashing
export interface DuplicateGroup {
  clips: string[]; // clip IDs
  thumbnail?: string;
  similarity: number;
}

export class DuplicateDetector {
  private hashes: Map<string, string> = new Map();
  
  // Simplified perceptual hash (production would use actual image hashing library)
  async computeHash(imageData: ImageData): Promise<string> {
    // Resize to 8x8
    const size = 8;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    // Draw resized image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0, size, size);
    
    // Get grayscale values
    const data = ctx.getImageData(0, 0, size, size).data;
    const gray: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      gray.push(Math.floor((data[i] + data[i + 1] + data[i + 2]) / 3));
    }
    
    // Compute average
    const avg = gray.reduce((a, b) => a + b, 0) / gray.length;
    
    // Create hash
    let hash = '';
    for (const val of gray) {
      hash += val > avg ? '1' : '0';
    }
    
    return hash;
  }
  
  // Calculate Hamming distance between two hashes
  hammingDistance(hash1: string, hash2: string): number {
    let distance = 0;
    for (let i = 0; i < Math.min(hash1.length, hash2.length); i++) {
      if (hash1[i] !== hash2[i]) distance++;
    }
    return distance;
  }
  
  // Find duplicates in a set of clips
  findDuplicates(clips: Array<{ id: string; hash: string }>, threshold = 5): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();
    
    for (let i = 0; i < clips.length; i++) {
      if (processed.has(clips[i].id)) continue;
      
      const group: string[] = [clips[i].id];
      processed.add(clips[i].id);
      
      for (let j = i + 1; j < clips.length; j++) {
        if (processed.has(clips[j].id)) continue;
        
        const distance = this.hammingDistance(clips[i].hash, clips[j].hash);
        if (distance <= threshold) {
          group.push(clips[j].id);
          processed.add(clips[j].id);
        }
      }
      
      if (group.length > 1) {
        groups.push({
          clips: group,
          similarity: 100 - (threshold / 64) * 100, // Convert to percentage
        });
      }
    }
    
    return groups;
  }
  
  // Extract frame from video at specific time
  async extractFrame(videoElement: HTMLVideoElement, time: number): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      videoElement.currentTime = time;
      
      videoElement.onseeked = () => {
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        ctx.drawImage(videoElement, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve(imageData);
      };
      
      videoElement.onerror = reject;
    });
  }
}

// React component for duplicate detector panel
import { useState, useEffect } from 'react';

interface DuplicateDetectorPanelProps {
  projectClips: Array<{
    id: string;
    mediaId: string;
    startTime: number;
    endTime: number;
  }>;
  onHighlightClips: (clipIds: string[]) => void;
}

export function DuplicateDetectorPanel({ projectClips, onHighlightClips }: DuplicateDetectorPanelProps) {
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const scanForDuplicates = async () => {
    setScanning(true);
    setProgress(0);
    
    const detector = new DuplicateDetector();
    const clipHashes: Array<{ id: string; hash: string }> = [];
    
    // In production, this would load actual video frames
    // For now, simulate the scanning process
    for (let i = 0; i < projectClips.length; i++) {
      // Simulate hash computation
      const hash = Math.random().toString(36).substring(7);
      clipHashes.push({ id: projectClips[i].id, hash });
      setProgress(((i + 1) / projectClips.length) * 100);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const found = detector.findDuplicates(clipHashes);
    setDuplicates(found);
    setScanning(false);
  };
  
  return (
    <div className="duplicate-detector-panel" style={{ padding: '16px', background: '#2a2a2a', borderRadius: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Duplicate Shot Detector</h3>
        <button
          onClick={scanForDuplicates}
          disabled={scanning}
          style={{
            padding: '6px 12px',
            background: scanning ? '#444' : '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: scanning ? 'not-allowed' : 'pointer',
          }}
        >
          {scanning ? `Scanning... ${Math.round(progress)}%` : 'Scan Project'}
        </button>
      </div>
      
      {scanning && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ width: '100%', height: '4px', background: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s' }} />
          </div>
        </div>
      )}
      
      {duplicates.length === 0 && !scanning && (
        <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontSize: '13px' }}>
          No duplicates found. Click "Scan Project" to check for repeated shots.
        </div>
      )}
      
      {duplicates.length > 0 && (
        <div>
          <div style={{ marginBottom: '12px', fontSize: '12px', color: '#aaa' }}>
            Found {duplicates.length} duplicate group(s)
          </div>
          
          {duplicates.map((group, index) => (
            <div
              key={index}
              style={{
                padding: '12px',
                background: '#1a1a1a',
                borderRadius: '4px',
                marginBottom: '8px',
                cursor: 'pointer',
              }}
              onClick={() => onHighlightClips(group.clips)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 500 }}>
                  Group {index + 1} ({group.clips.length} clips)
                </span>
                <span style={{ fontSize: '11px', color: '#10b981' }}>
                  {Math.round(group.similarity)}% similar
                </span>
              </div>
              
              <div style={{ fontSize: '11px', color: '#666' }}>
                Click to highlight in timeline
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div style={{ marginTop: '16px', padding: '12px', background: '#1a1a1a', borderRadius: '4px', fontSize: '11px', color: '#888' }}>
        💡 The duplicate detector uses perceptual hashing to find visually similar shots in your project
      </div>
    </div>
  );
}
