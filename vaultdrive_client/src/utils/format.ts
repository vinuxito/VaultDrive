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

/**
 * Format date in human-readable format
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Mask encryption key for display (show only first 5 chars)
 */
export function maskKey(key: string): string {
  if (!key || key.length <= 5) return key;
  return key.substring(0, 5) + '*'.repeat(Math.min(key.length - 5, 20));
}
