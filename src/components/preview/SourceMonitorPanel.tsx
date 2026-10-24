// Premiere-style Source Monitor docked above the Program Monitor: scrub a pool
// asset, mark in/out and insert only that source range into the timeline.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { EditorCommands } from '../../editor/store';
import { useT } from '../../i18n/locale';
import { theme } from '../../theme';
import { Icon } from '../icons';
import { formatTimecode } from '../timeline/CountdownToggle';
import {
  clampSourceFrame,
  normalizeSourceRange,
  sourceFrameFromSeconds,
  sourceTotalFrames,
} from '../../media/sourceMonitor';
import { closeSourceMonitor, useSourceMonitorAsset } from '../../media/sourceMonitorStore';

export interface SourceMonitorPanelProps {
  fps: number;
  commands: EditorCommands;
}

const buttonStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, height: 24, padding: '0 8px',
  border: `0.5px solid ${theme.border}`, borderRadius: 4, background: 'transparent',
  color: theme.text, fontSize: 11, cursor: 'pointer', flexShrink: 0,
};

export function SourceMonitorPanel({ fps, commands }: SourceMonitorPanelProps) {
  const t = useT();
  const asset = useSourceMonitorAsset();
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [inFrame, setInFrame] = useState(0);
  const [outFrame, setOutFrame] = useState(1);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mediaFrames, setMediaFrames] = useState(0);
  const [justInserted, setJustInserted] = useState(false);

  const isAudio = asset?.kind === 'audio';
  const isStill = asset?.kind === 'image' || asset?.kind === 'svg';
  const baseTotal = asset ? sourceTotalFrames(asset.durationInFrames, fps, asset.kind) : 1;
  const total = asset && asset.durationInFrames > 0 ? baseTotal : Math.max(1, mediaFrames || baseTotal);

  const setMedia = (node: HTMLVideoElement | HTMLAudioElement | null) => {
    mediaRef.current = node;
  };

  // New asset → fresh source range and reset transport.
  useEffect(() => {
    setInFrame(0);
    setOutFrame(total);
    setFrame(0);
    setPlaying(false);
    setMediaFrames(0);
    setJustInserted(false);
    mediaRef.current?.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the asset identity changes
  }, [asset?.id]);

  useEffect(() => {
    if (!justInserted) return;
    const timer = window.setTimeout(() => setJustInserted(false), 1400);
    return () => window.clearTimeout(timer);
  }, [justInserted]);

  useEffect(() => {
    if (!asset) return;
    rootRef.current?.focus({ preventScroll: true });
  }, [asset?.id]);

  const seek = useCallback((next: number) => {
    const clamped = clampSourceFrame(next, total);
    setFrame(clamped);
    const media = mediaRef.current;
    if (media && !isStill && media.readyState >= 1) {
      const time = clamped / Math.max(1, fps);
      if (Number.isFinite(time) && Math.abs(media.currentTime - time) > 1e-4) media.currentTime = time;
    }
  }, [total, isStill, fps]);

  const togglePlayback = useCallback(() => {
    if (!asset || isStill) return;
    const media = mediaRef.current;
    if (!media) return;
    if (playing) {
      media.pause();
      setPlaying(false);
      return;
    }
    const startAt = frame >= outFrame - 1 ? inFrame : frame;
    if (startAt !== frame) seek(startAt);
    const time = startAt / Math.max(1, fps);
    if (media.readyState >= 1 && Number.isFinite(time)) media.currentTime = time;
    setPlaying(true);
    void media.play().catch(() => setPlaying(false));
  }, [asset, isStill, playing, frame, inFrame, outFrame, seek, fps]);

  // Drive the frame counter from the media clock while playing.
  useEffect(() => {
    if (!playing || isStill) return;
    const media = mediaRef.current;
    if (!media) return;
    let raf = 0;
    const tick = () => {
      const next = Math.round(media.currentTime * Math.max(1, fps));
      if (next >= outFrame) {
        media.pause();
        const last = Math.max(inFrame, outFrame - 1);
        media.currentTime = last / Math.max(1, fps);
        setFrame(last);
        setPlaying(false);
        return;
      }
      setFrame(clampSourceFrame(next, total));
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [playing, isStill, fps, inFrame, outFrame, total]);

  const markIn = useCallback(() => {
    const nextIn = Math.max(0, Math.min(frame, total - 1));
    setInFrame(nextIn);
    setOutFrame((currentOut) => Math.max(nextIn + 1, Math.min(currentOut, total)));
  }, [total, frame]);

  const markOut = useCallback(() => {
    setOutFrame(Math.max(inFrame + 1, Math.min(total, frame + 1)));
  }, [inFrame, total, frame]);

  const insert = useCallback(() => {
    if (!asset) return;
    const range = normalizeSourceRange(total, inFrame, outFrame);
    const itemId = commands.addMediaItem(asset, { srcInFrame: range.inFrame });
    const duration = range.outFrame - range.inFrame;
    if (itemId && duration > 0) commands.setItemTiming(itemId, { durationInFrames: duration });
    setJustInserted(true);
  }, [asset, total, inFrame, outFrame, commands]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!asset) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    if (event.key === ' ' || event.key === 'k' || event.key === 'K') {
      event.preventDefault();
      togglePlayback();
    } else if (event.key === 'i' || event.key === 'I') {
      event.preventDefault();
      markIn();
    } else if (event.key === 'o' || event.key === 'O') {
      event.preventDefault();
      markOut();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      seek(frame - (event.shiftKey ? 10 : 1));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      seek(frame + (event.shiftKey ? 10 : 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      seek(inFrame);
    } else if (event.key === 'End') {
      event.preventDefault();
      seek(outFrame - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeSourceMonitor();
    }
  };

  if (!asset) return null;

  const onLoadedMetadata = () => {
    const media = mediaRef.current;
    if (!media || !Number.isFinite(media.duration) || media.duration <= 0) return;
    const frames = Math.max(1, Math.round(media.duration * Math.max(1, fps)));
    if (asset.durationInFrames <= 0) {
      setMediaFrames(frames);
      setOutFrame(frames);
    }
    seek(sourceFrameFromSeconds(media.currentTime, fps, frames));
  };

  const range = normalizeSourceRange(total, inFrame, outFrame);
  const timelineDuration = range.outFrame - range.inFrame;
  const timecode = (value: number) => formatTimecode(value, total, fps, 'elapsed');

  return (
    <div
      ref={rootRef}
      className="cc-source-monitor"
      tabIndex={-1}
      role="region"
      aria-label={t('源监视器')}
      onKeyDown={onKeyDown}
    >
      <div className="cc-source-monitor-header">
        <span className="cc-source-monitor-title">{t('源监视器')}</span>
        <span className="cc-source-monitor-name" title={asset.name}>{asset.name}</span>
        {asset.width && asset.height ? <span className="cc-source-monitor-meta">{asset.width}×{asset.height}</span> : null}
        <button type="button" className="cc-source-monitor-icon" aria-label={t('关闭源监视器')} title={t('关闭源监视器')} onClick={closeSourceMonitor}>
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="cc-source-monitor-stage">
        {isAudio ? (
          <>
            <audio ref={setMedia} src={asset.src} preload="auto" onLoadedMetadata={onLoadedMetadata} onEnded={() => setPlaying(false)} />
            <div className="cc-source-monitor-audio">
              <Icon name="mic" size={26} />
              <span>{t('音频源')}</span>
            </div>
          </>
        ) : isStill ? (
          <img className="cc-source-monitor-image" src={asset.src} alt={asset.name} draggable={false} />
        ) : (
          <video
            key={asset.id}
            ref={setMedia}
            className="cc-source-monitor-video"
            src={asset.src}
            preload="auto"
            playsInline
            onLoadedMetadata={onLoadedMetadata}
            onEnded={() => setPlaying(false)}
            onPause={() => setPlaying(false)}
          />
        )}
      </div>

      <div className="cc-source-monitor-transport">
        <button
          type="button"
          className="cc-source-monitor-icon"
          aria-label={playing ? t('暂停') : t('播放')}
          title={playing ? t('暂停') : t('播放')}
          onClick={togglePlayback}
          disabled={isStill}
        >
          <Icon name={playing ? 'pause' : 'play'} size={15} />
        </button>
        <button type="button" className="cc-source-monitor-icon" aria-label={t('上一帧')} title={t('上一帧')} onClick={() => seek(frame - 1)}>
          <Icon name="prev" size={14} />
        </button>
        <button type="button" className="cc-source-monitor-icon" aria-label={t('下一帧')} title={t('下一帧')} onClick={() => seek(frame + 1)}>
          <Icon name="next" size={14} />
        </button>
        <span className="cc-source-monitor-time">{timecode(frame)}</span>
        <input
          className="cc-source-monitor-scrub"
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          step={1}
          value={frame}
          aria-label={t('浏览源素材')}
          onChange={(event) => {
            if (playing) {
              mediaRef.current?.pause();
              setPlaying(false);
            }
            seek(Number(event.target.value));
          }}
        />
        <span className="cc-source-monitor-time cc-source-monitor-total">{timecode(total)}</span>
        <button
          type="button"
          className="cc-source-monitor-insert"
          onClick={insert}
          title={t('插入所选范围')}
        >
          <Icon name="insert" size={13} />
          <span>{justInserted ? t('已插入') : t('插入时间线')}</span>
          <span className="cc-source-monitor-insert-duration">{timecode(timelineDuration)}</span>
        </button>
      </div>

      <div className="cc-source-monitor-range">
        <button type="button" style={buttonStyle} onClick={markIn} title={t('在播放头设置入点 (I)')}>
          {t('入点')} <span className="cc-source-monitor-range-value">{timecode(range.inFrame)}</span>
        </button>
        <button type="button" style={buttonStyle} onClick={markOut} title={t('在播放头设置出点 (O)')}>
          {t('出点')} <span className="cc-source-monitor-range-value">{timecode(range.outFrame)}</span>
        </button>
        <button
          type="button"
          style={{ ...buttonStyle, color: theme.textDim }}
          onClick={() => { setInFrame(0); setOutFrame(total); }}
        >
          {t('重置')}
        </button>
        <span className="cc-source-monitor-hint">{t('空格播放 · I/O 设入出点 · 方向键逐帧')}</span>
        <span className="cc-source-monitor-hint cc-source-monitor-range-duration">
          {t('范围 {value}', { value: timecode(timelineDuration) })}
        </span>
      </div>
    </div>
  );
}
