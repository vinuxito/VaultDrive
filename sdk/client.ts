export interface ABRNClientOptions {
  baseUrl: string;
  apiKey: string;
}

export interface PaginationMeta {
  count: number;
  limit: number;
  offset: number;
}

export interface V1Response<T> {
  success: boolean;
  data: T;
  error?: string;
  meta: {
    request_id: string;
    pagination?: PaginationMeta;
  };
}

export interface FileRecord {
  id: string;
  filename: string;
  file_size: number;
  created_at: string;
  updated_at?: string;
  starred: boolean;
  origin?: string;
  metadata?: string;
}

export interface FolderRecord {
  id: string;
  name: string;
  created_at: string;
  updated_at?: string;
}

export interface AgentKeyRecord {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  status: string;
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
  usage_count: number;
  plaintext_key?: string;
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
}

export interface DownloadResult {
  ciphertext: ArrayBuffer;
  wrappedKey: string;
  fileMetadata: string;
  filename: string;
}

export class ABRNClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(options: ABRNClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      ...extra,
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<V1Response<T>> {
    const url = `${this.baseUrl}/v1${path}`;
    const init: RequestInit = {
      method,
      headers: this.headers(body ? { "Content-Type": "application/json" } : undefined),
    };
    if (body) init.body = JSON.stringify(body);
    const res = await fetch(url, init);
    const json = await res.json();
    if (!res.ok) {
      const err = new Error(json.error ?? `HTTP ${res.status}`);
      (err as unknown as Record<string, unknown>).response = json;
      throw err;
    }
    return json as V1Response<T>;
  }

  async introspect(): Promise<V1Response<IntrospectResult>> {
    return this.request("GET", "/auth/introspect");
  }

  async listFiles(query?: string): Promise<V1Response<FileRecord[]>> {
    const qs = query ? `?q=${encodeURIComponent(query)}` : "";
    return this.request("GET", `/files${qs}`);
  }

  async getFile(fileId: string): Promise<V1Response<FileRecord>> {
    return this.request("GET", `/files/${fileId}`);
  }

  async downloadFile(fileId: string): Promise<DownloadResult> {
    const url = `${this.baseUrl}/v1/files/${fileId}/download`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Download failed: HTTP ${res.status} ${text}`);
    }
    return {
      ciphertext: await res.arrayBuffer(),
      wrappedKey: res.headers.get("X-Wrapped-Key") ?? "",
      fileMetadata: res.headers.get("X-File-Metadata") ?? "",
      filename: (res.headers.get("Content-Disposition") ?? "").replace(/.*filename="?([^"]*)"?.*/, "$1"),
    };
  }

  async listFolders(): Promise<V1Response<FolderRecord[]>> {
    return this.request("GET", "/folders");
  }

  async createFolder(name: string): Promise<V1Response<FolderRecord>> {
    return this.request("POST", "/folders", { name });
  }

  async getFileTrust(fileId: string): Promise<V1Response<TrustSummary>> {
    return this.request("GET", `/files/${fileId}/trust`);
  }

  async getFileTimeline(fileId: string): Promise<V1Response<unknown[]>> {
    return this.request("GET", `/files/${fileId}/timeline`);
  }

  async getFileAccessSummary(fileId: string): Promise<V1Response<unknown>> {
    return this.request("GET", `/files/${fileId}/access-summary`);
  }

  async listAudit(options?: {
    limit?: number;
    offset?: number;
    resource_type?: string;
    resource_id?: string;
  }): Promise<V1Response<AuditEntry[]>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    if (options?.resource_type) params.set("resource_type", options.resource_type);
    if (options?.resource_id) params.set("resource_id", options.resource_id);
    const qs = params.toString() ? `?${params}` : "";
    return this.request("GET", `/audit${qs}`);
  }

  async listAgentKeys(): Promise<V1Response<AgentKeyRecord[]>> {
    return this.request("GET", "/agent-keys");
  }

  async createAgentKey(options: {
    name: string;
    scopes: string[];
    notes?: string;
    expires_at?: string;
  }): Promise<V1Response<AgentKeyRecord>> {
    return this.request("POST", "/agent-keys", options);
  }

  async revokeAgentKey(keyId: string): Promise<V1Response<unknown>> {
    return this.request("DELETE", `/agent-keys/${keyId}`);
  }
}
