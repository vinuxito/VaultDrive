const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:8082';
const results = [];

function pass(msg) { results.push('PASS ' + msg); }
function fail(msg) { results.push('FAIL ' + msg); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`${TARGET_URL}/abrn/login`);
  await page.waitForTimeout(2000);
  await page.locator('input[type="email"]').fill('filemon@abrn.mx');
  await page.locator('input[type="password"]').fill('986532');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(2500);

  const afterLoginUrl = page.url();
  if (!afterLoginUrl.includes('/login')) {
    pass('Login: redirected away from login page');
  } else {
    fail('Login: still on login page after submit');
  }

  await page.goto(`${TARGET_URL}/abrn/files`);
  await page.waitForTimeout(3000);

  if (page.url().includes('/files')) {
    pass('Navigation: files page loads');
  } else {
    fail('Navigation: files page did not load, URL: ' + page.url());
  }

  const shareCount = await page.locator('button[title="Share"]').count();
  if (shareCount > 0) {
    pass('UI: Share buttons present (' + shareCount + ' visible)');
  } else {
    fail('UI: No Share buttons found');
  }

  const linkCount = await page.locator('button[title="Create share link"]').count();
  if (linkCount > 0) {
    pass('UI: "Create share link" buttons present (' + linkCount + ' visible)');
  } else {
    fail('UI: No "Create share link" buttons found');
  }

  const shareBtn = page.locator('button[title="Share"]').first();
  const shareAlwaysVisible = await shareBtn.evaluate(function(el) {
    var curr = el;
    while (curr) {
      if (parseFloat(getComputedStyle(curr).opacity) < 0.5) return false;
      curr = curr.parentElement;
    }
    return true;
  });
  if (shareAlwaysVisible) {
    pass('Opacity fix: Share button visible without hover (opacity chain clear)');
  } else {
    fail('Opacity fix: Share button still invisible without hover');
  }

  const linkBtn = page.locator('button[title="Create share link"]').first();
  const linkAlwaysVisible = await linkBtn.evaluate(function(el) {
    var curr = el;
    while (curr) {
      if (parseFloat(getComputedStyle(curr).opacity) < 0.5) return false;
      curr = curr.parentElement;
    }
    return true;
  });
  if (linkAlwaysVisible) {
    pass('Opacity fix: "Create share link" button visible without hover (opacity chain clear)');
  } else {
    fail('Opacity fix: "Create share link" button still invisible without hover');
  }

  await shareBtn.click();
  await page.waitForTimeout(1000);
  const shareModalOpen = await page.locator('text=Share File').isVisible().catch(function() { return false; });
  if (shareModalOpen) {
    pass('Modal: Share modal opens on click');
  } else {
    fail('Modal: Share modal did not open');
  }

  const closeBtn = page.locator('button:has-text("Cancel")').first();
  if (await closeBtn.isVisible().catch(function() { return false; })) {
    await closeBtn.click();
  }
  await page.waitForTimeout(800);
  const modalGone = await page.locator('text=Share File').isVisible().catch(function() { return false; });
  if (!modalGone) {
    pass('Modal: Share modal closes correctly');
  } else {
    fail('Modal: Share modal did not close');
  }

  await page.locator('button[title="Create share link"]').first().click();
  await page.waitForTimeout(1000);
  const linkModalOpen = await page.locator('text=Create Share Link').isVisible().catch(function() { return false; });
  if (linkModalOpen) {
    pass('Modal: "Create Share Link" modal opens on click');
  } else {
    fail('Modal: "Create Share Link" modal did not open');
  }

  const closeLinkBtn = page.locator('button:has-text("Cancel")').first();
  if (await closeLinkBtn.isVisible().catch(function() { return false; })) {
    await closeLinkBtn.click();
  }
  await page.waitForTimeout(500);

  const downloadCount = await page.locator('button[title="Download"]').count();
  if (downloadCount > 0) pass('UI: Download buttons present');
  else fail('UI: No Download buttons found');

  const deleteCount = await page.locator('button[title="Delete"]').count();
  if (deleteCount > 0) pass('UI: Delete buttons present');
  else fail('UI: No Delete buttons found');

  const starCount = await page.locator('button[title="Star"], button[title="Unstar"]').count();
  if (starCount > 0) pass('UI: Star/Unstar buttons present');
  else fail('UI: No Star buttons found');

  const manageCount = await page.locator('button[title="Manage shares"]').count();
  if (manageCount > 0) pass('UI: "Manage shares" buttons present');
  else fail('UI: No "Manage shares" buttons found');

  const uploadBtn = await page.locator('label:has-text("Upload")').isVisible().catch(function() { return false; });
  if (uploadBtn) pass('UI: Upload button visible in header');
  else fail('UI: Upload button not found');

  const vaultTree = await page.locator('text=All Files').isVisible().catch(function() { return false; });
  if (vaultTree) pass('UI: VaultTree sidebar renders ("All Files" node visible)');
  else fail('UI: VaultTree sidebar not rendering');

  await page.screenshot({ path: '/tmp/e2e-final.png', fullPage: false });

  console.log('\n=== E2E VERIFICATION RESULTS ===');
  results.forEach(function(r) { console.log(r); });
  const passed = results.filter(function(r) { return r.startsWith('PASS'); }).length;
  const failed = results.filter(function(r) { return r.startsWith('FAIL'); }).length;
  console.log('\nSummary: ' + passed + ' passed, ' + failed + ' failed');

  await browser.close();
})();
