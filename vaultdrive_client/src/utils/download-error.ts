export type TransferFailureKind =
  | "auth"
  | "forbidden"
  | "unavailable"
  | "rate-limit"
  | "service"
  | "network"
  | "metadata"
  | "credential"
  | "missing-key"
  | "unknown";

export interface TransferFailure {
  kind: TransferFailureKind;
  message: string;
  retryable: boolean;
}

type TransferError = Error & { transferFailure?: TransferFailure };

export function createTransferError(
  failure: TransferFailure,
  message = failure.message,
): TransferError {
  const error = new Error(message) as TransferError;
  error.transferFailure = { ...failure, message };
  return error;
}

export function classifyTransferHttpError(status: number): TransferFailure {
  if (status === 401) {
    return { kind: "auth", message: "Your session expired. Sign in again.", retryable: false };
  }
  if (status === 403) {
    return { kind: "forbidden", message: "You do not have permission to access this file.", retryable: false };
  }
  if (status === 404 || status === 410) {
    return { kind: "unavailable", message: "This link has expired or is no longer available.", retryable: false };
  }
  if (status === 429) {
    return { kind: "rate-limit", message: "Too many attempts. Wait a moment, then try again.", retryable: true };
  }
  if (status >= 500) {
    return { kind: "service", message: "The service is temporarily unavailable.", retryable: true };
  }
  return { kind: "unknown", message: `Transfer failed (HTTP ${status}).`, retryable: false };
}

export function classifyTransferError(error: unknown): TransferFailure {
  if (error instanceof Error && (error as TransferError).transferFailure) {
    return (error as TransferError).transferFailure!;
  }
  if (
    error instanceof TypeError &&
    /failed to fetch|network(?:error| request failed)|load failed/i.test(error.message)
  ) {
    return {
      kind: "network",
      message: "The service could not be reached. Check your connection and try again.",
      retryable: true,
    };
  }
  return {
    kind: "unknown",
    message: error instanceof Error ? error.message : "Transfer failed.",
    retryable: false,
  };
}

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
