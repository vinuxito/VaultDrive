export interface AbrnDriveClientOptions {
  baseUrl: string;
  apiKey: string;
  maxRateLimitRetries?: number;
  maxRetryDelayMs?: number;
  fetchFn?: typeof fetch;
}

export type QuantixClientOptions = AbrnDriveClientOptions;

export interface PaginationMeta {
  count: number;
  total?: number;
  limit: number;
  offset: number;
}

export interface V1ErrorObject {
  code?: string;
  message: string;
}

export interface V1Response<T> {
  success: boolean;
  data: T;
  error?: V1ErrorObject | null;
  replayed?: boolean;
  meta: {
    request_id?: string;
    pagination?: PaginationMeta;
  };
}

export class AbrnApiError extends Error {
  status: number;
  code: string;
  requestId?: string;
  raw?: unknown;

  constructor(options: { status: number; code?: string; message: string; requestId?: string; raw?: unknown }) {
    super(options.message);
    this.name = "AbrnApiError";
    this.status = options.status;
    this.code = options.code || `http_${options.status}`;
    this.requestId = options.requestId;
    this.raw = options.raw;
  }
}

export interface FileRecord {
  id: string;
  filename: string;
  file_size: number;
  folder_id?: string | null;
  created_at: string;
  updated_at?: string;
  starred?: boolean;
  origin?: string;
  metadata?: string;
  is_owner?: boolean;
  shared_via?: string;
  wrapped_key?: string;
  folder_wrapped_key?: string;
}

export interface FolderRecord {
  id: string;
  name: string;
  parent_id?: string | null;
  parentId?: string | null;
  created_at: string;
  updated_at?: string;
  owner_id?: string;
  wrapped_folder_key?: string;
}

