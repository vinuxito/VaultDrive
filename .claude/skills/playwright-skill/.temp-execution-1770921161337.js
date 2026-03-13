const { chromium } = require('playwright');

const TARGET_URL = 'https://dev-app.filemonprime.net/abrn/drop/54cbf152f070de318699aa698123f86f3b94f5ce0e74bf423d5d594895320803?key=317c377de265eb8b037ce36d3336324b1251603a25154fa4628241a1b9a23050a12a2916826612ca4e7fbc99cdd23f1419857c79eb95b4b6bef0d2f2d5321f8f0662b900dae8bad08cbac48d9ac063ccfbcf52ebfce940463b7f9dd2e4b4c330a23e8a39a1f3658621ec0862';
const TEST_FILE = '/tmp/test-upload-20mb.bin';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log('Navigating to:', TARGET_URL);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  
  console.log('Waiting for page to load...');
  await page.waitForTimeout(2000);

  console.log('Getting upload progress tracking...');
  
  // Track upload progress
  let progressUpdates = [];
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/upload')) {
      console.log('Upload request initiated:', response.status());
    }
  });

  // Click Select Files button
  console.log('Clicking Select Files button...');
  const fileInput = await page.waitForSelector('#file-input', { timeout: 5000 });
  
  // Set files on input
  console.log('Setting test file:', TEST_FILE);
  await page.setInputFiles('#file-input', [TEST_FILE]);
  
  console.log('Waiting for upload to complete (60s max)...');
  
  // Monitor progress
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    
    const progressSection = await page.$('.space-y-3');
    if (progressSection) {
      const text = await progressSection.textContent();
      if (text && text.includes('completed')) {
        console.log('Upload complete!');
        break;
      }
    }
  }

  // Take final screenshot
  await page.screenshot({ 
    path: '/tmp/upload-result.png', 
    fullPage: true 
  });
  
  console.log('Screenshot saved to /tmp/upload-result.png');
  
  await browser.close();
})();
