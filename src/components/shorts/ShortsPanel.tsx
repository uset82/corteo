import { useState, type CSSProperties } from 'react';
import type { AgentContext } from '../../agent/context';
import { recordDecision } from '../../agent/shorts/calibration';
import { execMakeShortsTool } from '../../agent/tools/make-shorts-tools';
import { execShortsTool } from '../../agent/tools/shorts-tools';
import { useT } from '../../i18n/locale';
import { theme } from '../../theme';
import { Icon } from '../icons';

/**
 * "Analizar episodio": the OpusClip-shaped surface for Plan 5.
 *
 * It is deliberately thin. Scoring is `score_moments`, cutting is `make_shorts`, and both
 * are the same executors the agent calls over MCP — the panel adds a score chip, a reason,
 * a checkbox and an approve/reject pair, not a second pipeline. Approve/reject feed the
 * calibration ledger (OP-04), which is the only thing here that the agent cannot do alone:
 * it needs a human's opinion.
 */

interface ScoredMoment {
  startWord: number;
  endWord: number;
  startMs: number;
  endMs: number;
  seconds: number;
  score: number;
  subscores: { hook: number; flow: number; value: number; sound: number };
  title: string;
  reason: string;
  risks: string[];
}

interface AnalyzeResult {
  ok?: boolean;
  error?: string;
  moments?: ScoredMoment[];
  threshold?: number;
  modelUsed?: boolean;
  note?: string;
}

interface CreateResult {
  ok?: boolean;
  error?: string;
  count?: number;
  clips?: { sequenceId: string; title: string }[];
  note?: string;
}

interface ShortsPanelProps {
  ctx: AgentContext;
  onClose: () => void;
}

const card: CSSProperties = {
  width: 'min(760px, 92vw)',
  maxHeight: '84vh',
  display: 'flex',
  flexDirection: 'column',
  background: theme.panel,
  border: `1px solid ${theme.border}`,
  borderRadius: 10,
  boxShadow: '0 24px 60px rgba(0,0,0,.35)',
  overflow: 'hidden',
};

const chip = (score: number): CSSProperties => ({
  minWidth: 38,
  height: 26,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 700,
  color: score >= 55 ? theme.onAccent : theme.textDim,
  background: score >= 55 ? theme.accent : theme.panelAlt,
});

