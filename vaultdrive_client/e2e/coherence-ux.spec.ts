import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { file, fixture, inspect } from "./helpers/theme-fixture";

const skins = ["light", "business", "dark", "quantix", "cyberpunk", "elegant"] as const;
const locales = ["en", "es"] as const;
const widths = [1280, 390] as const;


const labels = {
  en: {
    noRoutes: "No external read routes are listed.",
    ownerKind: "Owner",
    intakeKind: "Secure Drop delivery source",
    accessAction: "Who can access this file?",
    revoke: "Revoke direct access and file links",
    revokeNow: "Revoke now",
    revokeUnknown: "Revocation was not confirmed. Refresh access before deciding whether to retry.",
    revokeConfirmed: "Direct shares and file links were closed. Folder access and downloaded copies are unaffected. Review the refreshed access list.",
    nav: "Main navigation",
    longNav: "Shared with Me",
    palette: "Search and commands",
    sharedPinError: "That PIN could not unlock your account key. Re-enter your current vault PIN. If it still fails, recover your account or ask the sender to share the file again.",
    revokeScope: "This closes direct recipient grants and public file links. Folder permissions, copies already downloaded and downloads in progress are unaffected.",
  },
  es: {
    noRoutes: "No se indican vías de lectura externas.",
    ownerKind: "Propietario",
    intakeKind: "Origen de entrega Secure Drop",
    accessAction: "¿Quién puede acceder?",
    revoke: "Revocar acceso directo y enlaces de archivo",
    revokeNow: "Revocar ahora",
    revokeUnknown: "No se confirmó la revocación. Actualiza el acceso antes de decidir si debes reintentar.",
    revokeConfirmed: "Se cerraron los permisos directos y los enlaces de archivo. El acceso por carpeta y las copias descargadas no cambiaron. Revisa la lista actualizada.",
    nav: "Navegación principal",
    longNav: "Compartidos conmigo",
    palette: "Buscar y ejecutar comandos",
    sharedPinError: "Ese PIN no pudo desbloquear la clave de tu cuenta. Vuelve a ingresar tu PIN actual de bóveda. Si sigue fallando, recupera tu cuenta o pide al remitente que comparta el archivo de nuevo.",
    revokeScope: "Esto cierra los permisos directos a destinatarios y los enlaces públicos de archivo. No cambia los permisos de carpeta, las copias ya descargadas ni las descargas en curso.",
  },
} as const;

const sharedFile = {
  id: "shared-visual-file",
  filename: "Shared quarterly evidence with a deliberately long filename.txt",
  file_size: 2048,
  owner_username: "Fixture Sender",
  shared_at: "2026-09-14T00:00:00Z",
  encrypted_metadata: JSON.stringify({ credential_scheme: "pin", iv: "AA==" }),
};

test.use({
  actionTimeout: 15_000,
  serviceWorkers: "block",
  contextOptions: { reducedMotion: "reduce" },
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
});
test.describe.configure({ mode: "parallel" });
test.setTimeout(180_000);

async function installCriticalStateFixture(page: Page, skin: string, locale: "en" | "es") {
  await fixture(page, skin);
  await page.addInitScript(({ locale }) => {
    localStorage.setItem("i18nextLng", locale);
    const stored = JSON.parse(localStorage.getItem("user") ?? "{}");
    localStorage.setItem("user", JSON.stringify({
      ...stored,
      private_key_pin_encrypted: "fixture-invalid-pin-envelope",
      kek_envelope_version: 2,
    }));
  }, { locale });

  let revokeAttempts = 0;
  await page.route("**/api/files/shared", route => route.fulfill({ json: [sharedFile] }));
  await page.route("**/api/files/shared-visual-file/download", route => route.fulfill({
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Wrapped-Key": "fixture-invalid-wrapped-key",
      "X-File-Metadata": JSON.stringify({ iv: "AA==" }),
    },
    body: "fixture ciphertext",
  }));
  await page.route(`**/api/v1/files/${file.id}/access-summary`, route => route.fulfill({ json: {
    entries: [
      { kind: "owner", label: "Owner", state: "active", since: file.created_at },
      { kind: "secure_drop", label: "Secure Drop intake", state: "active", since: file.created_at },
      { kind: "direct", label: "Direct user: Review recipient", state: "active", since: file.created_at },
      { kind: "share_link", label: "Public link", state: "active", since: file.created_at, access_count: 2 },
    ],
  } }));
  await page.route(`**/api/v1/files/${file.id}/revoke-external`, async route => {
    revokeAttempts += 1;
    await route.fulfill({ status: 503, json: { error: "fixture unavailable" } });
  });
  return { revokeAttempts: () => revokeAttempts };
}

