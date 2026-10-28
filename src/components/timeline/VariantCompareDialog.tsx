// P4-3: a 2×2 grid of synced 480p previews with each version's note.
// "Elegir esta versión" calls the existing chooseVariant command (one undo step)
// and that command fires variant.chosen.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ProjectDoc } from '../../editor/types';
import type { EditorCommands } from '../../editor/store';
import { useT } from '../../i18n/locale';

interface VariantCompareDialogProps {
  doc: ProjectDoc;
  commands: EditorCommands;
  groupId: string;
  onClose: () => void;
}

interface Preview {
  timelineId: string;
  name: string;
  label: string;
  note: string;
  status: string;
  active: boolean;
  url: string;
  durationInFrames: number;
  fps: number;
}

interface Manifest {
  ok: true;
  groupId: string;
  previews: Preview[];
}

type LoadState = 'loading' | 'ready' | 'missing' | 'rendering' | 'error';

export function VariantCompareDialog({ doc, commands, groupId, onClose }: VariantCompareDialogProps) {
  const t = useT();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const videos = useRef<Array<HTMLVideoElement | null>>([]);

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    void fetch(`/api/variant-previews?groupId=${encodeURIComponent(groupId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) { setState('missing'); return null; }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json() as Manifest;
      })
      .then((body) => {
        if (!body) return;
        setManifest(body);
        setState('ready');
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setState('error');
      });
    return () => controller.abort();
  }, [groupId]);

  const previews = manifest?.previews ?? [];
  const duration = useMemo(() => {
    const preview = previews[0];
    return preview ? preview.durationInFrames / preview.fps : 0;
  }, [previews]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const leader = videos.current[0];
      if (!leader) return;
      setTime(leader.currentTime);
      for (const video of videos.current.slice(1)) {
        if (video && Math.abs(video.currentTime - leader.currentTime) > 0.2) video.currentTime = leader.currentTime;
      }
      if (leader.ended) {
        for (const video of videos.current) video?.pause();
        setPlaying(false);
      }
    }, 180);
    return () => clearInterval(timer);
  }, [playing]);

  const render = async () => {
    setState('rendering');
    setError('');
    try {
      const response = await fetch('/api/variant-previews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: doc, groupId }),
      });
      const body = await response.json().catch(() => null) as Manifest | { error?: string } | null;
      if (!response.ok || !body || !('ok' in body)) throw new Error(body && 'error' in body ? body.error : `HTTP ${response.status}`);
      setManifest(body);
      setState('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setState('error');
    }
  };

  const playAll = () => {
    const target = videos.current[0]?.currentTime ?? 0;
    for (const video of videos.current) {
      if (!video) continue;
      if (Math.abs(video.currentTime - target) > 0.1) video.currentTime = target;
      void video.play().catch(() => undefined);
    }
    setPlaying(true);
  };

  const pauseAll = () => {
    for (const video of videos.current) video?.pause();
    setPlaying(false);
  };

  const seekAll = (next: number) => {
    setTime(next);
    for (const video of videos.current) if (video) video.currentTime = next;
  };

  const choose = (preview: Preview) => {
    const result = commands.chooseVariant(preview.timelineId);
    if (result.ok) onClose();
  };

  return createPortal(
    <div className="cc-modal-backdrop" role="dialog" aria-modal="true" aria-label={t('Comparar versiones')} onClick={onClose}>
      <div className="cc-modal cc-variant-compare-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="cc-variant-compare-head">
          <strong>{t('Comparar versiones')}</strong>
          <span>{previews.length > 0 ? `${previews.length}` : ''}</span>
          <button type="button" aria-label={t('Cerrar')} onClick={onClose}>×</button>
        </div>
        {state === 'loading' && <p className="cc-variant-compare-note">{t('Cargando previas…')}</p>}
        {state === 'rendering' && <p className="cc-variant-compare-note">{t('Generando previas…')}</p>}
        {state === 'missing' && (
          <div className="cc-variant-compare-empty">
            <p className="cc-variant-compare-note">{t('No hay previas todavía.')}</p>
            <button type="button" className="primary" onClick={() => void render()}>{t('Generar previas')}</button>
          </div>
        )}
        {state === 'error' && (
          <div className="cc-variant-compare-empty">
            <p className="cc-variant-compare-error">{t('No se pudieron cargar las previas: {error}', { error })}</p>
            <button type="button" onClick={() => void render()}>{t('Reintentar')}</button>
          </div>
        )}
        {state === 'ready' && previews.length > 0 && (
          <>
            <div className="cc-variant-compare-grid" data-count={previews.length}>
              {previews.map((preview, index) => (
                <section className={`cc-variant-compare-card${preview.status === 'elegida' ? ' chosen' : ''}`} key={preview.timelineId}>
                  <video
                    ref={(node) => { videos.current[index] = node; }}
                    src={preview.url}
                    muted
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={() => { if (index === 0) setTime(0); }}
                  />
                  <div className="cc-variant-compare-meta">
                    <strong>{preview.label || preview.name}</strong>
                    {preview.note && <span>{preview.note}</span>}
                    <span>{preview.status === 'elegida' ? t('Elegida') : preview.status === 'descartada' ? t('Descartada') : t('Borrador')}</span>
                  </div>
                  <button type="button" disabled={preview.active && preview.status === 'elegida'} onClick={() => choose(preview)}>
                    {preview.status === 'elegida' ? t('Versión elegida') : t('Elegir esta versión')}
                  </button>
                </section>
              ))}
            </div>
            <div className="cc-variant-compare-transport">
              <button type="button" onClick={playing ? pauseAll : playAll}>{playing ? t('Pausar') : t('Reproducir')}</button>
              <input
                type="range"
                min={0}
                max={Math.max(0.01, duration)}
                step={0.05}
                value={Math.min(time, duration)}
                aria-label={t('Posición de las previas')}
                onChange={(event) => seekAll(Number(event.target.value))}
              />
              <span>{time.toFixed(1)} s</span>
              <button type="button" onClick={() => void render()}>{t('Regenerar previas')}</button>
            </div>
          </>
        )}
        <div className="cc-variant-compare-actions">
          <button type="button" onClick={onClose}>{t('Cerrar')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
