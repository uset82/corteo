// "Comparar versiones": a 2x2 grid of the group's 480p previews. The previews
// are the same server renders the agent tool starts, one clock drives every
// player, and "Elegir esta versión" writes the pick through the document.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EditorCommands } from '../../editor/store';
import type { ProjectDoc, Timeline, VariantStatus } from '../../editor/types';
import { variantMembers } from '../../editor/variants';
import { cancelRenderJob, readRenderJobSnapshot } from '../../export/renderJobClient';
import { submitVariantPreviewJob } from '../../export/variantPreviews';
import { useT } from '../../i18n/locale';
import {
  compareMembers, formatCompareSeconds, needsSync, seekTarget, variantStatusLabelKey,
} from './variantCompare';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export type ComparePreviewState =
  | { phase: 'rendering'; progress: number }
  | { phase: 'ready'; url: string }
  | { phase: 'failed'; error: string };

export interface CompareCellModel {
  timelineId: string;
  name: string;
  label: string;
  note?: string;
  status: VariantStatus;
  preview: ComparePreviewState;
}

interface CompareVersionsViewProps {
  cells: readonly CompareCellModel[];
  totalMembers: number;
  playing: boolean;
  timeSeconds: number;
  durationSeconds: number;
  translate: Translate;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onChoose: (timelineId: string) => void;
  onRetry: (timelineId: string) => void;
  onClose: () => void;
  onVideoElement?: (timelineId: string, element: HTMLVideoElement | null) => void;
  onVideoLoaded?: () => void;
}

function CompareCell({ cell, translate, onChoose, onRetry, onVideoElement, onVideoLoaded }: {
  cell: CompareCellModel;
  translate: Translate;
  onChoose: (timelineId: string) => void;
  onRetry: (timelineId: string) => void;
  onVideoElement?: (timelineId: string, element: HTMLVideoElement | null) => void;
  onVideoLoaded?: () => void;
}) {
  const chosen = cell.status === 'chosen';
  return (
    <div className="cc-compare-cell" data-timeline={cell.timelineId} data-status={cell.status}>
      <div className="cc-compare-cell-head">
        <span className="cc-compare-label">{cell.label}</span>
        <span className="cc-compare-name" title={cell.name}>{cell.name}</span>
        <span className="cc-compare-status">{translate(variantStatusLabelKey(cell.status))}</span>
      </div>
      <div className="cc-compare-screen">
        {cell.preview.phase === 'ready' ? (
          <video
            ref={(element) => onVideoElement?.(cell.timelineId, element)}
            src={cell.preview.url}
            muted
            playsInline
            preload="metadata"
            aria-label={translate('版本 {label}', { label: cell.label })}
            onLoadedMetadata={() => onVideoLoaded?.()}
          />
        ) : cell.preview.phase === 'rendering' ? (
          <div className="cc-compare-progress">
            <span>{translate('正在渲染预览…')}</span>
            <span className="cc-compare-percent">{Math.round(cell.preview.progress)}%</span>
          </div>
        ) : (
          <div className="cc-compare-failed">
            <span>{translate('预览渲染失败')}</span>
            <span className="cc-compare-error">{cell.preview.error}</span>
            <button type="button" onClick={() => onRetry(cell.timelineId)}>{translate('重试')}</button>
          </div>
        )}
      </div>
      {cell.note && <p className="cc-compare-note" title={cell.note}>{cell.note}</p>}
      <button
        type="button"
        className={chosen ? 'primary' : undefined}
        disabled={chosen}
        onClick={() => onChoose(cell.timelineId)}
      >{chosen ? translate('已选用') : translate('选用此版本')}</button>
    </div>
  );
}

