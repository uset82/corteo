import axios from 'axios';
import type { MediaFile, Project, RenderStatus, SubtitleEntry } from '@/types';

const api = axios.create({
  baseURL: '/api',
});

export const mediaAPI = {
  upload: async (file: File): Promise<MediaFile> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<MediaFile>('/media/upload', formData);
    return response.data;
  },

  list: async (): Promise<MediaFile[]> => {
    const response = await api.get<MediaFile[]>('/media/list');
    return response.data;
  },

  delete: async (mediaId: string): Promise<void> => {
    await api.delete(`/media/${mediaId}`);
  },

  detectDuplicates: async (projectId: string): Promise<any> => {
    const response = await api.post('/media/detect-duplicates', null, {
      params: { project_id: projectId }
    });
    return response.data;
  },
};

export const projectsAPI = {
  create: async (name: string, width = 1920, height = 1080, fps = 30): Promise<Project> => {
    const response = await api.post<Project>('/projects/create', null, {
      params: { name, width, height, fps }
    });
    return response.data;
  },

  list: async (): Promise<Project[]> => {
    const response = await api.get<Project[]>('/projects/list');
    return response.data;
  },

  get: async (projectId: string): Promise<Project> => {
    const response = await api.get<Project>(`/projects/${projectId}`);
    return response.data;
  },

  update: async (projectId: string, project: Project): Promise<Project> => {
    const response = await api.put<Project>(`/projects/${projectId}`, project);
    return response.data;
  },

  delete: async (projectId: string): Promise<void> => {
    await api.delete(`/projects/${projectId}`);
  },
};

export const renderAPI = {
  start: async (
    projectId: string,
    resolution: '720p' | '1080p' | '4k' = '1080p',
    codec: 'h264' | 'hevc' = 'h264',
    quality: 'low' | 'medium' | 'high' = 'high'
  ): Promise<RenderStatus> => {
    const response = await api.post<RenderStatus>('/render/start', {
      project_id: projectId,
      resolution,
      codec,
      quality,
    });
    return response.data;
  },

  getStatus: async (renderId: string): Promise<RenderStatus> => {
    const response = await api.get<RenderStatus>(`/render/status/${renderId}`);
    return response.data;
  },

  list: async (): Promise<RenderStatus[]> => {
    const response = await api.get<RenderStatus[]>('/render/list');
    return response.data;
  },
};

export const transcriptionAPI = {
  transcribe: async (
    audioPath: string,
    lyrics?: string,
    isolateVocals = false,
    language = 'es'
  ): Promise<SubtitleEntry[]> => {
    const response = await api.post<SubtitleEntry[]>('/transcription/transcribe', {
      audio_path: audioPath,
      lyrics,
      isolate_vocals: isolateVocals,
      language,
    });
    return response.data;
  },

  importSrt: async (file: File): Promise<SubtitleEntry[]> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<SubtitleEntry[]>('/transcription/import-srt', formData);
    return response.data;
  },

  importAss: async (file: File): Promise<SubtitleEntry[]> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<SubtitleEntry[]>('/transcription/import-ass', formData);
    return response.data;
  },

  exportSrt: async (subtitles: SubtitleEntry[]): Promise<{ url: string; content: string }> => {
    const response = await api.post<{ url: string; content: string }>('/transcription/export-srt', subtitles);
    return response.data;
  },

  exportAss: async (subtitles: SubtitleEntry[]): Promise<{ url: string; content: string }> => {
    const response = await api.post<{ url: string; content: string }>('/transcription/export-ass', subtitles);
    return response.data;
  },
};
