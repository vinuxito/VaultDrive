import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateBotRsaKeyPair } from "../sdk/index.ts";
import { AbrnMcpServer, MCP_TOOLS } from "./server.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN_PATH = path.join(__dirname, "bin.ts");

function spawnMcpClient(extraEnv: Record<string, string | undefined>) {
  const cleanEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && k !== "ABRN_PASSWORD" && k !== "ABRN_PIN") {
      cleanEnv[k] = v;
    }
  }
  for (const [k, v] of Object.entries(extraEnv)) {
    if (v === undefined) {
      delete cleanEnv[k];
    } else {
      cleanEnv[k] = v;
    }
  }

  const child = spawn(process.execPath, ["--experimental-strip-types", BIN_PATH], {
    env: cleanEnv,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdoutBuf = Buffer.alloc(0);
  let stderrText = "";
  const waiters = new Map<string | number, { resolve: (val: unknown) => void; reject: (err: Error) => void }>();

  child.stderr.on("data", (chunk: Buffer) => {
    stderrText += chunk.toString("utf8");
  });

  child.stdout.on("data", (chunk: Buffer) => {
    stdoutBuf = Buffer.concat([stdoutBuf, chunk]);
    while (true) {
      const nl = stdoutBuf.indexOf("\n");
      if (nl === -1) break;
      const line = stdoutBuf.subarray(0, nl).toString("utf8").trim();
      stdoutBuf = stdoutBuf.subarray(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as { id?: string | number | null };
      if (msg.id !== undefined && msg.id !== null) {
        const w = waiters.get(msg.id);
        if (w) {
          waiters.delete(msg.id);
          w.resolve(msg);
        }
      }
    }
  });

  let nextId = 1;
  async function rpc(method: string, params?: Record<string, unknown>) {
    const id = nextId++;
    const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
      waiters.set(id, { resolve: resolve as (val: unknown) => void, reject });
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) })}\n`);
    return promise;
  }

  function notify(method: string, params?: Record<string, unknown>) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, ...(params ? { params } : {}) })}\n`);
  }

  async function close() {
    child.stdin.end();
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", () => resolve());
      setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 1500);
    });
  }

  return { child, rpc, notify, close, getStderr: () => stderrText };
}

test("MCP server fails fast if ABRN_PASSWORD or ABRN_PIN is provided (no secret echo)", () => {
  const pwRun = spawnSync(process.execPath, ["--experimental-strip-types", BIN_PATH], {
    env: { ...process.env, ABRN_PASSWORD: "super-secret-password-999", ABRN_API_KEY: "abrnak_x" },
    encoding: "utf8",
  });
  assert.notEqual(pwRun.status, 0);
  assert.match(pwRun.stderr, /ABRN_PASSWORD/i);
  assert.ok(!pwRun.stderr.includes("super-secret-password-999"), "Must never leak password to stderr");

  const pinRun = spawnSync(process.execPath, ["--experimental-strip-types", BIN_PATH], {
    env: { ...process.env, ABRN_PIN: "987654", ABRN_API_KEY: "abrnak_x" },
    encoding: "utf8",
  });
  assert.notEqual(pinRun.status, 0);
  assert.match(pinRun.stderr, /ABRN_PIN/i);
  assert.ok(!pinRun.stderr.includes("987654"), "Must never leak PIN to stderr");
});

