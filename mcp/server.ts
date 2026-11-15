import {
  AbrnDriveClient,
  AbrnApiError,
  encryptAndUploadForOwner,
  downloadAndDecryptWithPrivateKey,
  base64ToArrayBuffer,
  arrayBufferToBase64,
} from "../sdk/index.ts";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface McpServerConfig {
  baseUrl?: string;
  apiKey?: string;
  deleteApiKey?: string;
  rsaPrivateKeyPem?: string;
  fetchFn?: typeof fetch;
}

export interface AbrnMcpContext {
  baseUrl: string;
  standardClient: AbrnDriveClient | null;
  deleteClient: AbrnDriveClient | null;
  rsaPrivateKeyPem: string;
}

export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const MCP_SERVER_INFO = {
  name: "abrn-drive-mcp",
  version: "2.0.0",
};

export function validateMcpEnvironment(env: NodeJS.ProcessEnv | Record<string, string | undefined>): void {
  if (env.ABRN_PASSWORD && env.ABRN_PASSWORD.trim() !== "") {
    throw new Error(
      "Security policy violation: ABRN_PASSWORD is forbidden in MCP server environment. Use zero-knowledge scoped keys (ABRN_API_KEY / ABRN_DELETE_API_KEY) instead."
    );
  }
  if (env.ABRN_PIN && env.ABRN_PIN.trim() !== "") {
    throw new Error(
      "Security policy violation: ABRN_PIN is forbidden in MCP server environment. MCP operates with scoped bearer keys only."
    );
  }
}

export function loadConfigFromEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>): McpServerConfig {
  validateMcpEnvironment(env);
  const rawPem = env.ABRN_RSA_PRIVATE_KEY_PEM?.trim() ?? "";
  return {
    baseUrl: env.ABRN_BASE_URL?.trim() || "https://abrn.mx/abrn/api",
    apiKey: env.ABRN_API_KEY?.trim() || "",
    deleteApiKey: env.ABRN_DELETE_API_KEY?.trim() || "",
    rsaPrivateKeyPem: rawPem.includes("\\n") ? rawPem.replace(/\\n/g, "\n") : rawPem,
  };
}

