import { test, expect, type Page } from "@playwright/test";
import { createCipheriv, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

// Visual fixtures never access customer files or mutate the live API.
test.use({ actionTimeout: 15000, serviceWorkers: "block", contextOptions: { reducedMotion: "reduce" }, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
test.describe.configure({ mode: "parallel" });
test.setTimeout(180_000);
const user = { id: "visual-user", username: "Visual Fixture", first_name: "Visual", last_name: "Fixture", email: "visual@example.test", pin_set: true, is_admin: true, created_at: "2026-09-14T00:00:00Z" };
const file = { id: "visual-file", folder_id: "visual-folder", filename: "Contrast audit.txt", metadata: JSON.stringify({ credential_scheme: "pin", salt: "AA==", iv: "AA==" }), is_owner: true, owner_name: "Visual Fixture", owner_username: "Visual Fixture", file_size: 1024, created_at: "2026-09-14T00:00:00Z" };
const group = { id: "visual-group", name: "Audit team", description: "Template visibility fixture", owner_id: user.id, is_owner: true, member_count: 1, created_at: file.created_at };
const key = "0".repeat(64);
const shareKey = Buffer.alloc(32).toString("base64");
const routes = ["", "about", "login", "recover", "force-password-change", "dashboard", "files", "shared", "profile", "settings", "groups", "groups/visual-group", "admin", "admin/tests", "access-center", "help", "room/visual-room", `drop/visual#key=${key}`, `share/visual#${shareKey}`, `folder-share/visual#${shareKey}`, "request/visual"];

async function fixture(page: Page, skin: string) {
  await page.addInitScript(({ skin, user }) => {
    localStorage.setItem("token", "visual-fixture-token");
    localStorage.setItem("user", JSON.stringify({ ...user, force_password_change: location.pathname.endsWith("/force-password-change") }));
    if (!localStorage.getItem("abrn-drive-skin")) localStorage.setItem("abrn-drive-skin", skin);
    localStorage.setItem("quantix-drive-skin", skin);
    localStorage.setItem("i18nextLng", "en");
  }, { skin, user });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split("/api")[1];
    let json: unknown = [];
    if (path === "/files") json = [file];
    else if (path === "/folders") json = [{ id: "visual-folder", name: "Audit folder", parent_id: null, owner_id: user.id }, { id: "visual-destination", name: "Audit destination", parent_id: null, owner_id: user.id }];
    else if (path === "/drop/create") json = { upload_url: `${new URL(route.request().url()).origin}/abrn/drop/created#key=${key}` };
    else if (path.endsWith("/trust")) json = { success: true, data: { file_id: file.id, protection: "Browser-encrypted ciphertext stored server-side", owner_label: user.username, visibility_summary: "Only you", access_state: "owner", origin: "upload", latest_activity: "Ciphertext stored in your vault", entries: [{ kind: "owner", label: "Owner", since: file.created_at, state: "active" }] } };
    else if (path.endsWith("/timeline")) json = { success: true, data: [{ id: "visual-event", event_type: "upload", label: "Ciphertext stored in your vault", at: file.created_at, tone: "good" }] };
    else if (path === "/users/me") json = user;
    else if (path === "/users/pin/status") json = { pin_set: true };
    else if (path === "/groups") json = [group];
    else if (path === "/groups/visual-group") json = group;
    else if (path === "/groups/visual-group/members" || path === "/admin/users") json = [user];
    else if (path === "/healthz") json = { status: "ok", version: "fixture", uptime: "1h", db_ping_ms: 1, goroutines: 8, memory_mb: 12, requests_total: 20, errors_total: 0 };
    else if (path === "/security-posture") json = { status: "healthy", attention_count: 0, expiring_tokens: [], stale_links: [] };
    else if (path === "/events/ticket") json = { ticket: "visual" };
    else if (path.includes("/connect")) { await route.fulfill({ status: 200, contentType: "text/event-stream", body: ': fixture\n\n' }); return; }
    else if (path === "/v1/governance/settings") json = { default_expiration_days: 7, max_downloads: 0 };
    else if (path === "/drop/visual") json = { valid: true, folder_name: "Audit folder", link_name: "Audit upload", description: "Deliver files securely", files_limit: 10, uploaded: 1, expires_at: null, has_password: false, owner_display_name: user.username, owner_organization: "Audit organization" };
    else if (path === "/share/visual/info") json = { filename: file.filename, file_size: 1024, expires_at: null, is_expired: false, owner_display_name: user.username, access_count: 1 };
    else if (path === "/folder-share/visual/info") json = { folder_name: "Audit folder", owner_display_name: user.username, expires_at: null, is_expired: false, access_count: 1, tree: { id: "visual-folder", name: "Audit folder", files: [file], subfolders: [] }, total_files: 1, total_size: 1024 };
    else if (path === "/folder-share/visual/keys") json = {};
    else if (path === "/file-requests/visual/info") json = { description: "Audit document request", expires_at: null, is_expired: false, owner_display_name: user.username, uploaded_count: 1, max_file_size: 10485760 };
    await route.fulfill({ json });
  });
}

async function inspect(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const rgba = (color: string) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); const a = [...ctx.getImageData(0, 0, 1, 1).data]; return [a[0], a[1], a[2], a[3] / 255]; };
    const mix = (a: number[], b: number[]) => [0, 1, 2].map(i => a[i] * a[3] + b[i] * (1 - a[3])).concat(1);
    const lum = (c: number[]) => c.slice(0, 3).map(x => { const v = x / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
    const failures: { text: string; ratio: number; className: string }[] = [];
    let measured = 0, gradients = 0;
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const text = [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join("").trim();
      if (!text || el.closest("svg, script, style, [aria-hidden=true], .sr-only, [disabled]")) continue;
      const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
      if (!rect.width || !rect.height || rect.right <= 0 || rect.left >= innerWidth || style.visibility === "hidden" || style.display === "none") continue;
      let backgrounds = [[255, 255, 255, 1]], opacity = 1, unknownImage = false;
      let foregrounds = [rgba(style.color)];
      const chain: HTMLElement[] = []; let ancestor: HTMLElement | null = el;
      while (ancestor) { chain.unshift(ancestor); ancestor = ancestor.parentElement; }
      for (const node of chain) {
        const s = getComputedStyle(node), color = rgba(s.backgroundColor);
        backgrounds = backgrounds.map(bg => mix(color, bg));
        if (color[3] === 1) unknownImage = false;
        if (s.backgroundImage !== "none") {
          const stops = [...s.backgroundImage.matchAll(/(?:rgba?|oklch|oklab|color)\([^)]*\)/g)].map(m => rgba(m[0]));
          if (s.backgroundClip === "text") foregrounds = stops.length ? stops : foregrounds;
          else if (stops.length) {
            // Test every gradient stop over its inherited surface. This is a
            // conservative endpoint check; screenshots cover spatial blending.
            backgrounds = backgrounds.flatMap(bg => stops.map(stop => mix(stop, bg)));
            backgrounds = [...new Map(backgrounds.map(bg => [bg.map(v => Math.round(v)).join(","), bg])).values()];
            gradients++;
          } else unknownImage = true;
        }
        opacity *= Number(s.opacity);
      }
      if (opacity < .95 || unknownImage) continue;
      const ratio = Math.min(...backgrounds.flatMap(bg => foregrounds.map(color => {
        const a = lum(mix(color, bg)), b = lum(bg);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      })));
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
      measured++;
      if (ratio + .03 < (large ? 3 : 4.5)) failures.push({ text: text.slice(0, 100), ratio: Math.round(ratio * 100) / 100, className: String(el.className) });
    }
    return { measured, gradients, failures, overflow: document.documentElement.scrollWidth > innerWidth + 1, width: document.documentElement.scrollWidth, overflowElements: document.documentElement.scrollWidth > innerWidth + 1 ? [...document.querySelectorAll<HTMLElement>("body *")].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0,20).map(el => ({ tag: el.tagName, className: String(el.className), right: el.getBoundingClientRect().right })) : [], textLength: document.body.innerText.length };
  });
}

