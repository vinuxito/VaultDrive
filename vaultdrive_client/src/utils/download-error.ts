export function mapDownloadHttpError(status: number): string {
  if (status === 401) {
    return "Your session expired. Sign in again.";
  }
  if (status === 403) {
    return "You do not have permission to download this file.";
  }
  if (status === 404 || status === 410) {
    return "This file is no longer available.";
  }
  if (status >= 500) {
    return "File is temporarily unavailable from storage.";
  }
  return `Download failed (HTTP ${status}).`;
}
