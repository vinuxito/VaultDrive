import { test, expect } from "@playwright/test";
import {
  buildOwnerAccount,
  registerAccount,
  loginWithPassword,
  completeOnboarding,
  gotoStable,
} from "./helpers/trust";

const apiBase = process.env.ABRN_E2E_API_BASE_URL ?? `${new URL(process.env.ABRN_E2E_BASE_URL ?? "http://127.0.0.1:8090/abrn").origin}/api`;

function apiUrl(path: string): string {
  const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

test.describe("Agent key lifecycle trust proof", () => {
  const account = buildOwnerAccount();
  let jwt = "";

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);
    jwt = await page.evaluate(() => localStorage.getItem("token") ?? "");
    expect(jwt).toBeTruthy();
    await page.close();
  });

  test("create agent key with scoped permissions", async ({ request }) => {
    const res = await request.post(apiUrl("/v1/agent-keys"), {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      data: {
        name: "QA Reconciliation Bot",
        scopes: ["files:list", "files:read_metadata", "activity:read"],
        notes: "E2E test key",
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe("QA Reconciliation Bot");
    expect(body.data.scopes).toContain("files:list");
    expect(body.data.plaintext_key).toBeTruthy();
    expect(body.data.key_prefix).toMatch(/^abrn_ak_/);

    test.info().annotations.push({ type: "agent_key", description: body.data.key_prefix });
  });

  test("introspect returns agent auth context", async ({ request }) => {
    const createRes = await request.post(apiUrl("/v1/agent-keys"), {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      data: {
        name: "QA Introspect Test",
        scopes: ["files:list"],
        notes: "E2E introspect test",
      },
    });
    const createBody = await createRes.json();
    const agentKey = createBody.data.plaintext_key;

    const introRes = await request.get(apiUrl("/v1/auth/introspect"), {
      headers: { Authorization: `Bearer ${agentKey}` },
    });

    expect(introRes.ok()).toBeTruthy();
    const introBody = await introRes.json();
    expect(introBody.data.auth_type).toBe("agent_api_key");
    expect(introBody.data.scopes).toContain("files:list");
    expect(introBody.data.key_id).toBeTruthy();
  });

  test("scope denial blocks unauthorized endpoints", async ({ request }) => {
    const createRes = await request.post(apiUrl("/v1/agent-keys"), {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      data: {
        name: "QA Narrow Key",
        scopes: ["activity:read"],
        notes: "E2E scope denial test",
      },
    });
    const createBody = await createRes.json();
    const narrowKey = createBody.data.plaintext_key;

    const filesRes = await request.get(apiUrl("/v1/files"), {
      headers: { Authorization: `Bearer ${narrowKey}` },
    });

    expect(filesRes.status()).toBe(403);
    const errorBody = await filesRes.json();
    expect(errorBody.success).toBe(false);
  });

  test("revoked key loses access immediately", async ({ request }) => {
    const createRes = await request.post(apiUrl("/v1/agent-keys"), {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      data: {
        name: "QA Revoke Target",
        scopes: ["files:list", "activity:read"],
        notes: "E2E revocation test",
      },
    });
    const createBody = await createRes.json();
    const targetKey = createBody.data.plaintext_key;
    const keyId = createBody.data.id;

    const beforeRes = await request.get(apiUrl("/v1/auth/introspect"), {
      headers: { Authorization: `Bearer ${targetKey}` },
    });
    expect(beforeRes.ok()).toBeTruthy();

    const revokeRes = await request.delete(apiUrl(`/v1/agent-keys/${keyId}`), {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    expect(revokeRes.ok()).toBeTruthy();

    const afterRes = await request.get(apiUrl("/v1/auth/introspect"), {
      headers: { Authorization: `Bearer ${targetKey}` },
    });
    expect(afterRes.status()).toBe(401);
  });

  test("agent keys visible in operations audit", async ({ request }) => {
    const auditRes = await request.get(apiUrl("/v1/audit?resource_type=agent_api_key&limit=10"), {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    expect(auditRes.ok()).toBeTruthy();
    const auditBody = await auditRes.json();
    expect(auditBody.success).toBe(true);
    expect(auditBody.data.length).toBeGreaterThan(0);

    const actions = auditBody.data.map((e: { action: string }) => e.action);
    expect(actions).toContain("agent_api_key.created");
  });

  test("settings shows new agent operations live without manual refresh", async ({ browser, request }) => {
    const page = await browser.newPage();
    await gotoStable(page, "/login");
    await loginWithPassword(page, account);
    await gotoStable(page, "/settings");

    await expect(page.getByRole("heading", { name: "Agent operations" })).toBeVisible();
    const operationEntries = page.getByTestId("agent-operation-entry");
    const initialCount = await operationEntries.count();

    const createRes = await request.post(apiUrl("/v1/agent-keys"), {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      data: {
        name: "QA Live Stream Agent",
        scopes: ["files:list"],
        notes: "Live stream proof",
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createBody = await createRes.json();
    const liveKey = createBody.data.plaintext_key as string;

    const filesRes = await request.get(apiUrl("/v1/files"), {
      headers: { Authorization: `Bearer ${liveKey}` },
    });
    expect(filesRes.ok()).toBeTruthy();

    await expect(page.getByText("QA Live Stream Agent").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("/api/v1/files").first()).toBeVisible({ timeout: 5000 });
    await expect(operationEntries).toHaveCount(initialCount + 2, { timeout: 5000 });
    await page.screenshot({ path: test.info().outputPath("live-agent-operations.png"), fullPage: true });

    await page.close();
  });

  test("Filemon operator runs a real agent call and shows the result", async ({ browser, request }) => {
    const createRes = await request.post(apiUrl("/v1/agent-keys"), {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      data: {
        name: "QA Filemon Operator",
        scopes: ["files:list"],
        notes: "Filemon operator proof",
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createBody = await createRes.json();
    const rawKey = createBody.data.plaintext_key as string;

    const page = await browser.newPage();
    await gotoStable(page, "/login");
    await loginWithPassword(page, account);
    await gotoStable(page, "/settings");

    await expect(page.getByRole("heading", { name: "Filemon operator" })).toBeVisible();
    await page.locator("#filemon-raw-key").fill(rawKey);
    await page.getByRole("button", { name: /run through filemon/i }).click();

    await expect(page.getByText(/^GET http:\/\/127\.0\.0\.1:8090\/abrn\/api\/v1\/auth\/introspect/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Auth type:\s*agent_api_key/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/"auth_type":\s*"agent_api_key"/)).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: test.info().outputPath("filemon-operator-console.png"), fullPage: true });

    await page.close();
  });
});