async function capture(page: Page, name: string) {
  const screens = process.env.COHERENCE_EVIDENCE_DIR
    ? path.resolve(process.env.COHERENCE_EVIDENCE_DIR, "screens")
    : test.info().outputPath("screens");
  await mkdir(screens, { recursive: true });
  const result = await inspect(page);
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    documentScrollWidth: document.documentElement.scrollWidth,
    documentScrollHeight: document.documentElement.scrollHeight,
  }));
  const report = { ...result, ...dimensions };
  await page.screenshot({ path: path.join(screens, `${name}.png`), fullPage: false });
  await writeFile(path.join(screens, `${name}.json`), JSON.stringify(report, null, 2));
  expect.soft(result.overflow, `${name}: horizontal overflow (${dimensions.documentScrollWidth}px document / ${dimensions.viewportWidth}px viewport)`).toBe(false);
  expect.soft(result.failures, `${name}: text contrast`).toEqual([]);
  return report;
}

async function expectInsideViewport(locator: Locator) {
  expect(await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1;
  })).toBe(true);
}

for (const skin of skins) {
  for (const locale of locales) {
    test(`${skin} ${locale}: desktop and phone critical credential, trust and recovery states`, async ({ page }) => {
      const copy = labels[locale];
      const state = await installCriticalStateFixture(page, skin, locale);
      for (const width of widths) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });

        await page.goto("files", { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute("data-theme", skin);
        const previewTrigger = page.locator(`#file-row-${file.id}`).getByRole("button", { name: file.filename, exact: true });
        await previewTrigger.focus();
        await previewTrigger.click();

        const preview = page.getByRole("dialog", { name: file.filename });
        await expect(preview).toBeVisible();
        const credential = preview.locator("#preview-credential");
        await expect(credential).toBeVisible();
        await expectInsideViewport(credential);
        const trustToggle = preview.locator('button[aria-expanded]');
        await expect(trustToggle).toHaveAttribute("aria-expanded", "false");
        await expect(preview.getByText(copy.noRoutes, { exact: true })).toHaveCount(0);
        await trustToggle.click();
        await expect(trustToggle).toHaveAttribute("aria-expanded", "true");
        await expect(preview.getByText(copy.noRoutes, { exact: true })).toBeVisible();
        await expect(preview.getByText(copy.ownerKind, { exact: true })).toHaveCount(0);
        await expect(preview.getByText(copy.intakeKind, { exact: true })).toHaveCount(0);
        await capture(page, `${skin}-${locale}-${width}-preview-trust`);

        await page.keyboard.press("Escape");
        await expect(preview).toHaveCount(0);
        await expect(previewTrigger).toBeFocused();

        await page.goto("shared", { waitUntil: "domcontentloaded" });
        const sharedName = page.getByText(sharedFile.filename, { exact: true });
        await expect(sharedName).toBeVisible();
        const sharedCard = sharedName.locator("xpath=ancestor::div[contains(@class, 'rounded-lg')][1]");
        await sharedCard.getByRole("button").last().click();
        const pinDialog = page.getByRole("dialog");
        await expect(pinDialog).toContainText(sharedFile.filename);
        const pin = pinDialog.locator("#shared-file-pin");
        await expect(pin).toBeVisible();
        await pin.fill("0000");
        await pinDialog.getByRole("button", { name: /Decrypt|Descifrar/ }).click();
        const pinError = pinDialog.getByRole("alert");
        await expect(pinError).toBeVisible();
        await expect(pinError).toHaveText(copy.sharedPinError);
        await expect(pinError).not.toContainText(/Invalid encrypted|OperationError/i);
        await expect(pin).toBeEnabled();
        await pin.fill("4321");
        await expect(pin).toHaveValue("4321");
        await capture(page, `${skin}-${locale}-${width}-shared-pin-error`);
        await page.keyboard.press("Escape");

        if (width === 1280) {
          await page.goto("files", { waitUntil: "domcontentloaded" });
          const row = page.locator(`#file-row-${file.id}`);
          await row.hover();
          await row.getByTitle(copy.accessAction, { exact: true }).click();
          const accessDialog = page.getByRole("dialog");
          await accessDialog.getByRole("button", { name: copy.revoke, exact: true }).click();
          await expect(accessDialog.getByText(copy.revokeScope, { exact: true })).toBeVisible();
          await capture(page, `${skin}-${locale}-${width}-revoke-confirmation`);
          await accessDialog.getByRole("button", { name: copy.revokeNow, exact: true }).click();
          await expect(accessDialog.getByRole("alert")).toContainText(copy.revokeUnknown);
          await expect(accessDialog.getByText(copy.revokeConfirmed, { exact: true })).toHaveCount(0);
          await expect(accessDialog.getByRole("status")).toHaveCount(0);
          expect(state.revokeAttempts()).toBe(1);
          await capture(page, `${skin}-${locale}-${width}-revoke-unknown`);
          await accessDialog.getByRole("button", { name: locale === "en" ? "Show support details" : "Mostrar datos de soporte", exact: true }).click();
          const support = accessDialog.getByRole("textbox", { name: locale === "en" ? "Support details preview" : "Vista previa de datos de soporte", exact: true });
          await expect(support).toBeVisible();
          const details = await support.inputValue();
          expect(details).toContain("Operation: access_revoke");
          expect(details).toContain("Confirmation: unknown");
          expect(details).not.toMatch(/visual@example|Contrast audit|Bearer|fixture-invalid|#key=/);
          await support.scrollIntoViewIfNeeded();
          await capture(page, `${skin}-${locale}-${width}-support-preview`);
        } else {
          await page.goto("files", { waitUntil: "domcontentloaded" });
          const menuButton = page.getByRole("button", { name: "Open menu", exact: true });
          await menuButton.click();
          const mobileNav = page.getByRole("dialog", { name: copy.nav, exact: true });
          await expect(mobileNav.getByRole("link", { name: copy.longNav, exact: true })).toBeVisible();
          await expectInsideViewport(mobileNav);
          await capture(page, `${skin}-${locale}-${width}-mobile-menu`);
          await page.keyboard.press("Escape");
          await expect(menuButton).toBeFocused();

          const searchButton = page.getByRole("button", { name: "Search", exact: true });
          await searchButton.click();
          const palette = page.getByRole("dialog", { name: copy.palette, exact: true });
          const paletteInput = palette.locator("input");
          await expect(paletteInput).toBeFocused();
          await paletteInput.fill(file.filename);
          await expect(palette.getByText(file.filename, { exact: true })).toBeVisible();
          await capture(page, `${skin}-${locale}-${width}-command-palette`);
          await page.keyboard.press("Escape");
          await expect(searchButton).toBeFocused();
        }
      }
    });
  }
}

