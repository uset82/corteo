import React, { useCallback, useRef } from 'react';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { mediaAPI } from '@/utils/api';
import { useEditorStore } from '@/hooks/useEditorStore';
import './MediaLibrary.css';

export const MediaLibrary: React.FC = () => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mediaLibrary, addMedia } = useEditorStore();
  const [uploading, setUploading] = React.useState(false);
  
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;
    
    setUploading(true);
    
    for (let i = 0; i < files.length; i++) {
      try {
        const media = await mediaAPI.upload(files[i]);
        addMedia(media);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }
    
    setUploading(false);
  }, [addMedia]);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);
  
  return (
    <div className="media-library">
      <div className="media-library-header">
        <h3>{t('menu.library')}</h3>
        <button
          className="btn-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload size={16} />
          {uploading ? t('media.uploading') : t('menu.upload')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*,audio/*,image/*"
          style={{ display: 'none' }}
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>
      
      <div
        className="media-drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {mediaLibrary.length === 0 && !uploading && (
          <div className="media-drop-placeholder">
            <Upload size={48} />
            <p>{t('media.dragDrop')}</p>
          </div>
        )}
        
        <div className="media-grid">
          {mediaLibrary.map((media) => (
            <MediaItem key={media.id} media={media} />
          ))}
        </div>
      </div>
    </div>
  );
};

const MediaItem: React.FC<{ media: MediaFile }> = ({ media }) => {
  const { t } = useTranslation();
  
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(media));
    e.dataTransfer.effectAllowed = 'copy';
  };
  
  return (
    <div
      className="media-item"
      draggable
      onDragStart={handleDragStart}
    >
      {media.type === 'video' && media.thumbnail && (
        <img src={media.thumbnail} alt={media.filename} />
      )}
      {media.type === 'image' && (
        <img src={media.url} alt={media.filename} />
      )}
      {media.type === 'audio' && (
        <div className="media-audio-icon">🎵</div>
      )}
      
      <div className="media-info">
        <div className="media-name">{media.filename}</div>
        <div className="media-type">{t(`media.${media.type}`)}</div>
        {media.duration && (
          <div className="media-duration">
            {Math.floor(media.duration)}s
          </div>
        )}
      </div>
    </div>
  );
};
