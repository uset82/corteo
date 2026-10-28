import { useEffect, useState } from 'react';
import type { MusicAnalysis } from './types';
import { displayMusicLabel } from './clapProfile';
import { buildSongMap, displaySectionRole, type SongMapLine } from '../listen/songMap';
import type { KeyEstimate } from '../listen/types';
import { useSongMeasurement } from '../listen/useSongMeasurement';
import { reactionEvents } from '../../editor/musicReactionEvents';
import { listenClock, type ListenRelaySnapshot } from '../../../shared/music-inference/listen-snapshot';
import { hasOperationalTranscript } from '../../transcript/types';
import type { MediaAsset } from '../../editor/types';
import { useT } from '../../i18n/locale';

const colors: Record<string, string> = { 'intro-like': '#3b6ea8', build: '#b07a2e', peak: '#c0446c', break: '#69768a', steady: '#3f7d5e', 'outro-like': '#5a6b94' };

export const MUSIC_RELAY_ENDPOINT = '/api/music-listen/relay';

export interface RelayUiState {
  available: boolean;
  busy: boolean;
  error: string | null;
}

export function SongMapButton({ analysis, onOpen }: { analysis: MusicAnalysis | null; onOpen: () => void }) {
  const t = useT();
  return analysis ? <button type="button" className="cc-music-analysis-action" onClick={onOpen}>{t('歌曲地图标题')}</button> : null;
}

export function SongMapDialog({ analysis, asset, onClose, tonalKey, loudness, measureError, lyrics, relay, relayState, onListen }: {
  analysis: MusicAnalysis; asset?: MediaAsset; onClose: () => void;
  tonalKey?: KeyEstimate | null; loudness?: { busy: boolean; db: number | null } | null;
  measureError?: string | null; lyrics?: readonly SongMapLine[];
  relay?: ListenRelaySnapshot | null; relayState?: RelayUiState; onListen?: () => void;
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
      {tonalKey && <> · {t('歌曲地图调性')}: {tonalKey.tonic} {tonalKey.mode === 'minor' ? t('歌曲地图小调') : t('歌曲地图大调')}</>}
      {loudness && <> · {t('歌曲地图音量')}: {loudness.busy ? t('歌曲地图测量中') : loudness.db === null ? '—' : `${loudness.db.toFixed(1)} dB`}</>}</p>
    {measureError && <p className="cc-insp-muted">{measureError}</p>}
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
    {(relay?.note || relayState?.available || relayState?.error) && <section className="cc-song-map-ear">
      <h4>{relay ? <span className={`cc-song-map-badge ${relay.status === 'verificado' ? 'verified' : 'unverified'}`}>{relay.status === 'verificado' ? t('歌曲地图已听') : t('歌曲地图未验证')}</span> : t('歌曲地图真实听感')}</h4>
      {relay?.note && <p>{relay.note}</p>}
      {relayState?.available && !relay && <button type="button" className="cc-music-analysis-action" disabled={relayState.busy} onClick={onListen}>
        {relayState.busy ? t('歌曲地图正在听') : t('歌曲地图真实耳朵')}</button>}
      {relayState?.error && <p role="status">{relayState.error}</p>}
    </section>}
  </div>;
}

/** Asks the server once whether the real ear is switched on, then listens on demand. */
export function SongMapDialogPanel({ analysis, asset, onClose }: {
  analysis: MusicAnalysis; asset?: MediaAsset; onClose: () => void;
}) {
  const t = useT();
  const measured = useSongMeasurement(asset?.src, true);
  const [relay, setRelay] = useState<ListenRelaySnapshot | null>(null);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void fetch(MUSIC_RELAY_ENDPOINT).then((response) => response.json()).then((body: { enabled?: boolean }) => {
      if (active) setAvailable(body?.enabled === true);
    }).catch(() => { if (active) setAvailable(false); });
    return () => { active = false; };
  }, []);
  const listen = async () => {
    if (!asset || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(MUSIC_RELAY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset }),
      });
      const body = await response.json().catch(() => null) as { relay?: ListenRelaySnapshot } | null;
      if (!response.ok || !body?.relay) {
        setError(t(response.status === 409 ? '歌曲地图未开启真实耳朵'
          : response.status === 404 ? '歌曲地图文件不可达' : '歌曲地图真实耳朵失败'));
        return;
      }
      setRelay(body.relay);
    } catch {
      setError(t('歌曲地图真实耳朵失败'));
    } finally {
      setBusy(false);
    }
  };
  return <SongMapDialog
    analysis={analysis}
    asset={asset}
    onClose={onClose}
    tonalKey={measured.measurement?.key ?? null}
    loudness={asset?.src ? { busy: measured.busy, db: measured.measurement?.loudnessDb ?? null } : null}
    measureError={measured.error ? t('歌曲地图测量失败') : null}
    relay={relay}
    relayState={{ available, busy, error }}
    onListen={listen}
  />;
}