for (const scenario of [
  { skin: "light", locale: "en" as const, physicalWidth: 1280, physicalHeight: 800 },
  { skin: "elegant", locale: "es" as const, physicalWidth: 390, physicalHeight: 844 },
]) {
  test(`${scenario.skin} ${scenario.locale} ${scenario.physicalWidth}: 200% CSS viewport reflow proxy`, async ({ browser }, testInfo) => {
    // Proxy only: halve the CSS viewport and render at deviceScaleFactor 2.
    // This exercises responsive reflow without claiming native browser-zoom or
    // physical-device acceptance.
    const context = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
      viewport: {
        width: Math.floor(scenario.physicalWidth / 2),
        height: Math.floor(scenario.physicalHeight / 2),
      },
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    try {
      await installCriticalStateFixture(page, scenario.skin, scenario.locale);
      await page.goto("files", { waitUntil: "domcontentloaded" });
      await page.locator(`#file-row-${file.id}`).getByRole("button", { name: file.filename, exact: true }).click();
      const preview = page.getByRole("dialog", { name: file.filename });
      const credential = preview.locator("#preview-credential");
      await expect(credential).toBeVisible();
      await credential.scrollIntoViewIfNeeded();
      await expectInsideViewport(credential);
      const decryptButton = preview.getByRole("button", { name: /Decrypt & Preview|Descifrar y ver/i });
      await decryptButton.scrollIntoViewIfNeeded();
      await expectInsideViewport(decryptButton);
      await capture(page, `${scenario.skin}-${scenario.locale}-${scenario.physicalWidth}-css-viewport-200-proxy`);
    } finally {
      await context.close();
    }
  });
}
