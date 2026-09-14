export type PublicUploadEndpoint = "drop" | "file-request";
export type PublicUploadStatus =
  | "pending"
  | "uploading"
  | "success"
  | "error"
  | "unknown"
  | "cancelled";

export interface PublicUploadProgress {
  id: string;
  fileName: string;
  status: PublicUploadStatus;
  progress: number;
  bytesUploaded: number;
  bytesTotal: number;
  error?: string;
  retryable?: boolean;
}

interface PublicUploadOutcomeInput {
  endpoint: PublicUploadEndpoint;
  event: "load" | "network" | "timeout" | "abort" | "prepare-error";
  status: number;
  responseText: string;
  requestSent: boolean;
  errorMessage?: string;
}

export interface PublicUploadOutcome {
  status: Extract<PublicUploadStatus, "success" | "error" | "unknown" | "cancelled">;
  retryable: boolean;
  message?: string;
}

const AMBIGUOUS_MESSAGE =
  "The server response did not confirm whether this file was accepted. Ask the recipient to check before sending it again.";

function readErrorMessage(responseText: string): string | undefined {
  try {
    const value = JSON.parse(responseText) as unknown;
    if (
      typeof value === "object" &&
      value !== null &&
      "error" in value &&
      typeof value.error === "string" &&
      value.error.trim()
    ) {
      return value.error;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function hasAcceptedReceipt(endpoint: PublicUploadEndpoint, responseText: string): boolean {
  try {
    const value = JSON.parse(responseText) as Record<string, unknown>;
    if (!value || typeof value !== "object") return false;

    if (endpoint === "drop") {
      return value.success === true &&
        typeof value.uploaded === "number" &&
        value.uploaded === 1 &&
        Array.isArray(value.files) &&
        value.files.some((file) => {
          if (!file || typeof file !== "object") return false;
          const row = file as Record<string, unknown>;
          return typeof row.file_id === "string" && row.file_id.length > 0 && !row.error;
        });
    }

    return value.count === 1 &&
      Array.isArray(value.uploaded) &&
      value.uploaded.some((file) => {
        if (!file || typeof file !== "object") return false;
        const row = file as Record<string, unknown>;
        return typeof row.file_id === "string" && row.file_id.length > 0;
      });
  } catch {
    return false;
  }
}

export function classifyPublicUploadOutcome(input: PublicUploadOutcomeInput): PublicUploadOutcome {
  if (input.event === "abort") {
    return { status: "cancelled", retryable: false, message: "Upload cancelled." };
  }

  if (input.event === "prepare-error" || !input.requestSent) {
    return {
      status: "error",
      retryable: true,
      message: input.errorMessage || "The file could not be prepared for upload.",
    };
  }

  if (
    input.event === "network" ||
    input.event === "timeout" ||
    input.status === 0 ||
    input.status >= 500
  ) {
    return { status: "unknown", retryable: false, message: AMBIGUOUS_MESSAGE };
  }

  if (input.status >= 200 && input.status < 300) {
    if (hasAcceptedReceipt(input.endpoint, input.responseText)) {
      return { status: "success", retryable: false };
    }
    return { status: "unknown", retryable: false, message: AMBIGUOUS_MESSAGE };
  }

  const message = readErrorMessage(input.responseText) || `Upload rejected (HTTP ${input.status}).`;
  return {
    status: "error",
    retryable: input.status === 408 || input.status === 429,
    message,
  };
}

export function getRetryableUploadIds(rows: PublicUploadProgress[]): string[] {
  return rows
    .filter((row) => row.status === "error" && row.retryable === true)
    .map((row) => row.id);
}