for (const skin of ["light", "business", "dark", "quantix", "cyberpunk", "elegant"]) {
  for (const width of [1280, 390]) {
    test(`${skin} ${width}: routed screens and protection dialog`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await fixture(page, skin);
      const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
      const report: Record<string, Awaited<ReturnType<typeof inspect>>> = {};
      const out = process.env.THEME_AUDIT_OUTPUT || test.info().outputPath("screens");
      await mkdir(out, { recursive: true });
      for (const route of routes) {
        await page.goto(route || "./", { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute("data-theme", skin);
        await page.waitForTimeout(750); // settle lazy route and Framer Motion entry transitions
        await page.waitForFunction(() => document.body.innerText.length > 80);
        // Trigger real scroll observers before auditing below-the-fold content.
        for (const section of await page.locator(".scroll-fade-in").all()) {
          await section.evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" }));
          await expect(section).toHaveCSS("opacity", "1");
        }
        if (await page.locator(".scroll-fade-in").count()) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(900);
          for (const section of await page.locator(".scroll-fade-in").all()) {
            expect(Number(await section.evaluate(el => getComputedStyle(el).opacity))).toBeGreaterThanOrEqual(.95);
          }
        }
        if (route === "" || route === "about") {
          expect(await page.locator("nav").evaluate(el => {
            const controls = [...el.querySelectorAll("a, button")].filter(node => {
              const r = node.getBoundingClientRect(); return r.width && r.height;
            });
            return controls.every((a, i) => controls.slice(i + 1).every(b => {
              if (a.contains(b) || b.contains(a)) return true;
              const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
              return x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top;
            }));
          }), "Navigation controls do not overlap").toBe(true);
        }
        const name = route.split(/[/#]/).filter(Boolean).slice(0, 2).join("-") || "home";
        report[name] = await inspect(page);
        await page.screenshot({ path: `${out}/${skin}-${width}-${name}.png`, fullPage: true });
        if (route === "files") {
          if (width === 390) {
            await page.getByRole("button", { name: "Open menu", exact: true }).click();
            await page.waitForTimeout(400);
            report["mobile-navigation"] = await inspect(page);
            await page.screenshot({ path: `${out}/${skin}-${width}-mobile-navigation.png`, fullPage: true });
            await page.getByRole("button", { name: "Close menu", exact: true }).click();
          }
          await page.locator(`#file-row-${file.id}`).getByText(file.filename, { exact: true }).click();
          await page.waitForTimeout(500);
          const title = page.getByRole("heading", { name: file.filename, exact: true });
          await expect(title).toBeVisible();
          const shell = title.locator("../..");
          expect(await shell.evaluate(el => {
            const r = el.getBoundingClientRect();
            return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && el.contains(document.elementFromPoint(r.left + 12, r.top + 12));
          }), "Preview is inside viewport and above navigation").toBe(true);
          report.protection = await inspect(page);
          await page.screenshot({ path: `${out}/${skin}-${width}-protection.png`, fullPage: true });
          await page.locator("#preview-credential").scrollIntoViewIfNeeded();
          await expect(page.locator("#preview-credential")).toBeVisible();
          await page.getByRole("button", { name: "Close preview", exact: true }).click();
          await page.locator(`#file-row-${file.id}`).getByRole("checkbox").check();
          await page.getByRole("button", { name: "Download 1", exact: true }).click();
          await expect(page.locator("#bulk-download-pin")).toBeVisible();
          await page.waitForTimeout(300);
          report["download-pin"] = await inspect(page);
          await page.screenshot({ path: `${out}/${skin}-${width}-download-pin.png`, fullPage: true });
        }
        if (route === "settings") {
          for (const tab of ["Security", "Advanced", "Governance"]) {
            await page.getByRole("tab", { name: tab, exact: true }).click();
            await page.waitForTimeout(300);
            await expect(page.getByRole("tabpanel")).toBeVisible();
            report[`settings-${tab.toLowerCase()}`] = await inspect(page);
            await page.screenshot({ path: `${out}/${skin}-${width}-settings-${tab.toLowerCase()}.png`, fullPage: true });
          }
        }
      }
      await writeFile(`${out}/${skin}-${width}.json`, JSON.stringify({ errors, report }, null, 2));
      if (!process.env.THEME_AUDIT_BASELINE) {
        expect(errors, "No route runtime errors").toEqual([]);
        for (const [route, result] of Object.entries(report)) {
          expect.soft(result.textLength, `${route} rendered content`).toBeGreaterThan(80);
          expect.soft(result.overflow, `${route} horizontal overflow ${result.width}`).toBe(false);
          expect.soft(result.failures, `${route} text contrast`).toEqual([]);
        }
      }
    });
  }
}


test("template selection persists through navigation and reload", async ({ page }) => {
  await fixture(page, "light");
  await page.goto("settings");
  for (const [skin, label] of [["quantix", "QuantiX"], ["light", "Light"], ["dark", "Dark"], ["cyberpunk", "Cyberpunk"], ["elegant", "Elegant"], ["business", "Business"]]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", skin);
    await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", skin);
    await page.goto("files");
    await expect(page.locator("html")).toHaveAttribute("data-theme", skin);
    await page.goto("settings");
  }
});

for (const skin of ["light", "business", "dark", "quantix", "cyberpunk", "elegant"]) {
  test(`${skin}: folder and upload-link forms at phone height`, async ({ page }) => {
    await fixture(page, skin);
    await page.setViewportSize({ width: 1280, height: 650 });
    await page.goto("files");
    await page.getByRole("button", { name: "Create folder", exact: true }).click();
    const folderName = page.getByLabel("Folder Name");
    await folderName.fill("A visible folder name");
    await expect(folderName).toHaveValue("A visible folder name");
    await page.waitForTimeout(300);
    expect((await inspect(page)).failures).toEqual([]);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Manage", exact: true }).first().click();
    await page.getByRole("button", { name: "Create New Link", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 650 });
    await expect(page.locator("#linkName")).toBeVisible();
    await page.locator("#linkName").fill("A visible upload link");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
    await page.waitForTimeout(400);
    const result = await inspect(page);
    const out = process.env.THEME_AUDIT_OUTPUT || test.info().outputPath("screens");
    await mkdir(out, { recursive: true });
    await page.screenshot({ path: `${out}/${skin}-upload-link.png`, fullPage: true });
    await writeFile(`${out}/${skin}-forms.json`, JSON.stringify(result, null, 2));
    if (!process.env.THEME_AUDIT_BASELINE) {
      expect(result.overflow).toBe(false);
      expect(result.failures).toEqual([]);
    }
    await page.locator("#folder").selectOption("visual-folder");
    await page.locator("#pin").fill("4321");
    await page.getByRole("button", { name: "Create Link", exact: true }).click();
    await expect(page.getByText("Secure Drop route ready", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Copy full upload link", exact: true }).click();
    await page.waitForTimeout(300);
    const created = await inspect(page);
    await writeFile(`${out}/${skin}-created-link.json`, JSON.stringify(created, null, 2));
    await page.screenshot({ path: `${out}/${skin}-created-link.png`, fullPage: true });
    if (!process.env.THEME_AUDIT_BASELINE) expect(created.failures).toEqual([]);
  });
}


for (const skin of ["light", "business", "dark", "quantix", "cyberpunk", "elegant"]) {
  test(`${skin}: share, move and first-time PIN setup`, async ({ page }) => {
    await fixture(page, skin);
    const report: Record<string, Awaited<ReturnType<typeof inspect>>> = {};
    const out = process.env.THEME_AUDIT_OUTPUT || test.info().outputPath("screens");
    await mkdir(out, { recursive: true });
    const capture = async (state: string) => {
      await page.waitForTimeout(400);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      report[state] = await inspect(page);
      await page.screenshot({ path: `${out}/${skin}-${state}.png`, fullPage: true });
    };
    await page.goto("files");
    await page.locator(`#file-row-${file.id}`).hover();
    await page.locator(`#file-row-${file.id}`).getByTitle("Move to folder", { exact: true }).click();
    await page.locator("#move-file-folder").selectOption("visual-destination");
    await capture("move-file");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.locator(`#file-row-${file.id}`).hover();
    await page.locator(`#file-row-${file.id}`).getByTitle("Share with user", { exact: true }).click();
    await page.getByPlaceholder("Type at least 2 characters...").fill("Visual");
    await capture("share-user");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

    await page.locator(`#file-row-${file.id}`).getByTitle("Create share link", { exact: true }).click();
    await capture("file-share-link");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.locator("#file-input").setInputFiles({ name: "Visible upload fixture.txt", mimeType: "text/plain", buffer: Buffer.from("Synthetic fixture only") });
    await capture("selected-upload");
    await page.goto("files");
    await page.getByRole("button", { name: "Navigate to Audit folder", exact: true }).click();
    await capture("active-folder");
    await page.getByRole("button", { name: "Folder actions for Audit folder", exact: true }).click();
    await page.getByRole("button", { name: "Share Folder", exact: true }).click();
    await capture("folder-share-link");

    await page.goto("settings");
    await page.getByRole("tab", { name: "Advanced", exact: true }).click();
    await page.getByRole("button", { name: "New key", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#agent-key-name").fill("Visual fixture agent");
    await capture("agent-key-form");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.goto("admin");
    await page.getByRole("button", { name: "New User", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Create New User", exact: true })).toBeVisible();
    await capture("admin-user-form");
    await page.goto("groups");
    await page.getByRole("button", { name: "Create group", exact: true }).click();
    await page.getByPlaceholder("e.g. Marketing Team").fill("Visual fixture group");
    await capture("group-form");

    // Synthetic encrypted key envelope exercises all four onboarding screens.
    // No account credentials or customer key material are used.
    const salt = Buffer.alloc(16, 1), iv = Buffer.alloc(12, 2), password = "visual-password";
    const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(Buffer.concat([salt, Buffer.from(password)])).digest(), iv);
    const ciphertext = Buffer.concat([cipher.update("visual fixture key material"), cipher.final(), cipher.getAuthTag()]);
    const encrypted = Buffer.concat([salt, iv, ciphertext]).toString("base64");
    await page.addInitScript(({ encrypted }) => {
      const current = JSON.parse(localStorage.getItem("user")!);
      localStorage.setItem("user", JSON.stringify({ ...current, pin_set: false, private_key_encrypted: encrypted, kek_envelope_version: 1 }));
    }, { encrypted });
    await page.route("**/users/pin/status", route => route.fulfill({ json: { pin_set: false } }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("dashboard");
    await expect(page.getByRole("heading", { name: "Your files, your control", exact: true })).toBeVisible();
    await capture("onboarding-privacy");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.locator("#onboarding-pin").fill("4321");
    await page.locator("#onboarding-confirm-pin").fill("4321");
    await page.locator("#onboarding-account-password").fill(password);
    await capture("onboarding-pin");
    await page.getByRole("button", { name: "Set PIN", exact: true }).click();
    await expect(page.locator("#onboarding-folder-name")).toBeVisible();
    await capture("onboarding-folder");
    await page.getByRole("button", { name: "Skip for now", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Vault is ready", exact: true })).toBeVisible();
    await capture("onboarding-ready");
    await page.getByRole("button", { name: "Upload a file", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Vault is ready", exact: true })).toHaveCount(0);
    await writeFile(`${out}/${skin}-extra.json`, JSON.stringify({ report }, null, 2));
    if (!process.env.THEME_AUDIT_BASELINE) for (const [name, result] of Object.entries(report)) {
      expect.soft(result.overflow, name).toBe(false);
      expect.soft(result.failures, name).toEqual([]);
    }
  });
}

test("Spanish phone navigation and preview in all six templates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, "light");
  await page.addInitScript(() => localStorage.setItem("i18nextLng", "es"));
  await page.goto("./");
  const out = process.env.THEME_AUDIT_OUTPUT || test.info().outputPath("screens");
  await mkdir(out, { recursive: true });
  for (const skin of ["light", "business", "dark", "quantix", "cyberpunk", "elegant"]) {
    await page.evaluate(skin => localStorage.setItem("abrn-drive-skin", skin), skin);
    await page.goto("./");
    await expect(page.locator("html")).toHaveAttribute("data-theme", skin);
    await expect(page.getByRole("link", { name: "Inicio", exact: true })).toBeVisible();
    const report: Record<string, Awaited<ReturnType<typeof inspect>>> = {};
    for (const state of ["home", "files", "protection"]) {
      if (state === "files") await page.goto("files");
      if (state === "protection") await page.locator(`#file-row-${file.id}`).getByText(file.filename, { exact: true }).click();
      await page.waitForTimeout(750);
      report[state] = await inspect(page);
      expect(report[state].overflow, `${skin} Spanish ${state}`).toBe(false);
      expect(report[state].failures, `${skin} Spanish ${state}`).toEqual([]);
      await page.screenshot({ path: `${out}/${skin}-es-${state}.png`, fullPage: true });
    }
    await page.locator("#preview-credential").scrollIntoViewIfNeeded();
    await expect(page.locator("#preview-credential")).toBeVisible();
    await page.getByRole("button", { name: "Close preview", exact: true }).click();
    await writeFile(`${out}/${skin}-es.json`, JSON.stringify({ report }, null, 2));
  }
});