export function ShortsPanel({ ctx, onClose }: ShortsPanelProps) {
  const t = useT();
  const [busy, setBusy] = useState<'analyze' | 'create' | null>(null);
  const [moments, setMoments] = useState<ScoredMoment[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const analyze = async (): Promise<void> => {
    setBusy('analyze');
    setError(null);
    setNotice(null);
    try {
      const result = await execShortsTool('score_moments', { count: 8 }, ctx) as AnalyzeResult;
      if (result.error) {
        setError(result.error);
        setMoments(null);
      } else {
        const list = result.moments ?? [];
        setMoments(list);
        setSelected(new Set(list.map((moment) => moment.startWord)));
        if (!list.length) setNotice(result.note ?? t('没有找到合适的片段。'));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  const create = async (): Promise<void> => {
    if (!moments) return;
    const chosen = moments.filter((moment) => selected.has(moment.startWord));
    if (!chosen.length) return;
    setBusy('create');
    setError(null);
    try {
      const result = await execMakeShortsTool('make_shorts', {
        count: chosen.length,
        minScore: 0,
        reframe: true,
        ranges: chosen.map((moment) => ({ startWord: moment.startWord, endWord: moment.endWord })),
      }, ctx) as CreateResult;
      if (result.error) setError(result.error);
      else setNotice(t('已创建 {n} 个片段', { n: result.count ?? 0 }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  const decide = (moment: ScoredMoment, decision: 'approved' | 'rejected'): void => {
    recordDecision({
      at: Date.now(),
      projectId: ctx.getProjectId?.() ?? '',
      sourceId: String(ctx.getState().items.find((item) => item.transcript?.some((w) => w.start === moment.startMs))?.id ?? ''),
      startWord: moment.startWord,
      endWord: moment.endWord,
      startMs: moment.startMs,
      endMs: moment.endMs,
      score: moment.score,
      subscores: moment.subscores,
      decision,
    });
    setSelected((previous) => {
      const next = new Set(previous);
      if (decision === 'approved') next.add(moment.startWord);
      else next.delete(moment.startWord);
      return next;
    });
    setNotice(decision === 'approved' ? t('已批准，评分会记住这个选择') : t('已丢弃，评分会避开这一类'));
  };

  const toggle = (startWord: number): void => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(startWord)) next.delete(startWord);
      else next.add(startWord);
      return next;
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('分析长视频')}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 40, display: 'grid', placeItems: 'center',
        background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(2px)',
      }}
    >
      <div style={card} onMouseDown={(event) => event.stopPropagation()}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${theme.border}` }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 650, color: theme.text }}>
            <Icon name="scissors" size={15} />
            {t('分析长视频')}
          </span>
          <span style={{ fontSize: 11, color: theme.textDim }}>{t('从长视频里挑出值得发布的片段')}</span>
          <span style={{ flex: 1 }} />
          <button
            onClick={onClose}
            aria-label={t('关闭')}
            className="cc-tip"
            data-tip={t('关闭')}
            style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', padding: 4, lineHeight: 0 }}
          >
            <Icon name="x" size={14} />
          </button>
        </header>

        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${theme.border}` }}>
          <button
            onClick={() => { void analyze(); }}
            disabled={busy !== null}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: busy ? 'default' : 'pointer',
              background: theme.accent, color: theme.onAccent, fontSize: 12, fontWeight: 600,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy === 'analyze' ? t('分析中…') : t('分析')}
          </button>
          <span style={{ fontSize: 11, color: theme.textDim }}>{t('评分是参考，不是预测')}</span>
          <span style={{ flex: 1 }} />
          {moments && moments.length > 0 && (
            <button
              onClick={() => { void create(); }}
              disabled={busy !== null || selected.size === 0}
              style={{
                padding: '6px 14px', borderRadius: 6, cursor: selected.size ? 'pointer' : 'default',
                border: `1px solid ${theme.border}`, background: theme.panelAlt, color: theme.text,
                fontSize: 12, fontWeight: 600, opacity: selected.size ? 1 : 0.5,
              }}
            >
              {t('创建所选片段')}{selected.size ? ` (${selected.size})` : ''}
            </button>
          )}
        </div>

        <div style={{ overflowY: 'auto', padding: '6px 8px' }}>
          {error && (
            <p role="alert" style={{ margin: '10px 6px', fontSize: 12, color: theme.danger }}>{error}</p>
          )}
          {notice && !error && (
            <p style={{ margin: '10px 6px', fontSize: 12, color: theme.textDim }}>{notice}</p>
          )}
          {!moments && !error && !busy && (
            <p style={{ margin: '18px 6px', fontSize: 12, color: theme.textDim }}>{t('还没有分析结果。')}</p>
          )}
          {moments?.map((moment) => (
            <article
              key={`${moment.startWord}-${moment.endWord}`}
              style={{ display: 'flex', gap: 10, padding: '9px 8px', borderRadius: 8, borderBottom: `1px solid ${theme.border}` }}
            >
              <input
                type="checkbox"
                checked={selected.has(moment.startWord)}
                onChange={() => toggle(moment.startWord)}
                aria-label={`${t('选择片段')}: ${moment.title}`}
                style={{ marginTop: 4, cursor: 'pointer' }}
              />
              <span style={chip(moment.score)}>{moment.score}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <strong style={{ fontSize: 12, color: theme.text }}>{moment.title}</strong>
                  <span style={{ fontSize: 11, color: theme.textDim }}>{moment.seconds}s</span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 11.5, color: theme.textDim }}>{moment.reason}</p>
                {moment.risks.length > 0 && (
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: theme.danger }}>{moment.risks.join(' · ')}</p>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 10.5, color: theme.textDim }}>
                  <span>{t('钩子')} {moment.subscores.hook}</span>
                  <span>{t('流畅')} {moment.subscores.flow}</span>
                  <span>{t('价值')} {moment.subscores.value}</span>
                  <span>{t('声音')} {moment.subscores.sound}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  onClick={() => decide(moment, 'approved')}
                  title={t('批准')}
                  style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 5, border: `1px solid ${theme.border}`, background: 'none', color: theme.textDim, cursor: 'pointer' }}
                >
                  {t('批准')}
                </button>
                <button
                  onClick={() => decide(moment, 'rejected')}
                  title={t('丢弃')}
                  style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 5, border: `1px solid ${theme.border}`, background: 'none', color: theme.textDim, cursor: 'pointer' }}
                >
                  {t('丢弃')}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
