const { chromium } = require('playwright');

const PAGE_URL = 'https://dev-app.filemonprime.net/ABRN-Drive';
const USERNAME = 'v.cazares@abrn.mx';
const PASSWORD = 'Vx986532';

async function main() {
  console.log('Starting Playwright browser automation...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  console.log('✓ Browser launched successfully');

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  const startTime = Date.now();

  console.log('\nStep 1: Navigating to login page...');
  await page.goto(PAGE_URL, { waitUntil: 'networkidle' });
  const loadTime = Date.now() - startTime;
  console.log(`✓ Page loaded in ${loadTime}ms`);

  console.log('\nStep 2: Taking initial screenshot...');
  await page.screenshot({ path: '/tmp/01-landing-page.png', fullPage: true });
  console.log('✓ Screenshot saved: /tmp/01-landing-page.png');

  console.log('\nStep 3: Finding login form...');
  const usernameField = await page.locator('input[type="email"], input[placeholder*="email"], input[name*="email"]').first();
  const passwordField = await page.locator('input[type="password"]').first();
  const loginButton = await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first();

  await usernameField.fill(USERNAME);
  console.log(`✓ Username filled: ${USERNAME}`);

  await passwordField.fill(PASSWORD);
  console.log('✓ Password filled');

  console.log('\nStep 4: Submitting login...');
  await loginButton.click();

  console.log('Waiting for navigation...');
  await page.waitForNavigation({ waitUntil: 'networkidle' });

  const currentUrl = page.url();
  console.log(`✓ Logged in, current URL: ${currentUrl}`);

  console.log('\nStep 5: Taking post-login screenshot...');
  await page.screenshot({ path: '/tmp/02-post-login.png', fullPage: true });
  console.log('✓ Screenshot saved: /tmp/02-post-login.png');

  console.log('\nStep 6: Navigating to email page...');
  const emailButton = await page.locator('a[href*="email"], button:has-text("Email"), nav a:has-text("Mail")').first();
  await emailButton.click();

  console.log('Waiting for email page to load...');
  await page.waitForLoadState('networkidle');

  const emailPageUrl = page.url();
  console.log(`✓ Email page loaded: ${emailPageUrl}`);

  console.log('\nStep 7: Taking email page screenshot...');
  await page.screenshot({ path: '/tmp/03-email-page.png', fullPage: true });
  console.log('✓ Screenshot saved: /tmp/03-email-page.png');

  console.log('\nStep 8: Waiting for emails to load (max 5 seconds)...');
  const emailLoadStart = Date.now();
  let emailsLoaded = false;
  let loadError = false;

  try {
    await page.waitForSelector('.email-item, .message-item, [data-testid="email-list"], .email-list', {
      timeout: 5000
    });
    const emailLoadTime = Date.now() - emailLoadStart;
    console.log(`✓ Emails loaded in ${emailLoadTime}ms`);
    emailsLoaded = true;
  } catch (error) {
    const emailLoadTime = Date.now() - emailLoadStart;
    console.log(`⚠️  Email list selector not found after ${emailLoadTime}ms`);
    console.log('Checking for error message...');

    const errorText = await page.locator('body').innerText();
    if (errorText.includes('Failed to fetch emails') || errorText.includes('error')) {
      console.log('❌ Error message detected in page');
      loadError = true;
    }
  }

  console.log('\nStep 9: Taking final screenshot...');
  await page.screenshot({ path: '/tmp/04-final-state.png', fullPage: true });
  console.log('✓ Screenshot saved: /tmp/04-final-state.png');

  console.log('\nStep 10: Checking console for errors...');
  const logs = [];
  page.on('console', msg => logs.push(`${msg.type()}: ${msg.text()}`));
  const errors = logs.filter(log => log.includes('error') || log.includes('Error'));

  if (errors.length > 0) {
    console.log(`⚠️  Found ${errors.length} console errors:`);
    errors.forEach(err => console.log(`  ${err}`));
  } else {
    console.log('✓ No console errors detected');
  }

  console.log('\nStep 11: Checking network requests...');
  const networkLogs = [];
  page.on('response', response => {
    if (response.url().includes('/api/email/accounts/')) {
      networkLogs.push({
        url: response.url(),
        status: response.status(),
        ok: response.ok()
      });
    }
  });

  await sleep(2000);

  console.log(`✓ Captured ${networkLogs.length} email API requests`);
  networkLogs.forEach(log => {
    console.log(`  ${log.url}`);
    console.log(`  Status: ${log.status} ${log.ok ? '✓' : '❌'}`);
    if (!log.ok) {
      loadError = true;
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS');
  console.log('='.repeat(60));

  if (emailsLoaded && !loadError) {
    console.log('✅ EMAIL INTEGRATION WORKING');
    console.log('   Emails loaded successfully without errors');
    console.log('   The deadlock fix appears to be working');
  } else if (loadError) {
    console.log('❌ EMAIL INTEGRATION FAILED');
    console.log('   Error messages detected in the page');
    console.log('   The deadlock fix may not be complete');
  } else {
    console.log('⚠️  INCONCLUSIVE');
    console.log('   Could not verify email list loading');
    console.log('   May need to adjust selectors or check console logs');
  }

  console.log('\nScreenshots saved to /tmp/:');
  console.log('  01-landing-page.png');
  console.log('  02-post-login.png');
  console.log('  03-email-page.png');
  console.log('  04-final-state.png');

  console.log('\nNext steps:');
  console.log('1. Review screenshots to verify email loading');
  console.log('2. Check console output for errors');
  console.log('3. Verify network requests for API failures');

  await browser.close();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);