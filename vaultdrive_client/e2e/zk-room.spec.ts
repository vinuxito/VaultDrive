import { test, expect } from "@playwright/test";
import {
  buildOwnerAccount,
  registerAccount,
  loginWithPassword,
  completeOnboarding,
  gotoStable,
} from "./helpers/trust";

test.describe("Zero-Knowledge Ephemeral Rooms", () => {
  // Ensure viewport is wide enough
  test.use({ viewport: { width: 1280, height: 720 } });

  test("two browser contexts join a room, negotiate ECDH key exchange, sync notepad and chat", async ({
    browser,
  }) => {
    // ── Setup Browser Contexts & Pages ──
    const context1 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const context2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Accounts for both peers
    const account1 = buildOwnerAccount();
    const account2 = buildOwnerAccount();

    // ── Step 1: Owner 1 registers and logs in ──
    await registerAccount(page1, account1);
    await loginWithPassword(page1, account1);
    await completeOnboarding(page1, account1, "Room Owner Vault");

    // ── Step 2: Owner 2 registers and logs in ──
    await registerAccount(page2, account2);
    await loginWithPassword(page2, account2);
    await completeOnboarding(page2, account2, "Joiner Vault");

    // ── Step 3: Owner 1 creates ZK Room ──
    await gotoStable(page1, "/dashboard");
    const createRoomBtn = page1.getByRole("button", { name: /Create ZK Room/i });
    await expect(createRoomBtn).toBeVisible({ timeout: 15000 });
    await createRoomBtn.click();

    // Wait for the room page to load and fetch the URL (containing the roomId and hash key)
    await page1.waitForURL(/\/room\/[a-f0-9-]+#.*/, { timeout: 15000 });
    const roomUrl = page1.url();
    expect(roomUrl).toContain("#"); // Hash contains the RoomKey

    // ── Step 4: Owner 2 navigates directly to the room URL ──
    await page2.goto(roomUrl, { waitUntil: "domcontentloaded" });
    await page2.waitForLoadState("load");

    // ── Step 5: Wait for both to show "2 active" status ──
    const activeText = /2 active/i;
    await expect(page1.getByText(activeText)).toBeVisible({ timeout: 20000 });
    await expect(page2.getByText(activeText)).toBeVisible({ timeout: 20000 });

    // ── Step 6: Test collaborative document sync ──
    // Owner 1 types in the notepad
    const editorPlaceholder = "Start typing collaborative, encrypted notes here...";
    const editor1 = page1.getByPlaceholder(editorPlaceholder);
    await expect(editor1).toBeVisible({ timeout: 10000 });
    
    // Type slowly to trigger event updates
    await editor1.click();
    await editor1.fill("Hello from Owner 1. Cryptography is cool.");

    // Owner 2 should receive the text
    const editor2 = page2.getByPlaceholder(editorPlaceholder);
    await expect(editor2).toBeVisible({ timeout: 10000 });
    await expect(editor2).toHaveValue("Hello from Owner 1. Cryptography is cool.", { timeout: 15000 });

    // ── Step 7: Test real-time secure chat ──
    // Send message from Owner 2
    const chatInput2 = page2.getByPlaceholder("Send secure message...");
    await expect(chatInput2).toBeVisible({ timeout: 10000 });
    await chatInput2.fill("Hello from peer 2!");
    await chatInput2.press("Enter");

    // Owner 1 should see the chat message in their feed
    await expect(page1.getByText("Hello from peer 2!")).toBeVisible({ timeout: 15000 });

    // Send message from Owner 1
    const chatInput1 = page1.getByPlaceholder("Send secure message...");
    await expect(chatInput1).toBeVisible({ timeout: 10000 });
    await chatInput1.fill("Confirmed! Connection is ZK-encrypted.");
    await chatInput1.press("Enter");

    // Owner 2 should see Owner 1's chat message
    await expect(page2.getByText("Confirmed! Connection is ZK-encrypted.")).toBeVisible({ timeout: 15000 });

    // Take screenshot of both pages to demonstrate visual success
    await page1.screenshot({ path: test.info().outputPath("zk-room-owner.png") });
    await page2.screenshot({ path: test.info().outputPath("zk-room-joiner.png") });
  });
});