export function createMcpContext(config: McpServerConfig): AbrnMcpContext {
  const baseUrl = config.baseUrl?.trim() || "https://abrn.mx/abrn/api";
  const standardClient = config.apiKey?.trim()
    ? new AbrnDriveClient({
        baseUrl,
        apiKey: config.apiKey.trim(),
        fetchFn: config.fetchFn,
      })
    : null;

  // Special Delete-Only client MUST come strictly from ABRN_DELETE_API_KEY (never fallback to ABRN_API_KEY).
  const deleteClient = config.deleteApiKey?.trim()
    ? new AbrnDriveClient({
        baseUrl,
        apiKey: config.deleteApiKey.trim(),
        fetchFn: config.fetchFn,
      })
    : null;

  return {
    baseUrl,
    standardClient,
    deleteClient,
    rsaPrivateKeyPem: config.rsaPrivateKeyPem?.trim() || "",
  };
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "abrn_whoami",
    description:
      "Introspect active ABRN Drive credentials (standard and optional delete-only keys), returning actor type, key_kind, scopes, and guardrail limits (allowed_folder_ids, allowed_ips, rate_limit_rpm).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "abrn_list_files",
    description: "List encrypted files in the vault (automatically constrained by folder jail if configured).",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Optional filename search query" },
        folder_id: { type: "string", description: "Optional folder UUID filter" },
        limit: { type: "number", description: "Max items per page" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "abrn_list_shared_files",
    description: "List encrypted files shared with the authenticated vault user.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
  },
  {
    name: "abrn_list_folders",
    description: "List folders accessible to the current API key.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "abrn_list_shared_folders",
    description: "List folders shared with the authenticated user.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "abrn_list_folder_files",
    description: "List encrypted files inside a specific folder UUID (respects folder jail).",
    inputSchema: {
      type: "object",
      properties: {
        folder_id: { type: "string", description: "Target folder UUID" },
      },
      required: ["folder_id"],
    },
  },
  {
    name: "abrn_get_file_trust",
    description: "Retrieve zero-knowledge trust summary, key wrapping mode, and integrity metadata for a file.",
    inputSchema: {
      type: "object",
      properties: {
        file_id: { type: "string", description: "Target file UUID" },
      },
      required: ["file_id"],
    },
  },
  {
    name: "abrn_list_audit",
    description: "Read tamper-evident audit trail events (including guardrail denials and soft-deletes).",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string" },
        file_id: { type: "string", description: "Optional file resource UUID filter" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
  },
  {
    name: "abrn_upload_encrypted_file",
    description:
      "Encrypt plaintext client-side with AES-256-GCM + RSA-OAEP using the vault owner's SPKI public key, compute plaintext SHA-256, and upload only ciphertext.",
    inputSchema: {
      type: "object",
      properties: {
        filename: { type: "string", description: "Target filename" },
        content_utf8: { type: "string", description: "Plaintext UTF-8 file content (mutually exclusive with content_base64)" },
        content_base64: { type: "string", description: "Base64-encoded binary content (mutually exclusive with content_utf8)" },
        folder_id: { type: "string", description: "Optional target folder UUID" },
        mime_type: { type: "string", description: "MIME type (default application/octet-stream)" },
        idempotency_key: { type: "string", description: "Optional Idempotency-Key header" },
      },
      required: ["filename"],
    },
  },
  {
    name: "abrn_download_and_decrypt_file",
    description:
      "Download ciphertext from ABRN Drive, unwrap the AES-256-GCM key locally using ABRN_RSA_PRIVATE_KEY_PEM, verify SHA-256 integrity, and return plaintext.",
    inputSchema: {
      type: "object",
      properties: {
        file_id: { type: "string", description: "Target file UUID" },
        encoding: { type: "string", enum: ["utf8", "base64"], description: "Output encoding (default utf8)" },
        verify_sha256: { type: "boolean", description: "Fail if decrypted SHA-256 mismatches metadata (default true)" },
      },
      required: ["file_id"],
    },
  },
  {
    name: "abrn_create_folder",
    description: "Create a new folder in the vault (automatically constrained if folder-jailed). Supports Idempotency-Key.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Folder name" },
        parent_id: { type: "string", description: "Optional parent folder UUID" },
        idempotency_key: { type: "string", description: "Optional Idempotency-Key for retry-safe creation" },
      },
      required: ["name"],
    },
  },
  {
    name: "abrn_move_file",
    description: "Move a file into another authorized folder UUID.",
    inputSchema: {
      type: "object",
      properties: {
        file_id: { type: "string", description: "File UUID to move" },
        folder_id: { type: "string", description: "Destination folder UUID" },
        idempotency_key: { type: "string" },
      },
      required: ["file_id", "folder_id"],
    },
  },
  {
    name: "abrn_create_share_link",
    description: "Create a public share link record for a file (respects folder jail and idempotency).",
    inputSchema: {
      type: "object",
      properties: {
        file_id: { type: "string", description: "Target file UUID" },
        expires_at: { type: "string", description: "Optional RFC3339 expiration timestamp" },
        expires_in_hours: { type: "number", description: "Optional convenience TTL in hours" },
        max_downloads: { type: "number" },
        allow_download: { type: "boolean" },
        wrapped_key: { type: "string" },
        idempotency_key: { type: "string" },
      },
      required: ["file_id"],
    },
  },
  {
    name: "abrn_list_shares",
    description: "List outbound shared items owned by the vault.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "abrn_create_drop_token",
    description: "Create a Secure Drop upload link bound to a specific target folder UUID.",
    inputSchema: {
      type: "object",
      properties: {
        target_folder_id: { type: "string", description: "Destination folder UUID (alias: folder_id)" },
        folder_id: { type: "string", description: "Alias for target_folder_id" },
        link_name: { type: "string", description: "Human label for the drop link" },
        description: { type: "string" },
        expires_at: { type: "string" },
        expires_in_hours: { type: "number" },
        max_files: { type: "number" },
        seal_after_upload: { type: "boolean" },
        idempotency_key: { type: "string" },
      },
    },
  },
  {
    name: "abrn_soft_delete_file",
    description:
      "Move a file to Recoverable Trash using strictly the separate ABRN_DELETE_API_KEY (abrnak_del_...). Never uses ABRN_API_KEY and never permanently wipes data.",
    inputSchema: {
      type: "object",
      properties: {
        file_id: { type: "string", description: "File UUID to soft-delete" },
        reason: { type: "string", description: "Audit reason recorded on Recoverable Trash item" },
      },
      required: ["file_id"],
    },
  },
  {
    name: "abrn_soft_delete_folder",
    description:
      "Move a folder and its subtree into Recoverable Trash using strictly ABRN_DELETE_API_KEY (abrnak_del_...). Restore/purge remains human-JWT-only.",
    inputSchema: {
      type: "object",
      properties: {
        folder_id: { type: "string", description: "Folder UUID to soft-delete" },
        reason: { type: "string", description: "Audit reason recorded on Recoverable Trash item" },
      },
      required: ["folder_id"],
    },
  },
];

