import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3 } from 'lucide-react';
import { API_URL } from '../../utils/api';
import { formatDate, relativeTime } from '../../utils/format';
import { Button } from '../ui/button';
import { timelineLabel } from './trust-copy';
interface TimelineEvent { id: string; event_type: string; label: string; at: string; tone: string }
export function FileSecurityTimeline({ fileId }: { fileId: string }) {
  const { t, i18n } = useTranslation('drive');
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false); setEvents([]);
    void (async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('session_missing');
        const response = await fetch(`${API_URL}/v1/files/${fileId}/timeline`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (!response.ok) throw new Error('timeline_unavailable');
        const payload = await response.json();
        if (!Array.isArray(payload?.data)) throw new Error('timeline_invalid');
        if (!controller.signal.aborted) setEvents(payload.data);
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [fileId, attempt]);
  return <section className="brand-trust-shell rounded-2xl p-4 space-y-3">
    <h3 className="flex items-center gap-2 font-semibold text-foreground"><Clock3 className="h-4 w-4 shrink-0" />{t('coherence.trust.history', { defaultValue: 'Recorded access activity' })}</h3>
    {loading ? <p role="status">{t('coherence.trust.historyLoading', { defaultValue: 'Loading recorded history…' })}</p> : error ?
      <div role="alert" className="space-y-2 text-foreground"><p className="text-foreground">{t('coherence.trust.historyUnavailable', { defaultValue: 'History could not be loaded. This does not establish whether access occurred.' })}</p><Button variant="outline" onClick={() => setAttempt(n => n + 1)}>{t('coherence.trust.retry', { defaultValue: 'Retry' })}</Button></div> : events.length === 0 ?
      <p className="text-muted-foreground">{t('coherence.trust.historyEmpty', { defaultValue: 'No recorded events were returned. Check access settings to review current permissions.' })}</p> : <>
        <p className="text-xs text-muted-foreground">{t('coherence.trust.historyCount', { defaultValue: '{{count}} entries from recorded activity; older activity may be absent', count: events.length })}</p>
        <ol className="max-h-72 overflow-y-auto space-y-2">{events.map(event => <li key={event.id} className="brand-trust-panel rounded-xl p-3 space-y-1 min-w-0">
          <p className="text-sm text-foreground break-words">{timelineLabel(event, t)}</p>
          <p className="text-xs text-muted-foreground break-words"><time dateTime={event.at}>{formatDate(event.at, i18n.language)}</time> · {relativeTime(event.at, i18n.language)}</p>
        </li>)}</ol>
      </>}
  </section>;
}
