import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '../../i18n/locale';
import { theme } from '../../theme';
import { Icon } from '../icons';

/**
 * "Programar" — the scheduled-publish week (Plan 5, OP-13).
 *
 * A list grouped by day, not a month grid: the queue holds a handful of posts, and a grid
 * would spend more room on empty cells than on the one thing a person needs — what is going
 * out, when, and how to take it back.
 *
 * Everything it shows comes from `/api/publish-schedule`, which returns the *server* clock;
 * the grouping uses that clock, not the browser's, so a slot cannot look due here and idle
 * there. Cancelling goes through the same route the agent uses.
 */

interface ScheduledEntry {
  id: string;
  scheduledFor: string;
  title: string;
  platforms: string[];
  state: string;
  attempts: number;
  lastError?: string;
}

interface CalendarProps {
  onClose: () => void;
}

const DAY_MS = 86_400_000;

function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function timeLabel(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function PublishCalendar({ onClose }: CalendarProps) {
  const t = useT();
  const [entries, setEntries] = useState<ScheduledEntry[]>([]);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/publish-schedule');
      const body = await response.json().catch(() => ({})) as { entries?: ScheduledEntry[]; now?: number; error?: string };
      if (!response.ok) {
        setError(body.error ?? t('No se pudo leer la cola de publicaciones.'));
        return;
      }
      setEntries(Array.isArray(body.entries) ? body.entries : []);
      setNow(typeof body.now === 'number' ? body.now : Date.now());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const cancel = async (id: string): Promise<void> => {
    await fetch(`/api/publish-schedule?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await load();
  };

  const days = useMemo(() => {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const buckets: Array<{ key: string; label: string; entries: ScheduledEntry[] }> = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(today.getTime() + offset * DAY_MS);
      const key = dayKey(day.toISOString());
      buckets.push({
        key,
        label: day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
        entries: [],
      });
    }
    for (const entry of entries) {
      if (entry.state === 'cancelled') continue;
      const bucket = buckets.find((candidate) => candidate.key === dayKey(entry.scheduledFor));
      if (bucket) bucket.entries.push(entry);
    }
    return buckets;
  }, [entries, now]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('Programar publicaciones')}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.45)' }}
    >
      <div
        onMouseDown={(event) => event.stopPropagation()}
        style={{ width: 'min(720px, 92vw)', maxHeight: '82vh', display: 'flex', flexDirection: 'column', background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: 'hidden' }}
      >
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${theme.border}` }}>
          <Icon name="clock" size={15} />
          <span style={{ fontSize: 13, fontWeight: 650, color: theme.text }}>{t('Programar publicaciones')}</span>
          <span style={{ flex: 1 }} />
          <button onClick={() => { void load(); }} disabled={busy} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: `1px solid ${theme.border}`, background: 'none', color: theme.textDim, cursor: 'pointer' }}>
            {busy ? t('Actualizando…') : t('Actualizar')}
          </button>
          <button onClick={onClose} aria-label={t('关闭')} style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', padding: 4, lineHeight: 0 }}>
            <Icon name="x" size={14} />
          </button>
        </header>

        <div style={{ overflowY: 'auto', padding: '8px 12px 14px' }}>
          {error && <p role="alert" style={{ fontSize: 12, color: theme.danger }}>{error}</p>}
          {days.map((day) => (
            <section key={day.key} style={{ marginTop: 10 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', color: theme.textDim }}>{day.label}</h4>
              {day.entries.length === 0 && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: theme.textDim }}>{t('Nada programado')}</p>}
              {day.entries.map((entry) => (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 0', borderBottom: `1px solid ${theme.border}` }}>
                  <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: theme.text }}>{timeLabel(entry.scheduledFor)}</span>
                  <span style={{ fontSize: 12, color: theme.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</span>
                  <span style={{ fontSize: 10.5, color: theme.textDim }}>{entry.platforms.join(' · ')}</span>
                  <span style={{ fontSize: 10.5, color: entry.state === 'failed' ? theme.danger : theme.textDim }}>{t(entry.state)}</span>
                  <button onClick={() => { void cancel(entry.id); }} style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 5, border: `1px solid ${theme.border}`, background: 'none', color: theme.textDim, cursor: 'pointer' }}>
                    {t('Cancelar')}
                  </button>
                </div>
              ))}
            </section>
          ))}
          {entries.some((entry) => entry.lastError) && (
            <p style={{ marginTop: 10, fontSize: 11, color: theme.danger }}>
              {t('Alguna publicación falló: revisa el estado antes de volver a programarla.')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
