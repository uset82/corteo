import { useEffect, useRef, useState, type RefObject } from 'react';
import type { PlayerRef } from '@remotion/player';
import type { MediaAsset, TimelineItem, TrackId } from '../editor/types';
import { useT } from '../i18n/locale';
import { trackTitle, type TranscriptTrackOption } from '../transcript/trackOptions';
import { msToFrame } from '../transcript/types';
import { CaptionsControls } from './CaptionsControls';
import { newManualCaptions } from './manualCaptions';
import { subtitleTrackName, withSubtitleLane } from './subtitleImport';
import { parseSubtitles } from './subtitles';
import { buildTranslation } from './translate';
import type { CaptionsData } from './types';

interface Props {
  playerRef: RefObject<PlayerRef | null>;
  fps: number;
  items: TimelineItem[];
  /** media-pool assets, for `latido`'s song analysis lookup */
  assets?: MediaAsset[];
  captionTracks: Array<TranscriptTrackOption & { captions: CaptionsData | null }>;
  onSetCaptions: (captions: CaptionsData | null, track?: TrackId) => void;
  onUpdateCaptions: (patch: Partial<CaptionsData>, track?: TrackId) => void;
  /** A subtitle file with no caption track to land on gets a track of its own. */
  onCreateCaptionTrack: (captions: CaptionsData, opts?: { name?: string; order?: number }) => TrackId;
}

export function CaptionsPanel(props: Props) {
  const { playerRef, fps, items, assets = [], captionTracks, onSetCaptions, onUpdateCaptions, onCreateCaptionTrack } = props;
  const t = useT();
  const [captionTrack, setCaptionTrack] = useState<TrackId | null>(captionTracks[0]?.id ?? null);
  const fileInput = useRef<HTMLInputElement>(null);
  const captions = captionTracks.find((option) => option.id === captionTrack)?.captions ?? null;
  useEffect(() => {
    if (!captionTrack || !captionTracks.some((option) => option.id === captionTrack)) setCaptionTrack(captionTracks[0]?.id ?? null);
  }, [captionTrack, captionTracks]);
  const update = (patch: Partial<CaptionsData>) => onUpdateCaptions(patch, captionTrack ?? undefined);
  const set = (next: CaptionsData | null) => onSetCaptions(next, captionTrack ?? undefined);
  const translation = useCaptionTranslation(captions, items, fps, update);
  // SRT, ASS and VTT: the parser is chosen from the extension, and the file adds
  // a lane to the selected caption track (or brings its own track when there is none).
  const importSubtitles = async (file: File) => {
    try {
      const words = parseSubtitles(file.name, await file.text());
      const plan = withSubtitleLane(captions, items, file.name, words);
      if (captionTrack) set(plan.captions);
      else onCreateCaptionTrack(plan.captions, { name: subtitleTrackName(file.name) });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      window.alert(`${t('字幕导入失败')}：${t(detail)}`);
    }
  };
  return (
    <div className="cc-captions-workspace">
      <div className="cc-captions-context">
        <CaptionTrackBar options={captionTracks} track={captionTrack} onChange={setCaptionTrack} />
        <button type="button" className="cc-cap-btn sm" onClick={() => fileInput.current?.click()}>
          {t('导入字幕（SRT/ASS/VTT）')}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".srt,.ass,.ssa,.vtt"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void importSubtitles(file);
          }}
        />
      </div>
      <CaptionsControls captionTrackId={captionTrack ?? undefined} captions={captions} assets={assets} sourceVariants={(captions?.sourceItemId ? items.find((item) => item.id === captions.sourceItemId)?.variants : undefined) ?? []} items={items} fps={fps} onSeekMs={(ms) => playerRef.current?.seekTo(msToFrame(ms, fps))} onCreateManual={() => set(newManualCaptions())} getPlayheadMs={() => ((playerRef.current?.getCurrentFrame() ?? 0) / fps) * 1000} onUpdate={update} onRemove={() => set(null)} onTranslate={translation.run} translating={translation.running} translateError={translation.error} />
    </div>
  );
}

function CaptionTrackBar({ options, track, onChange }: { options: Props['captionTracks']; track: TrackId | null; onChange: (track: TrackId) => void }) {
  const t = useT();
  return (
    <div className="cc-captions-sourcebar">
      <label htmlFor="cc-caption-track">{t('字幕轨道')}</label>
      <select id="cc-caption-track" className="cc-cap-select" value={track ?? ''} disabled={!options.length} onChange={(event) => onChange(event.target.value)}>
        {!options.length && <option value="">{t('请先新建字幕轨道')}</option>}
        {options.map((option) => <option key={option.id} value={option.id}>{trackTitle(option)}</option>)}
      </select>
    </div>
  );
}

function useCaptionTranslation(captions: CaptionsData | null, items: TimelineItem[], fps: number, onUpdate: (patch: Partial<CaptionsData>) => void) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (lang: string) => {
    if (!captions || running) return;
    setRunning(true);
    setError(null);
    try {
      const { cues, fingerprint } = await buildTranslation(captions, items, fps, lang);
      onUpdate({
        bilingual: true, translationLang: lang, translation: cues,
        translationFingerprint: fingerprint,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRunning(false);
    }
  };
  return { running, error, run };
}
