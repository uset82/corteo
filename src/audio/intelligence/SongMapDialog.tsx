import type { MusicAnalysis } from './types';
import { displayMusicLabel } from './clapProfile';
import { buildSongMap, displaySectionRole, type SongMapLine } from '../listen/songMap';
import type { KeyEstimate } from '../listen/types';
import { reactionEvents } from '../../editor/musicReactionEvents';
import { listenClock, type ListenRelaySnapshot } from '../../../shared/music-inference/listen-snapshot';
import { hasOperationalTranscript } from '../../transcript/types';
import type { MediaAsset } from '../../editor/types';
import { useT } from '../../i18n/locale';

const colors: Record<string, string> = { 'intro-like': '#3b6ea8', build: '#b07a2e', peak: '#c0446c', break: '#69768a', steady: '#3f7d5e', 'outro-like': '#5a6b94' };

export function SongMapButton({ analysis, onOpen }: { analysis: MusicAnalysis | null; onOpen: () => void }) {
  const t = useT();
  return analysis ? <button type="button" className="cc-music-analysis-action" onClick={onOpen}>{t('歌曲地图标题')}</button> : null;
}

export function SongMapDialog({ analysis, asset, onClose, tonalKey, lyrics, relay }: {
  analysis: MusicAnalysis; asset?: MediaAsset; onClose: () => void;
  tonalKey?: KeyEstimate | null; lyrics?: readonly SongMapLine[]; relay?: ListenRelaySnapshot | null;
}) {
  const t = useT();
  const duration = Math.max(1, analysis.durationMs);
  const x = (ms: number) => Math.max(0, Math.min(600, ms / duration * 600));
  const transcriptWords = hasOperationalTranscript(asset) ? asset.transcript.map((word) => ({ text: word.text, startMs: word.start, endMs: word.end })) : [];
  const lines = lyrics ?? buildSongMap({ analysis, transcriptWords }).lines;
  const energy = analysis.sections.map((section) => `${x(section.fromMs)},${100 - Math.max(0, Math.min(1, section.energy)) * 75}`).join(' ');
  return <div className="cc-song-map" aria-label={t('歌曲地图标题')}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h3>{t('歌曲地图标题')}</h3><button type="button" className="cc-music-analysis-action" onClick={onClose}>{t('歌曲地图返回')}</button>
    </header>
    <p>{t('速度')}: {Math.round(analysis.bpm)} BPM · {t('拍号')}: {analysis.meter}/4
      {tonalKey && <> · {t('歌曲地图调性')}: {tonalKey.tonic} {tonalKey.mode === 'minor' ? t('歌曲地图小调') : t('歌曲地图大调')}</>}</p>
    <svg viewBox="0 0 600 120" role="img" aria-label={t('歌曲地图标题')} style={{ width: '100%', background: '#10151b' }}>
      {analysis.sections.map((section, index) => <rect key={`${section.fromMs}-${index}`} x={x(section.fromMs)} y="4" width={Math.max(0, x(section.toMs) - x(section.fromMs))} height="105" fill={colors[section.role]} opacity="0.45" />)}
      {analysis.downbeatsMs.filter((_, index) => index % Math.max(1, Math.ceil(analysis.downbeatsMs.length / 500)) === 0).map((ms) => <line key={ms} x1={x(ms)} x2={x(ms)} y1="4" y2="14" stroke="white" />)}
      {reactionEvents(analysis, 'drops').map((event) => <line key={event.timeMs} x1={x(event.timeMs)} x2={x(event.timeMs)} y1="4" y2="110" stroke="#a8e5ff" strokeDasharray="4 3" />)}
      {energy && <polyline points={energy} fill="none" stroke="#8ef0ba" strokeWidth="2" />}
    </svg>
    <ol className="cc-music-analysis-sections">{analysis.sections.map((section, index) => <li key={`${section.fromMs}-${index}`}>
      <time>{listenClock(section.fromMs)}–{listenClock(section.toMs)}</time> <b>{displaySectionRole(section.role)}</b>
      {section.mood && <span>{displayMusicLabel(section.mood.label)}</span>} <span>{t('能量')} {Math.round(section.energy * 100)}%</span>
    </li>)}</ol>
    {lines.length > 0 && <section><h4>{t('歌曲地图歌词')}</h4>{lines.map((line, index) => <p key={`${line.startMs}-${index}`}><time>{listenClock(line.startMs)}</time> {line.text}</p>)}</section>}
    {relay?.note && <section><h4>{relay.audioTokens > 0 ? t('歌曲地图已听') : t('歌曲地图未验证')}</h4><p>{relay.note}</p></section>}
  </div>;
}
