/**
 * Format Utilities
 * VaultDrive v2.0 - Phase 2D: Files Page
 */

/**
 * Format file size in human-readable format
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export const formatBytes = formatSize;

/**
 * Format date in human-readable format
 */
export function formatDate(dateString: string, locale = 'en'): string {
  const date = new Date(dateString);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString(locale, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function relativeTime(dateString: string, locale = 'en'): string {
  const timestamp = new Date(dateString).getTime();
  if (!Number.isFinite(timestamp)) return '—';
  const seconds = (timestamp - Date.now()) / 1000;
  if (Math.abs(seconds) >= 7 * 86400) return new Date(timestamp).toLocaleDateString(locale);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]] as const) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return formatter.format(0, 'second');
}

/**
 * Mask encryption key for display (show only first 5 chars)
 */
export function maskKey(key: string): string {
  if (!key || key.length <= 5) return key;
  return key.substring(0, 5) + '*'.repeat(Math.min(key.length - 5, 20));
}
