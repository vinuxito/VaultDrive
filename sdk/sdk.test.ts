import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  AbrnDriveClient,
  AbrnApiError,
  QuantixClient,
  generateBotRsaKeyPair,
  generateAesGcmKey,
  wrapKeyRsaOaep,
  sha256Hex,
  encryptAndUploadForOwner,
  encryptAndUploadWithFolderKey,
  decryptFolderKeyWithPrivateKey,
  downloadAndDecryptWithPrivateKey,
} from "./index.ts";

interface RecordedRequest {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

async function startMockServer(
  handler: (req: RecordedRequest, res: http.ServerResponse) => void
): Promise<{ baseUrl: string; requests: RecordedRequest[]; close: () => Promise<void> }> {
  const requests: RecordedRequest[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const recorded: RecordedRequest = {
        method: req.method ?? "GET",
        url: req.url ?? "/",
        headers: req.headers,
        body: Buffer.concat(chunks),
      };
      requests.push(recorded);
      handler(recorded, res);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${addr.port}/api`,
    requests,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

function parseMultipartSimple(contentType: string, body: Buffer): {
  fields: Record<string, string>;
  fileBytes: Uint8Array | null;
} {
  const match = contentType.match(/boundary=([^\s;]+)/i);
  if (!match) {
    throw new Error(`Missing multipart boundary in ${contentType}`);
  }
  const boundary = `--${match[1]}`;
  const raw = body.toString("latin1");
  const parts = raw.split(boundary).slice(1, -1);
  const fields: Record<string, string> = {};
  let fileBytes: Uint8Array | null = null;

  for (const part of parts) {
    const cleaned = part.startsWith("\r\n") ? part.slice(2) : part;
    const headerEnd = cleaned.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const headerStr = cleaned.slice(0, headerEnd);
    let contentLatin1 = cleaned.slice(headerEnd + 4);
    if (contentLatin1.endsWith("\r\n")) {
      contentLatin1 = contentLatin1.slice(0, -2);
    }
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    if (!nameMatch) continue;
    const fieldName = nameMatch[1];
    if (headerStr.includes("filename=")) {
      fileBytes = Uint8Array.from(Buffer.from(contentLatin1, "latin1"));
    } else {
      fields[fieldName] = Buffer.from(contentLatin1, "latin1").toString("utf8");
    }
  }
  return { fields, fileBytes };
}

test("AbrnApiError formats structured {error:{code,message}} cleanly and preserves QuantixClient alias", async () => {
  assert.equal(QuantixClient, AbrnDriveClient);

  const mock = await startMockServer((req, res) => {
    if (req.url.startsWith("/api/v1/files/f-bad") && req.method === "DELETE") {
      res.writeHead(403, { "Content-Type": "application/json", "X-Request-Id": "req-del-403" });
      res.end(
        JSON.stringify({
          success: false,
          error: { code: "delete_key_required", message: "Standard agent keys cannot delete" },
          meta: { request_id: "req-del-403" },
        })
      );
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  try {
    const client = new AbrnDriveClient({ baseUrl: mock.baseUrl, apiKey: "abrnak_std_test" });
    await assert.rejects(
      () => client.softDeleteFile("f-bad", "test reason"),
      (err: unknown) => {
        assert.ok(err instanceof AbrnApiError);
        assert.equal(err.status, 403);
        assert.equal(err.code, "delete_key_required");
        assert.equal(err.requestId, "req-del-403");
        assert.ok(!err.message.includes("[object Object]"), `Unexpected message: ${err.message}`);
        assert.ok(err.message.includes("Standard agent keys cannot delete"));
        return true;
      }
    );
    assert.ok(decodeURIComponent(mock.requests[0].url).includes("reason=test reason"));
  } finally {
    await mock.close();
  }
});

test("Idempotency-Key forwarding, X-Idempotency-Replayed detection, and 429 Retry-After backoff", async () => {
  let folderCalls = 0;
  let listCalls = 0;
  const mock = await startMockServer((req, res) => {
    if (req.url === "/api/v1/folders" && req.method === "POST") {
      folderCalls += 1;
      const isReplay = folderCalls > 1;
      res.writeHead(isReplay ? 200 : 201, {
        "Content-Type": "application/json",
        ...(isReplay ? { "X-Idempotency-Replayed": "true" } : {}),
      });
      res.end(
        JSON.stringify({
          success: true,
          data: { id: "fld-123", name: "Contracts" },
          meta: { request_id: `req-${folderCalls}` },
        })
      );
      return;
    }
    if (req.url === "/api/v1/files" && req.method === "GET") {
      listCalls += 1;
      if (listCalls === 1) {
        res.writeHead(429, { "Content-Type": "application/json", "Retry-After": "0" });
        res.end(JSON.stringify({ success: false, error: { code: "rate_limited", message: "Slow down" } }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: [], meta: {} }));
    }
  });

  try {
    const client = new AbrnDriveClient({ baseUrl: mock.baseUrl, apiKey: "abrnak_std_test", maxRateLimitRetries: 2 });
    const first = await client.createFolder({ name: "Contracts" }, { idempotencyKey: "idem-folder-1" });
    const second = await client.createFolder({ name: "Contracts" }, { idempotencyKey: "idem-folder-1" });
    assert.equal(first.replayed, undefined);
    assert.equal(second.replayed, true);
    assert.equal(second.data.id, "fld-123");
    assert.equal(mock.requests[0].headers["idempotency-key"], "idem-folder-1");

    const listed = await client.listFiles();
    assert.equal(listCalls, 2);
    assert.deepEqual(listed.data, []);
  } finally {
    await mock.close();
  }
});

test("WebCrypto RSA-OAEP & Folder-Key zero-knowledge upload/download roundtrip and tamper detection", async () => {
  const { publicKeySpkiBase64, privateKeyPkcs8Base64 } = await generateBotRsaKeyPair(2048);
  const storedFiles = new Map<
    string,
    { ciphertext: Uint8Array; iv: string; wrappedKey: string; scheme: string; folderWrappedKey?: string; metadata: string; filename: string }
  >();

  const mock = await startMockServer((req, res) => {
    if (req.url === "/api/v1/users/me/public-key" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: { user_id: "u1", email: "bot@abrn.mx", public_key: publicKeySpkiBase64 }, meta: {} }));
      return;
    }
    if (req.url === "/api/v1/files/upload" && req.method === "POST") {
      const contentType = String(req.headers["content-type"] ?? "");
      const { fields, fileBytes } = parseMultipartSimple(contentType, req.body);
      assert.ok(fileBytes && fileBytes.byteLength > 0);
      const id = `file-${storedFiles.size + 1}`;
      storedFiles.set(id, {
        ciphertext: fileBytes,
        iv: fields.iv,
        wrappedKey: fields.wrapped_key,
        scheme: fields.credential_scheme,
        metadata: fields.metadata,
        filename: JSON.parse(fields.metadata).originalName,
      });
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: { id, filename: JSON.parse(fields.metadata).originalName, metadata: fields.metadata }, meta: {} }));
      return;
    }
    const dlMatch = req.url.match(/^\/api\/v1\/files\/([^/]+)\/download$/);
    if (dlMatch && req.method === "GET") {
      const item = storedFiles.get(dlMatch[1]);
      assert.ok(item);
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "X-Wrapped-Key": item.wrappedKey,
        "X-Credential-Scheme": item.scheme,
        ...(item.folderWrappedKey ? { "X-Folder-Wrapped-Key": item.folderWrappedKey } : {}),
        "X-File-Metadata": item.metadata,
      });
      res.end(Buffer.from(item.ciphertext));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  try {
    const client = new AbrnDriveClient({ baseUrl: mock.baseUrl, apiKey: "abrnak_rsa_test" });
    const secretText = "CFDI-4.0 confidential payload €MXN-100,000";
    const expectedSha = await sha256Hex(secretText);

    // 1. RSA-OAEP owner-key roundtrip
    const uploadedRsa = await encryptAndUploadForOwner(client, {
      filename: "factura.xml",
      data: secretText,
      mimeType: "application/xml",
      idempotencyKey: "idem-upload-rsa",
    });
    assert.equal(uploadedRsa.sha256, expectedSha);

    const rsaRecord = storedFiles.get(uploadedRsa.file.id);
    assert.ok(rsaRecord);
    assert.notEqual(Buffer.from(rsaRecord.ciphertext).toString("utf8"), secretText);

    const decryptedRsa = await downloadAndDecryptWithPrivateKey(client, uploadedRsa.file.id, privateKeyPkcs8Base64);
    assert.equal(decryptedRsa.text(), secretText);
    assert.equal(decryptedRsa.sha256Verified, true);
    assert.equal(decryptedRsa.mimeType, "application/xml");

    // 1b. PKCS#1 BEGIN RSA PRIVATE KEY compatibility (matches ABRN Go server registerUserHandler key format)
    const { createPrivateKey } = await import("node:crypto");
    const pkcs8KeyObj = createPrivateKey({
      key: Buffer.from(privateKeyPkcs8Base64, "base64"),
      format: "der",
      type: "pkcs8",
    });
    const pkcs1Pem = pkcs8KeyObj.export({ format: "pem", type: "pkcs1" }).toString();
    assert.match(pkcs1Pem, /BEGIN RSA PRIVATE KEY/);
    const decryptedPkcs1 = await downloadAndDecryptWithPrivateKey(client, uploadedRsa.file.id, pkcs1Pem);
    assert.equal(decryptedPkcs1.text(), secretText);
    assert.equal(decryptedPkcs1.sha256Verified, true);

    // 2. Folder AES-GCM + RSA-wrapped folder key roundtrip
    const rawFolderKey = await generateAesGcmKey();
    const wrappedFolderKey = await wrapKeyRsaOaep(
      await (await import("./crypto.ts")).importRsaPublicKeySpki(publicKeySpkiBase64),
      rawFolderKey
    );
    const unwrappedFolderKey = await decryptFolderKeyWithPrivateKey(wrappedFolderKey, privateKeyPkcs8Base64);
    const uploadedFolder = await encryptAndUploadWithFolderKey(client, {
      filename: "folder-secret.txt",
      data: "Zero-knowledge inside folder jail",
      folderId: "fld-1",
      folderKey: unwrappedFolderKey,
      mimeType: "text/plain",
    });
    const fldRecord = storedFiles.get(uploadedFolder.file.id);
    assert.ok(fldRecord);
    assert.equal(fldRecord.scheme, "folder");
    fldRecord.folderWrappedKey = wrappedFolderKey;

    const decryptedFolder = await downloadAndDecryptWithPrivateKey(client, uploadedFolder.file.id, privateKeyPkcs8Base64);
    assert.equal(decryptedFolder.text(), "Zero-knowledge inside folder jail");
    assert.equal(decryptedFolder.sha256Verified, true);

    // 3. Ciphertext tamper detection
    rsaRecord.ciphertext[0] ^= 0xff;
    await assert.rejects(() => downloadAndDecryptWithPrivateKey(client, uploadedRsa.file.id, privateKeyPkcs8Base64));
  } finally {
    await mock.close();
  }
});

const liveBaseUrl = process.env.ABRN_TEST_BASE_URL ?? "";
const liveStdKey = process.env.ABRN_TEST_STANDARD_KEY ?? "";
const liveDelKey = process.env.ABRN_TEST_DELETE_KEY ?? "";
const livePrivPem = process.env.ABRN_TEST_RSA_PRIV_PEM ?? "";

test(
  "Live Go server roundtrip: introspect, idempotent folder creation, WebCrypto upload/download, and Special Delete-Only enforcement",
  { skip: !liveBaseUrl || !liveStdKey || !liveDelKey || !livePrivPem },
  async () => {
    const stdClient = new AbrnDriveClient({ baseUrl: liveBaseUrl, apiKey: liveStdKey });
    const delClient = new AbrnDriveClient({ baseUrl: liveBaseUrl, apiKey: liveDelKey });

    const stdIntrospect = await stdClient.introspect();
    assert.equal(stdIntrospect.data.auth_type, "agent_api_key");
    assert.equal(stdIntrospect.data.key_kind, "standard");

    const delIntrospect = await delClient.introspect();
    assert.equal(delIntrospect.data.auth_type, "agent_api_key");
    assert.equal(delIntrospect.data.key_kind, "delete_only");

    const idemKey = `sdk-live-folder-${Date.now()}`;
    const f1 = await stdClient.createFolder({ name: `SDK-Live-${Date.now()}` }, { idempotencyKey: idemKey });
    const f2 = await stdClient.createFolder({ name: f1.data.name }, { idempotencyKey: idemKey });
    assert.equal(f2.data.id, f1.data.id);
    assert.equal(f2.replayed, true);

    const payload = `Live Go Zero-Knowledge SDK Check ${new Date().toISOString()}`;
    const uploaded = await encryptAndUploadForOwner(stdClient, {
      filename: "sdk-live-verify.txt",
      data: payload,
      folderId: f1.data.id,
      mimeType: "text/plain",
    });

    const decrypted = await downloadAndDecryptWithPrivateKey(stdClient, uploaded.file.id, livePrivPem);
    assert.equal(decrypted.text(), payload);
    assert.equal(decrypted.sha256Verified, true);

    await assert.rejects(
      () => stdClient.softDeleteFile(uploaded.file.id, "should fail"),
      (err: unknown) => err instanceof AbrnApiError && err.status === 403 && err.code === "delete_key_required"
    );

    const trashed = await delClient.softDeleteFile(uploaded.file.id, "sdk live roundtrip verified");
    assert.equal(trashed.data.recoverable, true);
    assert.ok(trashed.data.deleted_at);

    const jailedKey = process.env.ABRN_TEST_JAILED_KEY;
    const outsideFileId = process.env.ABRN_TEST_OUTSIDE_FILE_ID;
    if (jailedKey && outsideFileId) {
      const jailedClient = new AbrnDriveClient({ baseUrl: liveBaseUrl, apiKey: jailedKey });
      await assert.rejects(
        () => jailedClient.getFile(outsideFileId),
        (err: unknown) => err instanceof AbrnApiError && err.status === 403 && err.code === "folder_scope_denied"
      );
    }
  }
);
