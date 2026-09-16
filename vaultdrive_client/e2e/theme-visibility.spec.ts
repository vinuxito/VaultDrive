import { test, expect } from "@playwright/test";
import { createCipheriv, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

// Visual fixtures never access customer files or mutate the live API.
test.use({ actionTimeout: 15000, serviceWorkers: "block", contextOptions: { reducedMotion: "reduce" }, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
test.describe.configure({ mode: "parallel" });
test.setTimeout(180_000);
import { fixture, inspect, file, routes } from "./helpers/theme-fixture";

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
          await page.getByRole("button", { name: /Protection & History/ }).click();
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
    await page.locator("#share-search").fill("Visual");
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
    await page.getByRole("button", { name: "Cerrar vista previa", exact: true }).click();
    await writeFile(`${out}/${skin}-es.json`, JSON.stringify({ report }, null, 2));
  }
});
