import type { Page } from "@playwright/test";

export const user = { id: "visual-user", username: "Visual Fixture", first_name: "Visual", last_name: "Fixture", email: "visual@example.test", pin_set: true, is_admin: true, created_at: "2026-09-14T00:00:00Z" };
export const file = { id: "visual-file", folder_id: "visual-folder", filename: "Contrast audit.txt", metadata: JSON.stringify({ credential_scheme: "pin", salt: "AA==", iv: "AA==" }), is_owner: true, owner_name: "Visual Fixture", owner_username: "Visual Fixture", file_size: 1024, created_at: "2026-09-14T00:00:00Z" };
export const group = { id: "visual-group", name: "Audit team", description: "Template visibility fixture", owner_id: user.id, is_owner: true, member_count: 1, created_at: file.created_at };
export const key = "0".repeat(64);
export const shareKey = Buffer.alloc(32).toString("base64");
export const routes = ["", "about", "login", "recover", "force-password-change", "dashboard", "files", "shared", "profile", "settings", "groups", "groups/visual-group", "admin", "admin/tests", "access-center", "help", "room/visual-room", `drop/visual#key=${key}`, `share/visual#${shareKey}`, `folder-share/visual#${shareKey}`, "request/visual"];

export async function fixture(page: Page, skin: string) {
  await page.addInitScript(({ skin, user }) => {
    const part = (value: unknown) => btoa(JSON.stringify(value)).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
    localStorage.setItem("token", `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`);
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

export async function inspect(page: Page) {
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