function asString(val: unknown): string {
  return typeof val === "string" ? val : "";
}

function asOptionalNumber(val: unknown): number | undefined {
  return typeof val === "number" && Number.isFinite(val) ? val : undefined;
}

function asOptionalBoolean(val: unknown): boolean | undefined {
  return typeof val === "boolean" ? val : undefined;
}

function requireStandardClient(ctx: AbrnMcpContext): AbrnDriveClient {
  if (!ctx.standardClient) {
    throw new Error("ABRN_API_KEY is not configured in the MCP server environment.");
  }
  return ctx.standardClient;
}

function requireDeleteClient(ctx: AbrnMcpContext): AbrnDriveClient {
  if (!ctx.deleteClient) {
    throw new Error(
      "ABRN_DELETE_API_KEY (abrnak_del_...) is not configured. Deletion tools strictly require a separate Special Delete-Only key and never fall back to ABRN_API_KEY."
    );
  }
  return ctx.deleteClient;
}

function formatToolError(err: unknown): { content: Array<{ type: "text"; text: string }>; isError: true } {
  if (err instanceof AbrnApiError) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: {
                status: err.status,
                code: err.code,
                message: err.message,
                request_id: err.requestId,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ error: { message: msg } }, null, 2) }],
  };
}

function okText(payload: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

export class AbrnMcpServer {
  private ctx: AbrnMcpContext;

  constructor(configOrContext: McpServerConfig | AbrnMcpContext) {
    if ("standardClient" in configOrContext || "deleteClient" in configOrContext) {
      this.ctx = configOrContext as AbrnMcpContext;
    } else {
      this.ctx = createMcpContext(configOrContext);
    }
  }

  async executeTool(name: string, rawArgs: Record<string, unknown> = {}) {
    try {
      switch (name) {
        case "abrn_whoami": {
          const out: Record<string, unknown> = {
            base_url: this.ctx.baseUrl,
            standard_key_configured: this.ctx.standardClient !== null,
            delete_key_configured: this.ctx.deleteClient !== null,
            rsa_private_key_configured: this.ctx.rsaPrivateKeyPem !== "",
          };
          if (this.ctx.standardClient) {
            out.standard = (await this.ctx.standardClient.introspect()).data;
          }
          if (this.ctx.deleteClient) {
            out.delete_only = (await this.ctx.deleteClient.introspect()).data;
          }
          if (!this.ctx.standardClient && !this.ctx.deleteClient) {
            throw new Error("Neither ABRN_API_KEY nor ABRN_DELETE_API_KEY is configured.");
          }
          return okText(out);
        }

        case "abrn_list_files": {
          const client = requireStandardClient(this.ctx);
          const res = await client.listFiles({
            q: asString(rawArgs.q) || undefined,
            folderId: asString(rawArgs.folder_id) || undefined,
            limit: asOptionalNumber(rawArgs.limit),
            offset: asOptionalNumber(rawArgs.offset),
          });
          return okText({ files: res.data, meta: res.meta });
        }

        case "abrn_list_shared_files": {
          const client = requireStandardClient(this.ctx);
          const res = await client.listSharedFiles({
            search: asString(rawArgs.search) || undefined,
            limit: asOptionalNumber(rawArgs.limit),
            offset: asOptionalNumber(rawArgs.offset),
          });
          return okText({ files: res.data, meta: res.meta });
        }

        case "abrn_list_folders": {
          const client = requireStandardClient(this.ctx);
          const res = await client.listFolders();
          return okText({ folders: res.data, meta: res.meta });
        }

        case "abrn_list_shared_folders": {
          const client = requireStandardClient(this.ctx);
          const res = await client.listSharedFolders();
          return okText({ folders: res.data, meta: res.meta });
        }

        case "abrn_list_folder_files": {
          const client = requireStandardClient(this.ctx);
          const folderId = asString(rawArgs.folder_id);
          if (!folderId) throw new Error("folder_id is required");
          const res = await client.listFolderFiles(folderId);
          return okText({ files: res.data, meta: res.meta });
        }

        case "abrn_get_file_trust": {
          const client = requireStandardClient(this.ctx);
          const fileId = asString(rawArgs.file_id);
          if (!fileId) throw new Error("file_id is required");
          const res = await client.getFileTrust(fileId);
          return okText(res.data);
        }

        case "abrn_list_audit": {
          const client = requireStandardClient(this.ctx);
          const res = await client.listAudit({
            action: asString(rawArgs.action) || undefined,
            resource_id: asString(rawArgs.file_id) || undefined,
            limit: asOptionalNumber(rawArgs.limit),
            offset: asOptionalNumber(rawArgs.offset),
          });
          return okText({ audit: res.data, meta: res.meta });
        }

        case "abrn_upload_encrypted_file": {
          const client = requireStandardClient(this.ctx);
          const filename = asString(rawArgs.filename);
          if (!filename) throw new Error("filename is required");

          const hasUtf8 = typeof rawArgs.content_utf8 === "string";
          const hasB64 = typeof rawArgs.content_base64 === "string";
          if ((hasUtf8 && hasB64) || (!hasUtf8 && !hasB64)) {
            throw new Error("Provide exactly one of content_utf8 or content_base64.");
          }

          const data: Uint8Array | string = hasB64
            ? new Uint8Array(base64ToArrayBuffer(rawArgs.content_base64 as string))
            : (rawArgs.content_utf8 as string);

          const uploaded = await encryptAndUploadForOwner(client, {
            filename,
            data,
            folderId: asString(rawArgs.folder_id) || undefined,
            mimeType: asString(rawArgs.mime_type) || "application/octet-stream",
            idempotencyKey: asString(rawArgs.idempotency_key) || undefined,
          });
          return okText({
            file_id: uploaded.file.id,
            filename: uploaded.file.filename || filename,
            sha256: uploaded.sha256,
            encrypted_zero_knowledge: true,
          });
        }

        case "abrn_download_and_decrypt_file": {
          const client = requireStandardClient(this.ctx);
          const fileId = asString(rawArgs.file_id);
          if (!fileId) throw new Error("file_id is required");
          if (!this.ctx.rsaPrivateKeyPem) {
            throw new Error(
              "ABRN_RSA_PRIVATE_KEY_PEM is not configured; cannot decrypt zero-knowledge ciphertext in MCP. Configure ABRN_RSA_PRIVATE_KEY_PEM with your PKCS#8 private key."
            );
          }

          const verifySha256 = rawArgs.verify_sha256 === undefined ? true : Boolean(rawArgs.verify_sha256);
          const decrypted = await downloadAndDecryptWithPrivateKey(client, fileId, this.ctx.rsaPrivateKeyPem, {
            verifySha256,
          });
          const encoding = rawArgs.encoding === "base64" ? "base64" : "utf8";
          return okText({
            file_id: fileId,
            filename: decrypted.filename,
            mime_type: decrypted.mimeType,
            byte_length: decrypted.data.byteLength,
            sha256: decrypted.sha256,
            sha256_verified: decrypted.sha256Verified,
            ...(encoding === "base64"
              ? { content_base64: arrayBufferToBase64(decrypted.data) }
              : { content_utf8: decrypted.text() }),
          });
        }

        case "abrn_create_folder": {
          const client = requireStandardClient(this.ctx);
          const folderName = asString(rawArgs.name);
          if (!folderName) throw new Error("name is required");
          const parentId = asString(rawArgs.parent_id) || undefined;
          const res = await client.createFolder(
            parentId ? { name: folderName, parentId } : { name: folderName },
            { idempotencyKey: asString(rawArgs.idempotency_key) || undefined }
          );
          return okText({ folder: res.data, replayed: Boolean(res.replayed) });
        }

        case "abrn_move_file": {
          const client = requireStandardClient(this.ctx);
          const fileId = asString(rawArgs.file_id);
          const folderId = asString(rawArgs.folder_id);
          if (!fileId || !folderId) throw new Error("file_id and folder_id are required");
          const res = await client.moveFile(fileId, folderId, undefined, {
            idempotencyKey: asString(rawArgs.idempotency_key) || undefined,
          });
          return okText({ moved: res.data, replayed: Boolean(res.replayed) });
        }

        case "abrn_create_share_link": {
          const client = requireStandardClient(this.ctx);
          const fileId = asString(rawArgs.file_id);
          if (!fileId) throw new Error("file_id is required");
          let expiresAt = asString(rawArgs.expires_at) || undefined;
          const hours = asOptionalNumber(rawArgs.expires_in_hours);
          if (!expiresAt && hours !== undefined) {
            expiresAt = new Date(Date.now() + hours * 3600_000).toISOString();
          }
          const res = await client.createPublicShareLink(
            fileId,
            {
              expires_at: expiresAt,
              max_downloads: asOptionalNumber(rawArgs.max_downloads),
              allow_download: asOptionalBoolean(rawArgs.allow_download),
              wrapped_key: asString(rawArgs.wrapped_key) || undefined,
            },
            { idempotencyKey: asString(rawArgs.idempotency_key) || undefined }
          );
          return okText({ share_link: res.data, replayed: Boolean(res.replayed) });
        }

        case "abrn_list_shares": {
          const client = requireStandardClient(this.ctx);
          const res = await client.listShares();
          return okText({ shares: res.data, meta: res.meta });
        }

        case "abrn_create_drop_token": {
          const client = requireStandardClient(this.ctx);
          const targetFolderId = asString(rawArgs.target_folder_id) || asString(rawArgs.folder_id);
          if (!targetFolderId) throw new Error("target_folder_id (or folder_id) is required");
          let expiresAt = asString(rawArgs.expires_at) || undefined;
          const hours = asOptionalNumber(rawArgs.expires_in_hours);
          if (!expiresAt && hours !== undefined) {
            expiresAt = new Date(Date.now() + hours * 3600_000).toISOString();
          }
          const res = await client.createDropToken(
            {
              target_folder_id: targetFolderId,
              link_name: asString(rawArgs.link_name) || undefined,
              description: asString(rawArgs.description) || undefined,
              expires_at: expiresAt,
              max_files: asOptionalNumber(rawArgs.max_files),
              seal_after_upload: asOptionalBoolean(rawArgs.seal_after_upload),
            },
            { idempotencyKey: asString(rawArgs.idempotency_key) || undefined }
          );
          return okText({ drop: res.data, replayed: Boolean(res.replayed) });
        }

        case "abrn_soft_delete_file": {
          const delClient = requireDeleteClient(this.ctx);
          const fileId = asString(rawArgs.file_id);
          if (!fileId) throw new Error("file_id is required");
          const res = await delClient.softDeleteFile(fileId, asString(rawArgs.reason) || undefined);
          return okText({
            ...res.data,
            notice: "Moved to Recoverable Trash. Only a human operator with a vault JWT can restore or permanently purge this file.",
          });
        }

        case "abrn_soft_delete_folder": {
          const delClient = requireDeleteClient(this.ctx);
          const folderId = asString(rawArgs.folder_id);
          if (!folderId) throw new Error("folder_id is required");
          const res = await delClient.softDeleteFolder(folderId, asString(rawArgs.reason) || undefined);
          return okText({
            ...res.data,
            notice: "Folder subtree moved to Recoverable Trash. Only a human operator with a vault JWT can restore or permanently purge.",
          });
        }

        default:
          throw new Error(`Unknown MCP tool: ${name}`);
      }
    } catch (err) {
      return formatToolError(err);
    }
  }

  async handleMessage(msg: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    const id = msg.id === undefined ? null : msg.id;
    const isNotification = msg.id === undefined;

    if (msg.method === "notifications/initialized" || msg.method.startsWith("notifications/")) {
      return null;
    }

    switch (msg.method) {
      case "initialize": {
        const requestedVersion =
          msg.params && typeof msg.params.protocolVersion === "string"
            ? msg.params.protocolVersion
            : MCP_PROTOCOL_VERSION;
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: requestedVersion || MCP_PROTOCOL_VERSION,
            capabilities: {
              tools: {},
            },
            serverInfo: MCP_SERVER_INFO,
          },
        };
      }

      case "ping":
        return { jsonrpc: "2.0", id, result: {} };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: MCP_TOOLS,
          },
        };

      case "tools/call": {
        const toolName = msg.params && typeof msg.params.name === "string" ? msg.params.name : "";
        const args =
          msg.params && msg.params.arguments && typeof msg.params.arguments === "object"
            ? (msg.params.arguments as Record<string, unknown>)
            : {};
        if (!toolName) {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: "Missing tool name in tools/call" },
          };
        }
        const toolResult = await this.executeTool(toolName, args);
        return {
          jsonrpc: "2.0",
          id,
          result: toolResult,
        };
      }

      default:
        if (isNotification) return null;
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${msg.method}` },
        };
    }
  }
}

export function serveStdioMcp(
  server: AbrnMcpServer,
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout
): void {
  let buffer = Buffer.alloc(0);
  let pending = Promise.resolve();

  const writeResponse = (res: JsonRpcResponse, framedWithContentLength: boolean) => {
    const json = JSON.stringify(res);
    if (framedWithContentLength) {
      const len = Buffer.byteLength(json, "utf8");
      output.write(`Content-Length: ${len}\r\n\r\n${json}`);
    } else {
      output.write(`${json}\n`);
    }
  };

  const dispatchPayload = (rawJson: string, useContentLength: boolean) => {
    pending = pending.then(async () => {
      try {
        const parsed = JSON.parse(rawJson) as JsonRpcRequest;
        const response = await server.handleMessage(parsed);
        if (response !== null) {
          writeResponse(response, useContentLength);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Invalid JSON-RPC payload";
        writeResponse(
          {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: `Parse error: ${msg}` },
          },
          useContentLength
        );
      }
    });
  };

  const processBuffer = () => {
    while (buffer.length > 0) {
      // Support Content-Length framed transport (LSP-style MCP)
      const headPreview = buffer.subarray(0, Math.min(64, buffer.length)).toString("utf8");
      if (/^Content-Length:/i.test(headPreview)) {
        let headerEnd = buffer.indexOf("\r\n\r\n");
        let sepLen = 4;
        if (headerEnd === -1) {
          headerEnd = buffer.indexOf("\n\n");
          sepLen = 2;
        }
        if (headerEnd === -1) return;

        const headerText = buffer.subarray(0, headerEnd).toString("utf8");
        const lenMatch = headerText.match(/Content-Length:\s*(\d+)/i);
        if (!lenMatch) {
          buffer = buffer.subarray(headerEnd + sepLen);
          continue;
        }
        const contentLen = Number.parseInt(lenMatch[1], 10);
        const totalNeed = headerEnd + sepLen + contentLen;
        if (buffer.length < totalNeed) return;

        const payload = buffer.subarray(headerEnd + sepLen, totalNeed).toString("utf8");
        buffer = buffer.subarray(totalNeed);
        dispatchPayload(payload, true);
        continue;
      }

      // Support standard MCP NDJSON transport (newline-delimited JSON-RPC)
      const nlIdx = buffer.indexOf("\n");
      if (nlIdx === -1) return;
      const line = buffer.subarray(0, nlIdx).toString("utf8").trim();
      buffer = buffer.subarray(nlIdx + 1);
      if (line.length === 0) continue;
      dispatchPayload(line, false);
    }
  };

  input.on("data", (chunk: Buffer | string) => {
    const chunkBuf = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
    buffer = Buffer.concat([buffer, chunkBuf]);
    processBuffer();
  });
}