test("MCP stdio subprocess protocol: initialize, tools/list, and strict delete/RSA guards", async () => {
  const client = spawnMcpClient({
    ABRN_BASE_URL: "http://127.0.0.1:9/api",
    ABRN_API_KEY: "abrnak_std_only",
    ABRN_DELETE_API_KEY: undefined,
    ABRN_RSA_PRIVATE_KEY_PEM: undefined,
  });

  try {
    const initRes = (await client.rpc("initialize", { protocolVersion: "2024-11-05" })) as {
      result: { serverInfo: { name: string }; capabilities: { tools: object } };
    };
    assert.equal(initRes.result.serverInfo.name, "abrn-drive-mcp");
    assert.ok(initRes.result.capabilities.tools);

    client.notify("notifications/initialized");

    const listRes = (await client.rpc("tools/list")) as { result: { tools: typeof MCP_TOOLS } };
    assert.equal(listRes.result.tools.length, 17);
    const toolNames = new Set(listRes.result.tools.map((t) => t.name));
    for (const expected of [
      "abrn_whoami",
      "abrn_list_files",
      "abrn_upload_encrypted_file",
      "abrn_download_and_decrypt_file",
      "abrn_soft_delete_file",
      "abrn_soft_delete_folder",
      "abrn_create_drop_token",
    ]) {
      assert.ok(toolNames.has(expected), `Missing tool ${expected}`);
    }

    // Standard ABRN_API_KEY must never satisfy abrn_soft_delete_file
    const delFail = (await client.rpc("tools/call", {
      name: "abrn_soft_delete_file",
      arguments: { file_id: "file-1", reason: "unauthorized attempt" },
    })) as { result: { isError?: boolean; content: Array<{ text: string }> } };
    assert.equal(delFail.result.isError, true);
    assert.match(delFail.result.content[0].text, /ABRN_DELETE_API_KEY/);

    // Decryption without ABRN_RSA_PRIVATE_KEY_PEM must fail clearly with guidance
    const decFail = (await client.rpc("tools/call", {
      name: "abrn_download_and_decrypt_file",
      arguments: { file_id: "file-1" },
    })) as { result: { isError?: boolean; content: Array<{ text: string }> } };
    assert.equal(decFail.result.isError, true);
    assert.match(decFail.result.content[0].text, /ABRN_RSA_PRIVATE_KEY_PEM/);

    assert.equal(client.getStderr(), "");
  } finally {
    await client.close();
  }
});

