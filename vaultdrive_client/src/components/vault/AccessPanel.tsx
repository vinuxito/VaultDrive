import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, X } from 'lucide-react';
import { API_URL } from '../../utils/api';
import { formatDate, relativeTime } from '../../utils/format';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { DataState } from '../ui/data-state';
import { Button } from '../ui/button';
import { accessKind, accessLabel, accessState, externalReadEntries, isAccessEntries, type AccessEntry } from './trust-copy';
interface AccessSummary { entries: AccessEntry[] }
interface AccessPanelProps { fileId: string; filename: string; onClose: () => void }

export function AccessPanel({ fileId, filename, onClose }: AccessPanelProps) {
  const { t, i18n } = useTranslation('drive');
  const [data, setData] = useState<AccessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [operation, setOperation] = useState<'confirmed' | 'confirmed-stale' | 'unknown' | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  useDialogFocus({ open: true, onClose: () => { if (!revoking) onClose(); }, containerRef: panelRef });
  const loadAccessSummary = useCallback(async () => {
    const id = ++generation.current;
    setLoading(true); setError(false);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('session_missing');
      const response = await fetch(`${API_URL}/v1/files/${fileId}/access-summary`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('access_unavailable');
      const payload = await response.json();
      if (!isAccessEntries(payload?.entries)) throw new Error('access_invalid');
      if (id === generation.current) setData(payload);
      return id === generation.current;
    } catch { if (id === generation.current) setError(true); return false; }
    finally { if (id === generation.current) setLoading(false); }
  }, [fileId]);
  const invalidate = useCallback(() => { generation.current++; }, []);
  useEffect(() => { setData(null); setOperation(null); void loadAccessSummary(); return invalidate; }, [loadAccessSummary, invalidate]);
  const revokeAll = async () => {
    setRevoking(true); setOperation(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('session_missing');
      const response = await fetch(`${API_URL}/v1/files/${fileId}/revoke-external`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('revoke_unconfirmed');
      setOperation('confirmed');
      if (!(await loadAccessSummary())) setOperation('confirmed-stale');
    } catch { setOperation('unknown'); }
    finally { setRevoking(false); setConfirmRevoke(false); }
  };
  const entries = externalReadEntries(data?.entries ?? []);
  const active = entries.filter(entry => entry.state === 'active');
  const canRevoke = active.some(entry => entry.kind === 'direct' || entry.kind === 'share_link');
  return <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
    <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="access-panel-title" tabIndex={-1} className="bg-card text-card-foreground rounded-2xl shadow-2xl w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto border border-border p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h2 id="access-panel-title" className="flex items-center gap-2 font-semibold text-foreground"><ShieldCheck className="w-4 h-4 shrink-0" />{t('coherence.trust.accessTitle', { defaultValue: 'Access Control' })}</h2><p className="mt-1 break-words text-sm text-muted-foreground">{filename}</p></div>
        <button type="button" disabled={revoking} onClick={onClose} aria-label={t('coherence.trust.close', { defaultValue: 'Close access details' })} className="p-2 rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><X className="w-4 h-4" /></button>
      </div>
      <p className="text-sm text-muted-foreground">{t('coherence.trust.scopeNote', { defaultValue: 'Review access settings for the listed routes. Closing a route cannot recall downloaded copies.' })}</p>
      {operation === 'unknown' && <div role="alert" className="rounded-xl p-3 border border-destructive text-foreground bg-destructive/10 space-y-2"><p>{t('coherence.trust.revokeUnknown', { defaultValue: 'Revocation was not confirmed. Refresh access before deciding whether to retry.' })}</p><Button variant="outline" onClick={() => void loadAccessSummary()}>{t('coherence.trust.refresh', { defaultValue: 'Refresh access' })}</Button></div>}
      {(operation === 'confirmed' || operation === 'confirmed-stale') && <p role="status" className="brand-receipt-surface rounded-xl p-3 text-foreground">{operation === 'confirmed-stale' ? t('coherence.trust.revokeConfirmedStale', { defaultValue: 'Direct shares and file links were closed, but the latest access list could not be refreshed. Previously loaded entries may be out of date.' }) : t('coherence.trust.revokeConfirmed', { defaultValue: 'Direct shares and file links were closed. Folder access and downloaded copies are unaffected. Review remaining permissions below.' })}</p>}
      {error && data && <p role="alert">{t('coherence.trust.stale', { defaultValue: 'The latest check failed. Previously loaded access is shown below.' })}</p>}
      <DataState loading={loading} error={error ? t('coherence.trust.unavailable', { defaultValue: 'Access could not be checked. No access conclusion is available.' }) : undefined} onRetry={() => void loadAccessSummary()} empty={!!data && entries.length === 0}
        emptyConfig={{ title: t('coherence.trust.noRoutes', { defaultValue: 'No external read routes are listed.' }), body: t('coherence.trust.scopeNote', { defaultValue: 'Review access settings for the listed routes. Closing a route cannot recall downloaded copies.' }) }} loadingLabel={t('coherence.trust.loading', { defaultValue: 'Checking recorded access…' })}>
        <p className="font-medium">{t('coherence.trust.routes', { defaultValue: '{{count}} active external read routes', count: active.length })}</p>
      </DataState>
      {!loading && entries.length > 0 && <ul className="space-y-3">{entries.map((entry, index) => <li key={`${entry.kind}-${entry.since}-${index}`} className="rounded-xl border border-border bg-muted p-3 space-y-2">
        <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-background border border-border px-2 py-1">{accessKind(entry.kind, t)}</span><span className="rounded-full bg-background border border-border px-2 py-1">{accessState(entry.state, t)}</span></div>
        <p className="font-medium text-sm break-words">{accessLabel(entry, t)}</p>
        <p className="text-xs text-muted-foreground break-words">{formatDate(entry.since, i18n.language)} · {relativeTime(entry.since, i18n.language)}</p>
        {entry.expires_at && <p className="text-xs">{t('coherence.trust.expires', { defaultValue: 'Expiry: {{time}}', time: formatDate(entry.expires_at, i18n.language) })}</p>}
        {entry.unlock_at && <p className="text-xs">{t('coherence.trust.unlocks', { defaultValue: 'Available from: {{time}}', time: formatDate(entry.unlock_at, i18n.language) })}</p>}
        {entry.max_downloads === 1 && <p className="text-xs">{t('coherence.trust.singleUse', { defaultValue: 'One authorized fetch consumes this link, even if delivery is interrupted.' })}</p>}
        {typeof entry.access_count === 'number' && <p className="text-xs">{t('coherence.trust.fetchCount', { defaultValue: '{{count}} authorized link fetches; reading is not confirmed', count: entry.access_count })}</p>}
      </li>)}</ul>}
      {canRevoke && !loading && !error && (confirmRevoke ? <div className="rounded-xl p-3 border border-destructive bg-destructive/5 space-y-3">
        <h3 className="font-medium">{t('coherence.trust.revokeTitle', { defaultValue: 'Close direct shares and file links?' })}</h3>
        <p className="text-sm">{t('coherence.trust.revokeScope', { defaultValue: 'This closes direct recipient grants and public file links. Folder permissions, copies already downloaded and downloads in progress are unaffected.' })}</p>
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={revoking} onClick={() => setConfirmRevoke(false)}>{t('coherence.trust.cancel', { defaultValue: 'Cancel' })}</Button><Button disabled={revoking} onClick={() => void revokeAll()}>{revoking ? t('coherence.trust.revoking', { defaultValue: 'Closing access…' }) : t('coherence.trust.revokeNow', { defaultValue: 'Revoke now' })}</Button></div>
      </div> : <Button variant="outline" className="w-full h-auto min-h-10 whitespace-normal" onClick={() => setConfirmRevoke(true)}>{t('coherence.trust.revoke', { defaultValue: 'Revoke direct access and file links' })}</Button>)}
    </div>
  </div>;
}
