export type OwnerUploadOutcome =
  | { kind: "confirmed"; fileId: string }
  | { kind: "failed"; message: string }
  | { kind: "unknown"; message: string };

export async function readOwnerUploadOutcome(response: Response): Promise<OwnerUploadOutcome> {
  if (response.status === 401) return { kind: "failed", message: "Your session expired before the upload was accepted." };
  if (response.status >= 400 && response.status < 500) {
    return { kind: "failed", message: `The server rejected this upload (${response.status}).` };
  }
  if (response.status >= 500) {
    return { kind: "unknown", message: "The server did not confirm whether it stored this upload. Do not resend it yet." };
  }
  if (response.status !== 201) {
    return { kind: "unknown", message: `The upload returned an unexpected status (${response.status}). Do not resend it yet.` };
  }
  try {
    const receipt = await response.json() as { file_id?: unknown };
    if (typeof receipt.file_id === "string" && receipt.file_id.length > 0) {
      return { kind: "confirmed", fileId: receipt.file_id };
    }
  } catch {
    // The request may have committed even though its receipt was malformed.
  }
  return { kind: "unknown", message: "The upload response had no valid file receipt. Do not resend it yet." };
}
