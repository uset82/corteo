import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  es: {
    translation: {
      app: {
        title: 'Editor de Video',
      },
      menu: {
        file: 'Archivo',
        new: 'Nuevo Proyecto',
        open: 'Abrir Proyecto',
        save: 'Guardar',
        export: 'Exportar Video',
        media: 'Medios',
        upload: 'Subir Medios',
        library: 'Biblioteca',
      },
      timeline: {
        video: 'Video',
        audio: 'Audio',
        subtitles: 'Subtítulos',
        zoom: 'Zoom',
        snap: 'Ajustar',
      },
      preview: {
        play: 'Reproducir',
        pause: 'Pausar',
        stop: 'Detener',
        elapsed: 'Transcurrido',
        remaining: 'Restante',
      },
      media: {
        dragDrop: 'Arrastra archivos aquí o haz clic para seleccionar',
        uploading: 'Subiendo...',
        video: 'Video',
        audio: 'Audio',
        image: 'Imagen',
      },
      subtitles: {
        add: 'Agregar Subtítulo',
        import: 'Importar SRT/ASS',
        export: 'Exportar',
        transcribe: 'Transcribir Audio',
        style: 'Estilo',
        text: 'Texto',
        start: 'Inicio',
        end: 'Fin',
      },
      render: {
        title: 'Renderizar Video',
        resolution: 'Resolución',
        codec: 'Códec',
        quality: 'Calidad',
        start: 'Iniciar Render',
        progress: 'Progreso',
        status: {
          queued: 'En cola',
          processing: 'Procesando',
          completed: 'Completado',
          failed: 'Fallido',
        },
      },
      common: {
        cancel: 'Cancelar',
        ok: 'Aceptar',
        delete: 'Eliminar',
        duplicate: 'Duplicar',
        split: 'Dividir',
        trim: 'Recortar',
        loading: 'Cargando...',
        error: 'Error',
        success: 'Éxito',
      },
    },
  },
  en: {
    translation: {
      app: {
        title: 'Video Editor',
      },
      menu: {
        file: 'File',
        new: 'New Project',
        open: 'Open Project',
        save: 'Save',
        export: 'Export Video',
        media: 'Media',
        upload: 'Upload Media',
        library: 'Library',
      },
      timeline: {
        video: 'Video',
        audio: 'Audio',
        subtitles: 'Subtitles',
        zoom: 'Zoom',
        snap: 'Snap',
      },
      preview: {
        play: 'Play',
        pause: 'Pause',
        stop: 'Stop',
        elapsed: 'Elapsed',
        remaining: 'Remaining',
      },
      media: {
        dragDrop: 'Drag files here or click to select',
        uploading: 'Uploading...',
        video: 'Video',
        audio: 'Audio',
        image: 'Image',
      },
      subtitles: {
        add: 'Add Subtitle',
        import: 'Import SRT/ASS',
        export: 'Export',
        transcribe: 'Transcribe Audio',
        style: 'Style',
        text: 'Text',
        start: 'Start',
        end: 'End',
      },
      render: {
        title: 'Render Video',
        resolution: 'Resolution',
        codec: 'Codec',
        quality: 'Quality',
        start: 'Start Render',
        progress: 'Progress',
        status: {
          queued: 'Queued',
          processing: 'Processing',
          completed: 'Completed',
          failed: 'Failed',
        },
      },
      common: {
        cancel: 'Cancel',
        ok: 'OK',
        delete: 'Delete',
        duplicate: 'Duplicate',
        split: 'Split',
        trim: 'Trim',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
      },
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'es',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
