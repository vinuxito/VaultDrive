const { chromium } = require('playwright');

const TARGET_URL = 'https://abrndrive.filemonprime.net';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  try {
    await page.goto(`${TARGET_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('input').nth(0).fill('filemon@abrn.mx');
    await page.locator('input').nth(1).fill('986532');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await page.waitForLoadState('domcontentloaded');

    await page.goto(`${TARGET_URL}/files`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByText('Your encrypted file storage').waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);

    const allCheckboxes = page.locator('main input[type="checkbox"]');
    const checkboxCount = await allCheckboxes.count();
    const rowCheckboxCount = Math.max(checkboxCount - 1, 0);

    if (checkboxCount > 0) {
      await allCheckboxes.first().click();
      await page.waitForTimeout(400);
    }

    const bulkBarText = await page.locator('text=/selected in this view/i').first().innerText().catch(() => 'bulk bar not found');
    const checkedCount = await page.locator('main input[type="checkbox"]:checked').count();
    const folderSection = await page.locator('aside').innerText().catch(() => 'no sidebar');

    await page.screenshot({ path: '/tmp/files-selectall-verified.png', fullPage: true });

    console.log('CHECKBOX_COUNT:', checkboxCount);
    console.log('ROW_CHECKBOX_COUNT:', rowCheckboxCount);
    console.log('CHECKED_COUNT_AFTER_HEADER_CLICK:', checkedCount);
    console.log('BULK_BAR:', JSON.stringify(bulkBarText));
    console.log('SIDEBAR_TEXT:', JSON.stringify(folderSection.slice(0, 1200)));
    console.log('SCREENSHOT:/tmp/files-selectall-verified.png');
  } catch (error) {
    console.error('ERROR:', error.message);
    await page.screenshot({ path: '/tmp/files-selectall-verify-error.png', fullPage: true }).catch(() => {});
    console.log('ERROR_SCREENSHOT:/tmp/files-selectall-verify-error.png');
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