test("MCP strict bearer key routing + Content-Length stdio framing + WebCrypto encrypt/decrypt roundtrip", async () => {
  // Verify Content-Length framing on real bin.ts stdio subprocess
  const framedChild = spawn(process.execPath, ["--experimental-strip-types", BIN_PATH], {
    env: {
      ...process.env,
      ABRN_BASE_URL: "http://127.0.0.1:9/api",
      ABRN_API_KEY: "abrnak_framed",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const framedResp = await new Promise<string>((resolve, reject) => {
    let out = Buffer.alloc(0);
    framedChild.stdout.on("data", (chunk: Buffer) => {
      out = Buffer.concat([out, chunk]);
      const raw = out.toString("utf8");
      if (raw.includes('"serverInfo"')) {
        framedChild.kill("SIGTERM");
        resolve(raw);
      }
    });
    framedChild.on("error", reject);
    const reqJson = JSON.stringify({ jsonrpc: "2.0", id: 99, method: "initialize", params: { protocolVersion: "2024-11-05" } });
    framedChild.stdin.write(`Content-Length: ${Buffer.byteLength(reqJson, "utf8")}\r\n\r\n${reqJson}`);
  });
  assert.match(framedResp, /^Content-Length:\s*\d+\r\n\r\n\{/);

  const { publicKeySpkiBase64, privateKeyPem } = await generateBotRsaKeyPair(2048);
  const authHeadersSeen: Array<{ path: string; method: string; auth: string }> = [];
  let storedCiphertext: Buffer = Buffer.alloc(0);
  let storedWrappedKey = "";
  let storedMeta = "";

  const mockServer = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const url = req.url ?? "/";
      authHeadersSeen.push({ path: url, method: req.method ?? "GET", auth: String(req.headers.authorization ?? "") });

      if (url === "/api/v1/users/me/public-key") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, data: { user_id: "u1", email: "a@abrn.mx", public_key: publicKeySpkiBase64 }, meta: {} }));
        return;
      }
      if (url === "/api/v1/files/upload") {
        const raw = body.toString("latin1");
        const ct = String(req.headers["content-type"] ?? "");
        const boundaryMatch = ct.match(/boundary=([^\s;]+)/i);
        assert.ok(boundaryMatch);
        const parts = raw.split(`--${boundaryMatch[1]}`).slice(1, -1);
        for (const p of parts) {
          const clean = p.startsWith("\r\n") ? p.slice(2) : p;
          const idx = clean.indexOf("\r\n\r\n");
          const hdr = clean.slice(0, idx);
          let val = clean.slice(idx + 4);
          if (val.endsWith("\r\n")) val = val.slice(0, -2);
          if (hdr.includes('name="wrapped_key"')) storedWrappedKey = val;
          if (hdr.includes('name="metadata"')) storedMeta = val;
          if (hdr.includes('name="file"')) storedCiphertext = Buffer.from(val, "latin1");
        }
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, data: { id: "file-zk-1", filename: "mcp-secret.txt", metadata: storedMeta }, meta: {} }));
        return;
      }
      if (url === "/api/v1/files/file-zk-1/download") {
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "X-Wrapped-Key": storedWrappedKey,
          "X-Credential-Scheme": "rsa",
          "X-File-Metadata": storedMeta,
        });
        res.end(storedCiphertext);
        return;
      }
      if (url.startsWith("/api/v1/files/file-zk-1") && req.method === "DELETE") {
        assert.equal(req.headers.authorization, "Bearer abrnak_del_exclusive");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            data: { id: "file-zk-1", deleted_at: "2026-11-15T16:40:00Z", recoverable: true },
            meta: {},
          })
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });
  });

  await new Promise<void>((r) => mockServer.listen(0, "127.0.0.1", () => r()));
  const port = (mockServer.address() as AddressInfo).port;

  try {
    const server = new AbrnMcpServer({
      baseUrl: `http://127.0.0.1:${port}/api`,
      apiKey: "abrnak_std_worker",
      deleteApiKey: "abrnak_del_exclusive",
      rsaPrivateKeyPem: privateKeyPem,
    });

    const uploadMsg = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "abrn_upload_encrypted_file",
        arguments: {
          filename: "mcp-secret.txt",
          content_utf8: "Zero-knowledge payroll plaintext 2026",
          mime_type: "text/plain",
        },
      },
    });
    const uploadResult = uploadMsg?.result as { isError?: boolean; content: Array<{ text: string }> };
    assert.ok(!uploadResult.isError, uploadResult.content[0].text);
    const uploadParsed = JSON.parse(uploadResult.content[0].text);
    assert.equal(uploadParsed.file_id, "file-zk-1");
    assert.ok(!storedCiphertext.toString("utf8").includes("Zero-knowledge payroll plaintext"));

    const dlMsg = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "abrn_download_and_decrypt_file",
        arguments: { file_id: "file-zk-1" },
      },
    });
    const dlResult = dlMsg?.result as { isError?: boolean; content: Array<{ text: string }> };
    assert.ok(!dlResult.isError, dlResult.content[0].text);
    const dlParsed = JSON.parse(dlResult.content[0].text);
    assert.equal(dlParsed.content_utf8, "Zero-knowledge payroll plaintext 2026");
    assert.equal(dlParsed.sha256_verified, true);

    const delMsg = await server.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "abrn_soft_delete_file",
        arguments: { file_id: "file-zk-1", reason: "archived payroll run" },
      },
    });
    const delResult = delMsg?.result as { isError?: boolean; content: Array<{ text: string }> };
    assert.ok(!delResult.isError, delResult.content[0].text);
    const delParsed = JSON.parse(delResult.content[0].text);
    assert.equal(delParsed.recoverable, true);
    assert.match(delParsed.notice, /Recoverable Trash/);

    const uploadAuth = authHeadersSeen.find((h) => h.path === "/api/v1/files/upload");
    const delAuth = authHeadersSeen.find((h) => h.method === "DELETE");
    assert.equal(uploadAuth?.auth, "Bearer abrnak_std_worker");
    assert.equal(delAuth?.auth, "Bearer abrnak_del_exclusive");
  } finally {
    await new Promise<void>((r) => mockServer.close(() => r()));
  }
});