export function CompareVersionsView({
  cells, totalMembers, playing, timeSeconds, durationSeconds, translate,
  onTogglePlay, onSeek, onChoose, onRetry, onClose, onVideoElement, onVideoLoaded,
}: CompareVersionsViewProps) {
  const anyReady = cells.some((cell) => cell.preview.phase === 'ready');
  const rangeMax = Math.max(durationSeconds, 0.1);
  return (
    <div className="cc-modal-backdrop" role="dialog" aria-modal="true" aria-label={translate('比较版本')} onClick={onClose}>
      <div className="cc-modal cc-compare-dialog" onClick={(event) => event.stopPropagation()}>
        <header className="cc-compare-head">
          <strong>{translate('比较版本')}</strong>
          <button type="button" aria-label={translate('关闭')} onClick={onClose}>×</button>
        </header>
        {cells.length === 0 ? (
          <p className="cc-compare-empty">{translate('没有可比较的版本')}</p>
        ) : (
          <section className="cc-compare-grid">
            {cells.map((cell) => (
              <CompareCell
                key={cell.timelineId}
                cell={cell}
                translate={translate}
                onChoose={onChoose}
                onRetry={onRetry}
                onVideoElement={onVideoElement}
                onVideoLoaded={onVideoLoaded}
              />
            ))}
          </section>
        )}
        {totalMembers > cells.length && <p className="cc-compare-hint">{translate('只显示前 4 个版本')}</p>}
        <footer className="cc-compare-controls">
          <button type="button" disabled={!anyReady} onClick={onTogglePlay}>
            {playing ? translate('暂停所有') : translate('一起播放')}
          </button>
          <input
            type="range"
            min={0}
            max={rangeMax}
            step={0.05}
            value={Math.min(timeSeconds, rangeMax)}
            disabled={!anyReady}
            aria-label={translate('播放进度')}
            onChange={(event) => onSeek(Number(event.target.value))}
          />
          <span className="cc-compare-time">{formatCompareSeconds(timeSeconds)} / {formatCompareSeconds(durationSeconds)}</span>
          <button type="button" onClick={onClose}>{translate('关闭')}</button>
        </footer>
      </div>
    </div>
  );
}

export interface CompareVersionsDialogProps {
  doc: ProjectDoc;
  groupId: string;
  commands: Pick<EditorCommands, 'chooseVariant'>;
  onClose: () => void;
}

