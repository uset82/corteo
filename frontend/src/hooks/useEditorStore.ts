import { create } from 'zustand';
import type { Project, MediaFile, Track, TimelineClip, SubtitleEntry } from '@/types';

interface EditorState {
  currentProject: Project | null;
  mediaLibrary: MediaFile[];
  playheadPosition: number;
  isPlaying: boolean;
  zoom: number;
  selectedClip: TimelineClip | null;
  timeDisplayMode: 'elapsed' | 'countdown';
  
  setCurrentProject: (project: Project | null) => void;
  setMediaLibrary: (media: MediaFile[]) => void;
  addMedia: (media: MediaFile) => void;
  setPlayheadPosition: (position: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setZoom: (zoom: number) => void;
  setSelectedClip: (clip: TimelineClip | null) => void;
  setTimeDisplayMode: (mode: 'elapsed' | 'countdown') => void;
  updateTrack: (trackId: string, clips: TimelineClip[]) => void;
  addClipToTrack: (trackId: string, clip: TimelineClip) => void;
  removeClip: (clipId: string) => void;
  updateSubtitles: (subtitles: SubtitleEntry[]) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  currentProject: null,
  mediaLibrary: [],
  playheadPosition: 0,
  isPlaying: false,
  zoom: 1,
  selectedClip: null,
  timeDisplayMode: 'elapsed',
  
  setCurrentProject: (project) => set({ currentProject: project }),
  
  setMediaLibrary: (media) => set({ mediaLibrary: media }),
  
  addMedia: (media) => set((state) => ({
    mediaLibrary: [...state.mediaLibrary, media]
  })),
  
  setPlayheadPosition: (position) => set({ playheadPosition: position }),
  
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  
  setZoom: (zoom) => set({ zoom }),
  
  setSelectedClip: (clip) => set({ selectedClip: clip }),
  
  setTimeDisplayMode: (mode) => set({ timeDisplayMode: mode }),
  
  updateTrack: (trackId, clips) => set((state) => {
    if (!state.currentProject) return state;
    
    const updatedTracks = state.currentProject.tracks.map((track) =>
      track.id === trackId ? { ...track, clips } : track
    );
    
    return {
      currentProject: {
        ...state.currentProject,
        tracks: updatedTracks,
      },
    };
  }),
  
  addClipToTrack: (trackId, clip) => set((state) => {
    if (!state.currentProject) return state;
    
    const updatedTracks = state.currentProject.tracks.map((track) =>
      track.id === trackId
        ? { ...track, clips: [...track.clips, clip] }
        : track
    );
    
    return {
      currentProject: {
        ...state.currentProject,
        tracks: updatedTracks,
      },
    };
  }),
  
  removeClip: (clipId) => set((state) => {
    if (!state.currentProject) return state;
    
    const updatedTracks = state.currentProject.tracks.map((track) => ({
      ...track,
      clips: track.clips.filter((clip) => clip.id !== clipId),
    }));
    
    return {
      currentProject: {
        ...state.currentProject,
        tracks: updatedTracks,
      },
    };
  }),
  
  updateSubtitles: (subtitles) => set((state) => {
    if (!state.currentProject) return state;
    
    return {
      currentProject: {
        ...state.currentProject,
        subtitles,
      },
    };
  }),
}));
