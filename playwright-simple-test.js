const { chromium } = require('playwright');

const PAGE_URL = 'https://dev-app.filemonprime.net/ABRN-Drive/email';

async function main() {
  console.log('Starting simplified Playwright test...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  console.log('Step 1: Setting auth token...');
  const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJleHAiOjE3Mzg1NjY5MjB9.test';
  await context.addCookies([{
    name: 'auth_token',
    value: authToken,
    domain: 'dev-app.filemonprime.net',
    path: '/'
  }]);

  console.log('\nStep 2: Navigating to email page...');
  const startTime = Date.now();
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  console.log(`✓ Page loaded in ${Date.now() - startTime}ms`);

  console.log('\nStep 3: Taking screenshot...');
  await page.screenshot({ path: '/tmp/email-page-direct.png', fullPage: true });
  console.log('✓ Screenshot saved: /tmp/email-page-direct.png');

  console.log('\nStep 4: Checking page content...');
  const pageContent = await page.content();

  if (pageContent.includes('Failed to fetch emails')) {
    console.log('❌ Error detected: "Failed to fetch emails"');
  } else if (pageContent.includes('Loading') || pageContent.includes('loading')) {
    console.log('⚠️  Page is still loading emails...');
  } else {
    console.log('✓ No error message detected');
  }

  console.log('\nStep 5: Checking for email list...');
  const hasEmailItems = pageContent.includes('email-item') ||
                       pageContent.includes('message-item') ||
                       pageContent.includes('from:') ||
                       pageContent.includes('subject:');

  if (hasEmailItems) {
    console.log('✓ Email list detected in page');
  } else {
    console.log('⚠️  No email list detected');
  }

  console.log('\nStep 6: Waiting for content to stabilize (5 seconds)...');
  await sleep(5000);

  console.log('\nStep 7: Taking final screenshot...');
  await page.screenshot({ path: '/tmp/email-page-final.png', fullPage: true });
  console.log('✓ Screenshot saved: /tmp/email-page-final.png');

  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log('Screenshots:');
  console.log('  /tmp/email-page-direct.png - Immediately after load');
  console.log('  /tmp/email-page-final.png - After 5 seconds');
  console.log('\nTo verify:');
  console.log('1. Check if emails appear in the screenshots');
  console.log('2. Look for "Failed to fetch emails" error');
  console.log('3. Check if page shows loading spinner');

  await browser.close();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);