export interface AgentKeyRecord {
  id: string;
  name: string;
  key_prefix: string;
  key_kind?: "standard" | "delete_only";
  scopes: string[];
  allowed_folder_ids?: string[];
  allowed_ips?: string[];
  rate_limit_rpm?: number;
  status: string;
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
  usage_count: number;
  plaintext_key?: string;
  notes?: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface TrustSummary {
  file_id: string;
  protection: string;
  owner_label: string;
  visibility_summary: string;
  access_state: string;
  origin: string;
  latest_activity: string;
}

export interface IntrospectResult {
  auth_type: string;
  user_id: string;
  scopes: string[];
  key_id?: string;
  key_kind?: "standard" | "delete_only";
  allowed_folder_ids?: string[];
  allowed_ips?: string[];
  rate_limit_rpm?: number;
  owner_public_key?: string;
}

export interface PublicKeyRecord {
  user_id: string;
  email: string;
  public_key: string;
  kek_envelope_version?: number;
}

export interface DownloadResult {
  ciphertext: ArrayBuffer;
  wrappedKey: string;
  folderWrappedKey: string;
  credentialScheme: string;
  fileMetadata: string;
  filename: string;
}

export interface RequestOptions {
  idempotencyKey?: string;
  headers?: Record<string, string>;
}

function normalizeApiBase(rawBase: string): string {
  const trimmed = rawBase.replace(/\/+$/, "");
  if (trimmed.endsWith("/v1")) {
    return trimmed.slice(0, -3);
  }
  return trimmed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseErrorPayload(rawText: string, status: number): { code?: string; message: string; requestId?: string; raw?: unknown } {
  if (!rawText) {
    return { message: `HTTP ${status}` };
  }
  try {
    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    const meta = (parsed.meta && typeof parsed.meta === "object" ? parsed.meta : undefined) as Record<string, unknown> | undefined;
    const requestId = typeof meta?.request_id === "string" ? meta.request_id : undefined;

    if (parsed.error && typeof parsed.error === "object") {
      const errObj = parsed.error as Record<string, unknown>;
      return {
        code: typeof errObj.code === "string" ? errObj.code : undefined,
        message: typeof errObj.message === "string" && errObj.message ? errObj.message : `HTTP ${status}`,
        requestId,
        raw: parsed,
      };
    }
    if (typeof parsed.error === "string" && parsed.error) {
      return {
        code: typeof parsed.code === "string" ? parsed.code : undefined,
        message: parsed.error,
        requestId,
        raw: parsed,
      };
    }
    if (typeof parsed.message === "string" && parsed.message) {
      return {
        code: typeof parsed.code === "string" ? parsed.code : undefined,
        message: parsed.message,
        requestId,
        raw: parsed,
      };
    }
    return { message: `HTTP ${status}`, requestId, raw: parsed };
  } catch {
    return { message: rawText || `HTTP ${status}` };
  }
}

export class AbrnDriveClient {
  private baseUrl: string;
  private apiKey: string;
  private maxRateLimitRetries: number;
  private maxRetryDelayMs: number;
  private fetchImpl: typeof fetch;

  constructor(options: AbrnDriveClientOptions) {
    this.baseUrl = normalizeApiBase(options.baseUrl);
    this.apiKey = options.apiKey;
    this.maxRateLimitRetries = options.maxRateLimitRetries ?? 2;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? 5000;
    this.fetchImpl = options.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      ...extra,
    };
  }

  private async fetchWithRetry(url: string, initFactory: () => RequestInit): Promise<Response> {
    let attempt = 0;
    while (true) {
      const res = await this.fetchImpl(url, initFactory());
      if (res.status === 429 && attempt < this.maxRateLimitRetries) {
        const rawRetryAfter = Number(res.headers.get("Retry-After") ?? "1");
        const delayMs = Math.max(50, Math.min(this.maxRetryDelayMs, (Number.isFinite(rawRetryAfter) && rawRetryAfter > 0 ? rawRetryAfter : 1) * 1000));
        attempt += 1;
        await sleep(delayMs);
        continue;
      }
      return res;
    }
  }

  private async request<T>(method: string, path: string, body?: unknown, opts?: RequestOptions): Promise<V1Response<T>> {
    const url = `${this.baseUrl}/v1${path}`;
    const res = await this.fetchWithRetry(url, () => {
      const extraHeaders: Record<string, string> = { ...(opts?.headers ?? {}) };
      if (body !== undefined) {
        extraHeaders["Content-Type"] = "application/json";
      }
      if (opts?.idempotencyKey) {
        extraHeaders["Idempotency-Key"] = opts.idempotencyKey;
      }
      const init: RequestInit = {
        method,
        headers: this.headers(extraHeaders),
      };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }
      return init;
    });

    const rawText = await res.text();
    if (!res.ok) {
      const parsedErr = parseErrorPayload(rawText, res.status);
      throw new AbrnApiError({
        status: res.status,
        code: parsedErr.code,
        message: parsedErr.message,
        requestId: parsedErr.requestId,
        raw: parsedErr.raw,
      });
    }

    const parsed = (rawText ? JSON.parse(rawText) : { success: true, data: null, meta: {} }) as V1Response<T>;
    if (res.headers.get("X-Idempotency-Replayed") === "true") {
      parsed.replayed = true;
    }
    return parsed;
  }

  // Auth & Public Keys
  async introspect(): Promise<V1Response<IntrospectResult>> {
    return this.request("GET", "/auth/introspect");
  }

  async getMyPublicKey(): Promise<V1Response<PublicKeyRecord>> {
    return this.request("GET", "/users/me/public-key");
  }

  async getUserPublicKey(userId: string): Promise<V1Response<PublicKeyRecord>> {
    return this.request("GET", `/users/${encodeURIComponent(userId)}/public-key`);
  }

  // Agent Key Management & Child Key Attenuation
  async listAgentKeys(): Promise<V1Response<AgentKeyRecord[]>> {
    return this.request("GET", "/agent-keys");
  }