type PreviewMap = Record<string, ComparePreviewState>;

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function CompareVersionsDialog({ doc, groupId, commands, onClose }: CompareVersionsDialogProps) {
  const t = useT();
  const [previews, setPreviews] = useState<PreviewMap>({});
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const docRef = useRef(doc);
  docRef.current = doc;
  const alive = useRef(true);
  const attempts = useRef(new Map<string, number>());
  const jobs = useRef(new Map<string, string>());
  const finished = useRef(new Set<string>());

  const startPreview = useCallback(async (member: Timeline) => {
    const token = (attempts.current.get(member.id) ?? 0) + 1;
    attempts.current.set(member.id, token);
    const current = () => alive.current && attempts.current.get(member.id) === token;
    const previous = jobs.current.get(member.id);
    if (previous && !finished.current.has(member.id)) void cancelRenderJob(previous).catch(() => undefined);
    finished.current.delete(member.id);
    setPreviews((state) => ({ ...state, [member.id]: { phase: 'rendering', progress: 0 } }));
    try {
      const job = await submitVariantPreviewJob(docRef.current, member);
      jobs.current.set(member.id, job.renderId);
      if (!current()) { void cancelRenderJob(job.renderId).catch(() => undefined); return; }
      for (;;) {
        const snapshot = await readRenderJobSnapshot(job.renderId);
        if (!current()) return;
        if (snapshot.status === 'succeeded' && snapshot.result?.path) {
          finished.current.add(member.id);
          const url = snapshot.result.path;
          setPreviews((state) => ({ ...state, [member.id]: { phase: 'ready', url } }));
          return;
        }
        if (snapshot.status === 'failed') {
          throw new Error(snapshot.failure?.message ?? snapshot.error ?? t('预览渲染失败'));
        }
        setPreviews((state) => ({ ...state, [member.id]: { phase: 'rendering', progress: snapshot.progress } }));
        await sleep(800);
      }
    } catch (error) {
      if (current()) {
        setPreviews((state) => ({
          ...state,
          [member.id]: { phase: 'failed', error: error instanceof Error ? error.message : String(error) },
        }));
      }
    }
  }, [t]);

  const startRef = useRef(startPreview);
  startRef.current = startPreview;

  useEffect(() => {
    alive.current = true;
    for (const member of variantMembers(docRef.current, groupId)) void startRef.current(member);
    return () => {
      alive.current = false;
      for (const [timelineId, renderId] of jobs.current) {
        if (!finished.current.has(timelineId)) void cancelRenderJob(renderId).catch(() => undefined);
      }
    };
  }, [groupId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const members = variantMembers(doc, groupId);
  const cells: CompareCellModel[] = compareMembers(members).map((member) => ({
    timelineId: member.id,
    name: member.name,
    label: member.variant?.label ?? member.name,
    note: member.variant?.note,
    status: member.variant?.status ?? 'candidate',
    preview: previews[member.id] ?? { phase: 'rendering', progress: 0 },
  }));
  const masterId = cells.find((cell) => cell.preview.phase === 'ready')?.timelineId;

  const registerVideo = useCallback((timelineId: string, element: HTMLVideoElement | null) => {
    if (element) videos.current.set(timelineId, element);
    else videos.current.delete(timelineId);
  }, []);

  const onVideoLoaded = useCallback(() => {
    let longest = 0;
    for (const video of videos.current.values()) {
      if (Number.isFinite(video.duration)) longest = Math.max(longest, video.duration);
    }
    setDuration(longest);
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) {
      for (const video of videos.current.values()) video.pause();
      setPlaying(false);
      return;
    }
    const master = masterId ? videos.current.get(masterId) : [...videos.current.values()][0];
    if (!master) return;
    const ended = Number.isFinite(master.duration) && master.currentTime >= master.duration - 0.05;
    const start = ended ? 0 : master.currentTime;
    for (const [timelineId, video] of videos.current) {
      video.currentTime = timelineId === masterId ? start : seekTarget(start, video.duration);
      void video.play().catch(() => undefined);
    }
    setTime(start);
    setPlaying(true);
  }, [playing, masterId]);

  const seek = useCallback((seconds: number) => {
    setTime(seconds);
    for (const video of videos.current.values()) video.currentTime = seekTarget(seconds, video.duration);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const master = masterId ? videos.current.get(masterId) : undefined;
      if (!master) return;
      const now = master.currentTime;
      setTime(now);
      for (const [timelineId, video] of videos.current) {
        if (timelineId === masterId) continue;
        if (needsSync(now, video.currentTime)) video.currentTime = seekTarget(now, video.duration);
        if (video.paused) void video.play().catch(() => undefined);
      }
      if (master.ended) {
        setPlaying(false);
        for (const video of videos.current.values()) video.pause();
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [playing, masterId]);

  const choose = useCallback((timelineId: string) => {
    commands.chooseVariant(groupId, timelineId);
  }, [commands, groupId]);

  const retry = useCallback((timelineId: string) => {
    const member = docRef.current.timelines.find((timeline) => timeline.id === timelineId);
    if (member) void startPreview(member);
  }, [startPreview]);

  return createPortal(
    <CompareVersionsView
      cells={cells}
      totalMembers={members.length}
      playing={playing}
      timeSeconds={time}
      durationSeconds={duration}
      translate={t}
      onTogglePlay={togglePlay}
      onSeek={seek}
      onChoose={choose}
      onRetry={retry}
      onClose={onClose}
      onVideoElement={registerVideo}
      onVideoLoaded={onVideoLoaded}
    />,
    document.body,
  );
}
