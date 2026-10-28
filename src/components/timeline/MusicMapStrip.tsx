import { useEffect, useState } from 'react';
import { subscribeMusicAnalysis } from '../../audio/intelligence/jobs';
import { loadMusicAnalysisForAsset } from '../../audio/intelligence/store';
import type { MusicAnalysis, MusicSection } from '../../audio/intelligence/types';
import { displayMusicLabel } from '../../audio/intelligence/clapProfile';
import { displaySectionRole } from '../../audio/listen/songMap';
import { reactionEvents } from '../../editor/musicReactionEvents';
import { localFrameForSourceMs, sourceMsAtLocalFrame } from '../../editor/sourceLimit';
import type { MediaAsset, TimelineItem } from '../../editor/types';

const colors: Record<MusicSection['role'], string> = {
  'intro-like': '#537ca4', build: '#b17b35', peak: '#d35a45', break: '#7770a9', steady: '#608d74', 'outro-like': '#597b97',
};

export function MusicMapStripView({ visible, analysis, item, fps, px }: {
  visible: boolean; analysis: MusicAnalysis | null; item: TimelineItem; fps: number; px: number;
}) {
  if (!visible || !analysis || item.durationInFrames <= 0) return null;
  const startMs = sourceMsAtLocalFrame(item, 0, fps);
  const endMs = sourceMsAtLocalFrame(item, item.durationInFrames, fps);
  const width = item.durationInFrames * px;
  const x = (ms: number) => Math.max(0, Math.min(width, (ms - startMs) / (endMs - startMs) * width));
  return <div data-music-map style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', background: '#222' }}>
    {analysis.sections.filter((section) => section.fromMs < endMs && section.toMs > startMs).map((section, index) => {
      const left = x(section.fromMs), right = x(section.toMs);
      const label = [displaySectionRole(section.role), section.mood && displayMusicLabel(section.mood.label)].filter(Boolean).join(' · ');
      return <span data-music-section key={`${section.fromMs}-${index}`} title={label} style={{ position: 'absolute', left, width: right - left, height: '100%', background: colors[section.role], color: '#fff', fontSize: 10, overflow: 'hidden', whiteSpace: 'nowrap' }}>{label}</span>;
    })}
    {analysis.downbeatsMs.map((ms) => {
      const frame = localFrameForSourceMs(item, ms, fps);
      return frame === null ? null : <span data-music-downbeat key={ms} style={{ position: 'absolute', left: frame * px, top: 0, height: '100%', borderLeft: '1px solid white' }} />;
    })}
    {reactionEvents(analysis, 'drops').map(({ timeMs }) => {
      const frame = localFrameForSourceMs(item, timeMs, fps);
      return frame === null ? null : <span data-music-drop key={timeMs} style={{ position: 'absolute', left: frame * px, top: 0, color: '#fff' }}>▼</span>;
    })}
  </div>;
}

export function MusicMapStrip({ visible, item, assets, fps, px, left, top }: {
  visible: boolean; item: TimelineItem; assets: readonly MediaAsset[]; fps: number; px: number; left: number; top: number;
}) {
  const [analysis, setAnalysis] = useState<MusicAnalysis | null>(null);
  const asset = assets.find((candidate) => candidate.id === item.sourceAssetId)
    ?? assets.find((candidate) => candidate.src === item.src);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!visible || !asset) { setAnalysis(null); return; }
      void loadMusicAnalysisForAsset(asset).then((value) => { if (active) setAnalysis(value); }).catch(() => { if (active) setAnalysis(null); });
    };
    setAnalysis(null); refresh();
    const unsubscribe = subscribeMusicAnalysis(refresh);
    return () => { active = false; unsubscribe(); };
  }, [asset, visible]);
  if (!visible || !analysis) return null;
  return <div style={{ position: 'absolute', left, top, width: item.durationInFrames * px, height: 16 }}>
    <MusicMapStripView visible analysis={analysis} item={item} fps={fps} px={px} />
  </div>;
}
