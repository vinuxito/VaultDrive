import type { TFunction } from 'i18next';

export interface AccessEntry {
  kind: string;
  label: string;
  since: string;
  state: string;
  expires_at?: string;
  access_count?: number;
  max_downloads?: number;
  unlock_at?: string;
}

export function isAccessEntries(value: unknown): value is AccessEntry[] {
  return Array.isArray(value) && value.every(entry => entry && typeof entry === 'object'
    && ['kind', 'label', 'since', 'state'].every(key => typeof entry[key] === 'string'));
}

// Intake is an upload source; ownership is not an external read grant.
export const externalReadEntries = (entries: AccessEntry[]) =>
  entries.filter(entry => entry.kind !== 'owner' && entry.kind !== 'secure_drop');

export function accessKind(kind: string, t: TFunction): string {
  switch (kind) {
    case 'owner': return t('coherence.trust.owner', { defaultValue: 'Owner' });
    case 'direct': return t('coherence.trust.direct', { defaultValue: 'Direct share' });
    case 'group': return t('coherence.trust.group', { defaultValue: 'Group association' });
    case 'share_link': return t('coherence.trust.fileLink', { defaultValue: 'File link' });
    case 'folder_share': case 'folder_link': return t('coherence.trust.folderLink', { defaultValue: 'Folder access' });
    case 'secure_drop': return t('coherence.trust.intake', { defaultValue: 'Secure Drop delivery source' });
    default: return t('coherence.trust.other', { defaultValue: 'Other access' });
  }
}

export function accessState(state: string, t: TFunction): string {
  switch (state) {
    case 'active': return t('coherence.trust.active', { defaultValue: 'Active' });
    case 'expired': return t('coherence.trust.expired', { defaultValue: 'Expired' });
    case 'revoked': return t('coherence.trust.closed', { defaultValue: 'Closed' });
    default: return t('coherence.trust.unknown', { defaultValue: 'Unknown' });
  }
}

export function accessLabel(entry: AccessEntry, t: TFunction): string {
  if (entry.kind === 'owner' || entry.kind === 'secure_drop') return accessKind(entry.kind, t);
  if (entry.kind === 'direct') return entry.label.replace(/^Direct user: /, '');
  if (entry.kind === 'group') {
    const match = /^Group: (.*) \((\d+) members\)$/.exec(entry.label);
    if (match) return t('coherence.trust.groupMembers', { defaultValue: '{{name}} · {{count}} members', name: match[1], count: Number(match[2]) });
  }
  if (entry.kind === 'share_link') return entry.label.replace(/^Public link/, accessKind(entry.kind, t)).replace(/ · last opened .*/, '');
  if (entry.kind === 'folder_share') return entry.label.replace(/^Folder collaborator: /, '');
  if (entry.kind === 'folder_link') return entry.label.replace(/^Folder link/, accessKind(entry.kind, t)).replace(/ · last opened .*/, '');
  return entry.label;
}

export function timelineLabel(event: { event_type: string; label: string }, t: TFunction): string {
  switch (event.event_type) {
    case 'uploaded': return t('coherence.trust.uploaded', { defaultValue: 'Encrypted file stored in your vault' });
    case 'secure_drop_received': return t('coherence.trust.received', { defaultValue: 'Received through Secure Drop' });
    case 'shared': return t('coherence.trust.sharedWith', { defaultValue: 'Shared directly with {{name}}', name: event.label.replace(/^Shared directly with /, '') });
    case 'group_shared': return t('coherence.trust.groupShared', { defaultValue: 'Associated with group {{name}}', name: event.label.replace(/^Shared with group /, '') });
    case 'link_created': return t('coherence.trust.linkCreated', { defaultValue: 'File link created' });
    case 'accessed': return t('coherence.trust.fetchCount', { defaultValue: '{{count}} authorized link fetches; reading is not confirmed', count: Number(event.label.match(/\d+/)?.[0] ?? 0) });
    case 'revoked': return t('coherence.trust.linkClosed', { defaultValue: 'File link closed' });
    case 'expired': return t('coherence.trust.linkExpired', { defaultValue: 'File link expired' });
    case 'external_access_revoked': {
      const counts = event.label.match(/Closed (\d+) direct share\(s\) and (\d+) file link\(s\)/);
      return t('coherence.trust.externalAccessClosed', {
        defaultValue: 'Closed {{directCount}} direct shares and {{linkCount}} file links',
        directCount: Number(counts?.[1] ?? 0),
        linkCount: Number(counts?.[2] ?? 0),
      });
    }
    case 'group_removed': return t('coherence.trust.groupRemoved', { defaultValue: 'Group access removed' });
    default: return t('coherence.trust.recordedActivity', { defaultValue: 'Recorded file activity' });
  }
}
