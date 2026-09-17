const OPERATIONS = ["access_check", "access_revoke", "service_status"] as const;
const CONFIRMATIONS = ["confirmed", "confirmed_stale", "unknown", "not_applicable"] as const;
const ERROR_CLASSES = ["timeout", "http_4xx", "http_5xx", "network_error", "invalid_response", "session_missing", "aborted", "unknown"] as const;

export type SupportOperation = (typeof OPERATIONS)[number];
export type SupportConfirmation = (typeof CONFIRMATIONS)[number];
export type SupportErrorClass = (typeof ERROR_CLASSES)[number];

export interface SanitizedSupportDetails {
  app: "ABRN Drive";
  build: string;
  time: string;
  operation: SupportOperation;
  confirmation: SupportConfirmation;
  requestId: string;
  errorClass: SupportErrorClass;
}

interface SupportDetailsInput {
  operation: unknown;
  confirmation: unknown;
  requestId?: unknown;
  errorClass?: unknown;
  buildId?: unknown;
  now?: Date;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUILD_HASH_PATTERN = /^[0-9a-f]{7,64}$/i;
const trustedDetails = new WeakSet<object>();

function allowEnum<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === "string" && allowed.includes(value) ? value as T[number] : fallback;
}

function validISOTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString() === value ? value : null;
}

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

export function sanitizeSupportDetails(value: unknown): SanitizedSupportDetails {
  const input = recordOf(value);
  const trusted = trustedDetails.has(input);
  const details: SanitizedSupportDetails = {
    app: "ABRN Drive",
    build: trusted && typeof input.build === "string" && BUILD_HASH_PATTERN.test(input.build) ? input.build : "unknown",
    time: trusted ? validISOTime(input.time) ?? new Date().toISOString() : new Date().toISOString(),
    operation: allowEnum(input.operation, OPERATIONS, "service_status"),
    confirmation: allowEnum(input.confirmation, CONFIRMATIONS, "unknown"),
    requestId: trusted && typeof input.requestId === "string" && UUID_PATTERN.test(input.requestId) ? input.requestId : "unknown",
    errorClass: allowEnum(input.errorClass, ERROR_CLASSES, "unknown"),
  };
  if (trusted) trustedDetails.add(details);
  return details;
}

export function createSupportDetails(input: SupportDetailsInput): SanitizedSupportDetails {
  const details: SanitizedSupportDetails = {
    app: "ABRN Drive",
    build: typeof input.buildId === "string" && BUILD_HASH_PATTERN.test(input.buildId) ? input.buildId : "unknown",
    time: input.now instanceof Date && Number.isFinite(input.now.getTime()) ? input.now.toISOString() : new Date().toISOString(),
    operation: allowEnum(input.operation, OPERATIONS, "service_status"),
    confirmation: allowEnum(input.confirmation, CONFIRMATIONS, "unknown"),
    requestId: typeof input.requestId === "string" && UUID_PATTERN.test(input.requestId) ? input.requestId : "unknown",
    errorClass: allowEnum(input.errorClass, ERROR_CLASSES, "unknown"),
  };
  trustedDetails.add(details);
  return details;
}

export function serializeSupportDetails(value: unknown): string {
  const details = sanitizeSupportDetails(value);
  return [
    `App: ${details.app}`,
    `Build: ${details.build}`,
    `Time: ${details.time}`,
    `Operation: ${details.operation}`,
    `Confirmation: ${details.confirmation}`,
    `Request ID: ${details.requestId}`,
    `Error class: ${details.errorClass}`,
  ].join("\n");
}
