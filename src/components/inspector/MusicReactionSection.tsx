import { useEffect, useState } from 'react';
import type { AgentContext } from '../../agent/context';
import { unavailableAnalysis } from '../../agent/tools/music-intelligence-plan';
import { execMusicReactionTool, type MusicReactionToolDeps } from '../../agent/tools/music-reactions-tools';
import { subscribeMusicAnalysis } from '../../audio/intelligence/jobs';
import { loadMusicAnalysisForAsset } from '../../audio/intelligence/store';
import type { MusicAnalysis } from '../../audio/intelligence/types';
import { DEFAULT_REACTION_TIMING, MUSIC_REACTIONS, MUSIC_REACTION_TIMINGS } from '../../editor/musicReactions';
import type { MediaAsset, MusicReaction, MusicReactionTiming, TimelineItem } from '../../editor/types';
import { useT } from '../../i18n/locale';

const reactionLabels: Record<MusicReaction, string> = {
  pulso: '音乐反应脉冲', golpe: '音乐反应冲击', temblor: '音乐反应震动', destello: '音乐反应闪光',
  respirar: '音乐反应呼吸', 'ken-burns-al-ritmo': '音乐节奏 Ken Burns',
};
const timingLabels: Record<MusicReactionTiming, string> = {
  beats: '音乐时机节拍', downbeats: '音乐时机小节', accents: '音乐时机重音',
  drops: '音乐时机高潮', sections: '音乐时机段落', energy: '音乐时机能量',
};
const browserDeps: MusicReactionToolDeps = { loadAnalysis: loadMusicAnalysisForAsset, unavailableAnalysis };

export async function applyMusicReaction(
  ctx: AgentContext, itemId: string, targetItemIds: string[], reaction: MusicReaction,
  timing: MusicReactionTiming, intensity: number, deps: MusicReactionToolDeps = browserDeps,
): Promise<Record<string, unknown>> {
  const args = { itemId, targetItemIds, reaction, timing, intensity };
  const plan = await execMusicReactionTool('music_reaction_plan', args, ctx, deps) as Record<string, unknown>;
  if (plan.ok !== true || typeof plan.songMapRef !== 'string') return plan;
  return await execMusicReactionTool('apply_music_reaction', { ...args, songMapRef: plan.songMapRef }, ctx, deps) as Record<string, unknown>;
}

interface ViewProps {
  hasAudio: boolean;
  analysis: MusicAnalysis | null;
  reaction: MusicReaction;
  timing: MusicReactionTiming;
  intensity: number;
  busy: boolean;
  message?: string;
  translate: (key: string) => string;
  onReaction: (reaction: MusicReaction) => void;
  onTiming: (timing: MusicReactionTiming) => void;
  onIntensity: (intensity: number) => void;
  onApply: () => void;
  onClear: () => void;
}

export function MusicReactionView(props: ViewProps) {
  const t = props.translate;
  const disabled = !props.hasAudio || !props.analysis || props.busy;
  return <section>
    <div className="cc-insp-section"><span>{t('音乐反应标题')}</span></div>
    <div className="cc-insp-kb-grid" aria-label={t('音乐反应标题')}>
      {MUSIC_REACTIONS.map((reaction) => <button type="button" className="cc-insp-kb-btn" key={reaction}
        aria-pressed={props.reaction === reaction} onClick={() => props.onReaction(reaction)}>{t(reactionLabels[reaction])}</button>)}
    </div>
    <div className="cc-insp-kb-grid" aria-label={t('音乐反应时机')}>
      {MUSIC_REACTION_TIMINGS.map((timing) => <button type="button" className="cc-insp-kb-btn" key={timing}
        aria-pressed={props.timing === timing} onClick={() => props.onTiming(timing)}>{t(timingLabels[timing])}</button>)}
    </div>
    <label>{t('音乐反应强度')} <input type="range" min="0" max="100" value={props.intensity}
      onChange={(event) => props.onIntensity(Number(event.target.value))} /> {props.intensity}%</label>
    <div className="cc-insp-kb-grid">
      <button type="button" className="cc-insp-kb-btn" disabled={disabled} onClick={props.onApply}>{t('音乐反应应用')}</button>
      <button type="button" className="cc-insp-kb-btn" disabled={disabled} onClick={props.onClear}>{t('音乐反应移除')}</button>
    </div>
    {!props.hasAudio ? <div className="cc-insp-muted">{t('时间线没有歌曲')}</div>
      : !props.analysis ? <div className="cc-insp-muted">{t('请先分析歌曲媒体徽章')}</div> : null}
    {props.analysis && <div aria-label={t('音乐反应能量')} style={{ display: 'flex', alignItems: 'end', gap: 2, height: 24 }}>
      {props.analysis.sections.map((section, index) => <span key={`${section.fromMs}-${index}`} style={{ flex: 1, height: `${Math.max(5, section.energy * 100)}%`, background: 'var(--cc-accent, #ff4a1f)' }} />)}
    </div>}
    {props.message && <div role="status" className="cc-insp-muted">{props.message}</div>}
  </section>;
}

export function MusicReactionSection({ ctx, items, assets, targets }: {
  ctx: AgentContext; items: readonly TimelineItem[]; assets: readonly MediaAsset[]; targets: readonly TimelineItem[];
}) {
  const t = useT();
  const [reaction, setReaction] = useState<MusicReaction>('pulso');
  const [timing, setTiming] = useState<MusicReactionTiming>(DEFAULT_REACTION_TIMING.pulso);
  const [intensity, setIntensity] = useState(60);
  const [analysis, setAnalysis] = useState<MusicAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const music = items.find((item) => item.kind === 'audio' && targets.some((target) =>
    target.startFrame < item.startFrame + item.durationInFrames && item.startFrame < target.startFrame + target.durationInFrames))
    ?? items.find((item) => item.kind === 'audio');
  const asset = music && (assets.find((candidate) => candidate.id === music.sourceAssetId)
    ?? assets.find((candidate) => candidate.src === music.src));
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!asset) { setAnalysis(null); return; }
      void loadMusicAnalysisForAsset(asset).then((value) => { if (active) setAnalysis(value); }).catch(() => { if (active) setAnalysis(null); });
    };
    setAnalysis(null);
    refresh();
    const unsubscribe = subscribeMusicAnalysis(refresh);
    return () => { active = false; unsubscribe(); };
  }, [asset]);
  const execute = async (clear: boolean) => {
    if (!music || !analysis || busy) return;
    setBusy(true); setMessage('');
    try {
      const ids = targets.map((item) => item.id);
      const result = clear
        ? await execMusicReactionTool('clear_music_reaction', { itemId: music.id, targetItemIds: ids, reaction }, ctx, browserDeps) as Record<string, unknown>
        : await applyMusicReaction(ctx, music.id, ids, reaction, timing, intensity / 100);
      setMessage(result.ok === true && result.changed === true ? t('音乐反应完成') : t('音乐反应未更改'));
    } catch { setMessage(t('音乐反应未更改')); } finally { setBusy(false); }
  };
  return <MusicReactionView hasAudio={Boolean(music)} analysis={analysis} reaction={reaction} timing={timing}
    intensity={intensity} busy={busy} message={message} translate={t}
    onReaction={(value) => { setReaction(value); setTiming(DEFAULT_REACTION_TIMING[value]); }}
    onTiming={setTiming} onIntensity={setIntensity} onApply={() => { void execute(false); }} onClear={() => { void execute(true); }} />;
}
