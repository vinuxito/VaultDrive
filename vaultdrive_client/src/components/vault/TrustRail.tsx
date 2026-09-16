import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { API_URL } from '../../utils/api';
import { Button } from '../ui/button';
import { accessKind, externalReadEntries, isAccessEntries, type AccessEntry } from './trust-copy';

interface TrustSummary { owner_label: string; origin: string; entries: AccessEntry[] }
export function TrustRail({ fileId }: { fileId: string }) {
  const { t } = useTranslation('drive');
  const [summary, setSummary] = useState<TrustSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false); setSummary(null);
    const token = localStorage.getItem('token');
    void (async () => {
      try {
        if (!token) throw new Error('session_missing');
        const response = await fetch(`${API_URL}/v1/files/${fileId}/trust`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (!response.ok) throw new Error('trust_unavailable');
        const payload = await response.json();
        if (!isAccessEntries(payload?.data?.entries)) throw new Error('trust_invalid');
        if (!controller.signal.aborted) setSummary(payload.data);
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [fileId, attempt]);
  const active = externalReadEntries(summary?.entries ?? []).filter(e => e.state === 'active');
  return <section className="brand-trust-shell rounded-2xl p-4 space-y-3" aria-label={t('coherence.trust.title', { defaultValue: 'Protection & Access' })}>
    <h3 className="flex items-center gap-2 font-semibold text-foreground"><ShieldCheck className="h-4 w-4 shrink-0" />{t('coherence.trust.title', { defaultValue: 'Protection & Access' })}</h3>
    {loading ? <p role="status" className="text-muted-foreground">{t('coherence.trust.loading', { defaultValue: 'Checking recorded access…' })}</p> : error || !summary ?
      <div role="alert" className="space-y-2 text-foreground"><p className="text-foreground">{t('coherence.trust.unavailable', { defaultValue: 'Access could not be checked. No access conclusion is available.' })}</p><Button variant="outline" onClick={() => setAttempt(n => n + 1)}>{t('coherence.trust.retry', { defaultValue: 'Retry' })}</Button></div> : <>
        <p className="text-foreground font-medium">{active.length ? t('coherence.trust.routes', { defaultValue: '{{count}} active external read routes', count: active.length }) : t('coherence.trust.noRoutes', { defaultValue: 'No external read routes are listed.' })}</p>
        <p className="text-sm text-muted-foreground">{t('coherence.trust.ownerNamed', { defaultValue: 'Owner: {{name}}', name: summary.owner_label })}</p>
        <div className="flex flex-wrap gap-2">{Array.from(new Set(active.map(e => e.kind))).map(kind => <span key={kind} className="rounded-full border border-border bg-background px-2 py-1 text-xs text-foreground">{accessKind(kind, t)}</span>)}</div>
        <p className="text-sm text-muted-foreground">{t('coherence.trust.scopeNote', { defaultValue: 'Review access settings for the listed routes. Closing a route cannot recall downloaded copies.' })}</p>
        <details className="brand-trust-panel rounded-xl p-3 text-sm"><summary className="cursor-pointer text-foreground">{t('coherence.trust.details', { defaultValue: 'Encryption and delivery details' })}</summary>
          <p className="mt-2 text-muted-foreground">{t('coherence.trust.encryption', { defaultValue: 'File contents are encrypted before upload. Filenames, sizes and access metadata remain visible to the service.' })}</p>
          <p className="mt-2 text-muted-foreground">{summary.origin === 'secure_drop' ? t('coherence.trust.dropException', { defaultValue: 'Received through Secure Drop. Its delivery-key recovery is managed by the server; this is an exception to browser-only key handling.' }) : t('coherence.trust.uploaded', { defaultValue: 'Encrypted file stored in your vault' })}</p>
        </details>
      </>}
  </section>;
}