  async createAgentKey(
    options: {
      name: string;
      scopes?: string[];
      key_kind?: "standard" | "delete_only";
      notes?: string;
      expires_at?: string;
      allowed_folder_ids?: string[];
      allowed_ips?: string[];
      rate_limit_rpm?: number;
    },
    opts?: RequestOptions
  ): Promise<V1Response<AgentKeyRecord>> {
    return this.request("POST", "/agent-keys", options, opts);
  }

  async revokeAgentKey(keyId: string): Promise<V1Response<unknown>> {
    return this.request("DELETE", `/agent-keys/${encodeURIComponent(keyId)}`);
  }

  // Files Data Plane
  async listFiles(
    options?: string | { q?: string; search?: string; folderId?: string; limit?: number; offset?: number }
  ): Promise<V1Response<FileRecord[]>> {
    const params = new URLSearchParams();
    if (typeof options === "string") {
      if (options) params.set("q", options);
    } else if (options) {
      if (options.q) params.set("q", options.q);
      if (options.search) params.set("search", options.search);
      if (options.folderId) params.set("folder_id", options.folderId);
      if (options.limit !== undefined) params.set("limit", String(options.limit));
      if (options.offset !== undefined) params.set("offset", String(options.offset));
    }
    const qs = params.toString() ? `?${params}` : "";
    return this.request("GET", `/files${qs}`);
  }

  async listSharedFiles(options?: { search?: string; limit?: number; offset?: number }): Promise<V1Response<FileRecord[]>> {
    const params = new URLSearchParams();
    if (options?.search) params.set("search", options.search);
    if (options?.limit !== undefined) params.set("limit", String(options.limit));
    if (options?.offset !== undefined) params.set("offset", String(options.offset));
    const qs = params.toString() ? `?${params}` : "";
    return this.request("GET", `/files/shared${qs}`);
  }

  async getFile(fileId: string): Promise<V1Response<FileRecord>> {
    return this.request("GET", `/files/${encodeURIComponent(fileId)}`);
  }

  async uploadEncryptedFile(formData: FormData, opts?: RequestOptions): Promise<V1Response<FileRecord>> {
    const url = `${this.baseUrl}/v1/files/upload`;
    const extra: Record<string, string> = { ...(opts?.headers ?? {}) };
    if (opts?.idempotencyKey) {
      extra["Idempotency-Key"] = opts.idempotencyKey;
    }
    const res = await this.fetchWithRetry(url, () => ({
      method: "POST",
      headers: this.headers(extra),
      body: formData,
    }));
    const rawText = await res.text();
    if (!res.ok) {
      const parsedErr = parseErrorPayload(rawText, res.status);
      throw new AbrnApiError({
        status: res.status,
        code: parsedErr.code,
        message: parsedErr.message,
        requestId: parsedErr.requestId,
        raw: parsedErr.raw,
      });
    }
    return JSON.parse(rawText) as V1Response<FileRecord>;
  }