const liveBaseUrl = process.env.ABRN_TEST_BASE_URL ?? "";
const liveStdKey = process.env.ABRN_TEST_STANDARD_KEY ?? "";
const liveDelKey = process.env.ABRN_TEST_DELETE_KEY ?? "";
const livePrivPem = process.env.ABRN_TEST_RSA_PRIV_PEM ?? "";

test(
  "Live Go server MCP subprocess E2E: whoami, folder, encrypted upload/decrypt, share, drop, and Recoverable Trash soft-delete",
  { skip: !liveBaseUrl || !liveStdKey || !liveDelKey || !livePrivPem },
  async () => {
    const client = spawnMcpClient({
      ABRN_BASE_URL: liveBaseUrl,
      ABRN_API_KEY: liveStdKey,
      ABRN_DELETE_API_KEY: liveDelKey,
      ABRN_RSA_PRIVATE_KEY_PEM: livePrivPem,
    });

    try {
      await client.rpc("initialize", { protocolVersion: "2024-11-05" });
      client.notify("notifications/initialized");

      const whoRes = (await client.rpc("tools/call", { name: "abrn_whoami", arguments: {} })) as {
        result: { isError?: boolean; content: Array<{ text: string }> };
      };
      assert.ok(!whoRes.result.isError);
      const who = JSON.parse(whoRes.result.content[0].text);
      assert.equal(who.standard.key_kind, "standard");
      assert.equal(who.delete_only.key_kind, "delete_only");

      const folderRes = (await client.rpc("tools/call", {
        name: "abrn_create_folder",
        arguments: { name: `MCP-Live-${Date.now()}`, idempotency_key: `mcp-folder-${Date.now()}` },
      })) as { result: { isError?: boolean; content: Array<{ text: string }> } };
      assert.ok(!folderRes.result.isError, folderRes.result.content[0].text);
      const folderId = JSON.parse(folderRes.result.content[0].text).folder.id as string;

      const plaintext = `MCP Go Roundtrip Payload ${new Date().toISOString()}`;
      const upRes = (await client.rpc("tools/call", {
        name: "abrn_upload_encrypted_file",
        arguments: {
          filename: "mcp-live-verify.txt",
          content_utf8: plaintext,
          folder_id: folderId,
          mime_type: "text/plain",
        },
      })) as { result: { isError?: boolean; content: Array<{ text: string }> } };
      assert.ok(!upRes.result.isError, upRes.result.content[0].text);
      const fileId = JSON.parse(upRes.result.content[0].text).file_id as string;

      const downRes = (await client.rpc("tools/call", {
        name: "abrn_download_and_decrypt_file",
        arguments: { file_id: fileId },
      })) as { result: { isError?: boolean; content: Array<{ text: string }> } };
      assert.ok(!downRes.result.isError, downRes.result.content[0].text);
      const downData = JSON.parse(downRes.result.content[0].text);
      assert.equal(downData.content_utf8, plaintext);
      assert.equal(downData.sha256_verified, true);

      const dropRes = (await client.rpc("tools/call", {
        name: "abrn_create_drop_token",
        arguments: { target_folder_id: folderId, link_name: "MCP Drop", expires_in_hours: 2 },
      })) as { result: { isError?: boolean; content: Array<{ text: string }> } };
      assert.ok(!dropRes.result.isError, dropRes.result.content[0].text);

      const delRes = (await client.rpc("tools/call", {
        name: "abrn_soft_delete_file",
        arguments: { file_id: fileId, reason: "MCP live E2E test cleanup" },
      })) as { result: { isError?: boolean; content: Array<{ text: string }> } };
      assert.ok(!delRes.result.isError, delRes.result.content[0].text);
      const delData = JSON.parse(delRes.result.content[0].text);
      assert.equal(delData.recoverable, true);
      assert.equal(delData.id, fileId);
    } finally {
      await client.close();
    }
  }
);