  async downloadFile(fileId: string): Promise<DownloadResult> {
    const url = `${this.baseUrl}/v1/files/${encodeURIComponent(fileId)}/download`;
    const res = await this.fetchWithRetry(url, () => ({
      method: "GET",
      headers: this.headers(),
    }));
    if (!res.ok) {
      const rawText = await res.text().catch(() => "");
      const parsedErr = parseErrorPayload(rawText, res.status);
      throw new AbrnApiError({
        status: res.status,
        code: parsedErr.code,
        message: parsedErr.message,
        requestId: parsedErr.requestId,
        raw: parsedErr.raw,
      });
    }
    const contentDisposition = res.headers.get("Content-Disposition") ?? "";
    const match = contentDisposition.match(/filename="?([^";]+)"?/i);
    return {
      ciphertext: await res.arrayBuffer(),
      wrappedKey: res.headers.get("X-Wrapped-Key") ?? "",
      folderWrappedKey: res.headers.get("X-Folder-Wrapped-Key") ?? "",
      credentialScheme: res.headers.get("X-Credential-Scheme") ?? "",
      fileMetadata: res.headers.get("X-File-Metadata") ?? "",
      filename: match ? match[1] : "",
    };
  }

  async moveFile(
    fileId: string,
    folderId: string,
    extra?: { new_wrapped_key?: string; wrapped_key?: string; credential_scheme?: string },
    opts?: RequestOptions
  ): Promise<V1Response<unknown>> {
    return this.request(
      "PUT",
      `/files/${encodeURIComponent(fileId)}/folder`,
      { folder_id: folderId, ...(extra ?? {}) },
      opts
    );
  }

  async syncFiles(
    actions: Array<{ type: "rename" | "delete"; file_id: string; filename?: string; reason?: string }>,
    opts?: RequestOptions
  ): Promise<V1Response<unknown>> {
    return this.request("POST", "/files/sync", { actions }, opts);
  }

  // Recoverable Trash Soft-Delete (requires Special Delete-Only key abrnak_del_... or human JWT)
  async softDeleteFile(fileId: string, reason?: string): Promise<V1Response<{ id: string; deleted_at: string; recoverable: boolean; deleted_reason?: string }>> {
    const qs = reason ? `?reason=${encodeURIComponent(reason)}` : "";
    return this.request(
      "DELETE",
      `/files/${encodeURIComponent(fileId)}${qs}`,
      reason ? { reason } : undefined
    );
  }

  async softDeleteFolder(folderId: string, reason?: string): Promise<V1Response<{ id: string; deleted_at: string; recoverable: boolean; deleted_reason?: string }>> {
    const qs = reason ? `?reason=${encodeURIComponent(reason)}` : "";
    return this.request(
      "DELETE",
      `/folders/${encodeURIComponent(folderId)}${qs}`,
      reason ? { reason } : undefined
    );
  }

  // Folders
  async listFolders(): Promise<V1Response<FolderRecord[]>> {
    return this.request("GET", "/folders");
  }

  async listSharedFolders(): Promise<V1Response<FolderRecord[]>> {
    return this.request("GET", "/folders/shared");
  }

  async listFolderFiles(folderId: string): Promise<V1Response<FileRecord[]>> {
    return this.request("GET", `/folders/${encodeURIComponent(folderId)}/files`);
  }

  async createFolder(
    input: string | { name: string; parentId?: string },
    opts?: RequestOptions
  ): Promise<V1Response<FolderRecord>> {
    const body = typeof input === "string" ? { name: input } : input;
    return this.request("POST", "/folders", body, opts);
  }

  async updateFolder(
    folderId: string,
    input: { name: string; parentId?: string },
    opts?: RequestOptions
  ): Promise<V1Response<FolderRecord>> {
    return this.request("PUT", `/folders/${encodeURIComponent(folderId)}`, input, opts);
  }

  // Trust & Access Control
  async getFileTrust(fileId: string): Promise<V1Response<TrustSummary>> {
    return this.request("GET", `/files/${encodeURIComponent(fileId)}/trust`);
  }

  async getFileTimeline(fileId: string): Promise<V1Response<unknown[]>> {
    return this.request("GET", `/files/${encodeURIComponent(fileId)}/timeline`);
  }

  async getFileAccessSummary(fileId: string): Promise<V1Response<unknown>> {
    return this.request("GET", `/files/${encodeURIComponent(fileId)}/access-summary`);
  }

  async listFileShares(fileId: string): Promise<V1Response<unknown[]>> {
    return this.request("GET", `/files/${encodeURIComponent(fileId)}/shares`);
  }

  async revokeFileAccess(fileId: string, userId: string): Promise<V1Response<unknown>> {
    return this.request("DELETE", `/files/${encodeURIComponent(fileId)}/revoke/${encodeURIComponent(userId)}`);
  }

  async revokeExternalAccess(fileId: string): Promise<V1Response<unknown>> {
    return this.request("DELETE", `/files/${encodeURIComponent(fileId)}/revoke-external`);
  }

  // Shares & Public Links
  async listShares(): Promise<V1Response<unknown[]>> {
    return this.request("GET", "/shares");
  }

  async listPublicShareLinks(fileId: string): Promise<V1Response<unknown[]>> {
    return this.request("GET", `/files/${encodeURIComponent(fileId)}/share-links`);
  }

  async createPublicShareLink(
    fileId: string,
    body: {
      expires_at?: string;
      pin_salt?: string;
      pin_verifier_hash?: string;
      wrapped_key?: string;
      max_downloads?: number;
      allow_download?: boolean;
    },
    opts?: RequestOptions
  ): Promise<V1Response<unknown>> {
    return this.request("POST", `/files/${encodeURIComponent(fileId)}/share-link`, body, opts);
  }

  async revokePublicShareLink(linkId: string): Promise<V1Response<unknown>> {
    return this.request("DELETE", `/share-links/${encodeURIComponent(linkId)}`);
  }

  async createFolderShareLink(
    folderId: string,
    body: {
      expires_at?: string;
      wrapped_keys: Record<string, string>;
      owner_wrapped_folder_key: string;
    },
    opts?: RequestOptions
  ): Promise<V1Response<unknown>> {
    return this.request("POST", `/folders/${encodeURIComponent(folderId)}/share-link`, body, opts);
  }

  async listFolderShareLinks(folderId: string): Promise<V1Response<unknown[]>> {
    return this.request("GET", `/folders/${encodeURIComponent(folderId)}/share-links`);
  }

  async revokeFolderShareLink(linkId: string): Promise<V1Response<unknown>> {
    return this.request("DELETE", `/folder-share-links/${encodeURIComponent(linkId)}`);
  }

  // File Requests & Secure Drops
  async listFileRequests(): Promise<V1Response<unknown[]>> {
    return this.request("GET", "/file-requests");
  }

  async createFileRequest(
    body: { title: string; description?: string; expires_at?: string; max_files?: number },
    opts?: RequestOptions
  ): Promise<V1Response<unknown>> {
    return this.request("POST", "/file-requests", body, opts);
  }

  async revokeFileRequest(id: string): Promise<V1Response<unknown>> {
    return this.request("DELETE", `/file-requests/${encodeURIComponent(id)}`);
  }

  async listDropTokens(): Promise<V1Response<unknown[]>> {
    return this.request("GET", "/drop/tokens");
  }

  async createDropToken(
    body: {
      target_folder_id: string;
      link_name?: string;
      description?: string;
      expires_at?: string;
      max_files?: number;
      pin?: string;
      seal_after_upload?: boolean;
    },
    opts?: RequestOptions
  ): Promise<V1Response<unknown>> {
    return this.request("POST", "/drop/create", body, opts);
  }

  async listCollectionTemplates(): Promise<V1Response<unknown[]>> {
    return this.request("GET", "/collection-templates");
  }

  // Audit & Activity
  async listAudit(options?: {
    limit?: number;
    offset?: number;
    action?: string;
    resource_type?: string;
    resource_id?: string;
  }): Promise<V1Response<AuditEntry[]>> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) params.set("limit", String(options.limit));
    if (options?.offset !== undefined) params.set("offset", String(options.offset));
    if (options?.action) params.set("action", options.action);
    if (options?.resource_type) params.set("resource_type", options.resource_type);
    if (options?.resource_id) params.set("resource_id", options.resource_id);
    const qs = params.toString() ? `?${params}` : "";
    return this.request("GET", `/audit${qs}`);
  }

  async listActivity(options?: { limit?: number; offset?: number }): Promise<V1Response<unknown[]>> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) params.set("limit", String(options.limit));
    if (options?.offset !== undefined) params.set("offset", String(options.offset));
    const qs = params.toString() ? `?${params}` : "";
    return this.request("GET", `/activity${qs}`);
  }
}

// Backward-compatible alias for earlier callers
export const QuantixClient = AbrnDriveClient;
