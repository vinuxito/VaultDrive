const { chromium } = require('playwright');
const crypto = require('crypto');

const TARGET_URL = 'https://dev-app.filemonprime.net';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300  // Slow down to see what's happening
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,  // Accept self-signed certs
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('📋 Step 1: Login as owner (filemon@abrn.mx)...');
    await page.goto(`${TARGET_URL}/abrn/login`);
    await page.waitForLoadState('networkidle');

    // Wait for Email input and fill it
    await page.waitForSelector('input[placeholder*="you@example.com" i]', { timeout: 10000 });
    await page.fill('input[placeholder*="you@example.com" i]', 'filemon@abrn.mx');
    await page.fill('input[type="password"]', '986532');
    await page.click('button:has-text("Login")');

    // Wait for login to complete (redirects to home)
    await page.waitForURL('**/abrn/**', { timeout: 10000 });
    console.log('✅ Login successful');

    // Navigate to Files page
    await page.click('a:has-text("Files")');
    await page.waitForLoadState('networkidle');

    console.log('\n📋 Step 2: Create password-protected upload link...');
    await page.waitForTimeout(1000);

    // Click "Create New Link" or similar button
    const createButton = page.locator('button:has-text("Create"), button:has-text("New Link"), button:has-text("Upload Link")').first();
    await createButton.click();
    await page.waitForTimeout(500);

    // Set password for the link
    const testPassword = 'TestPassword123!';
    const passwordInput = page.locator('input[type="password"], input[placeholder*="password" i]').first();
    await passwordInput.fill(testPassword);
    console.log(`   Password set: ${testPassword}`);

    // Submit to create the link
    const submitButton = page.locator('button:has-text("Create"), button:has-text("Generate"), button[type="submit"]').last();
    await submitButton.click();

    // Wait for success dialog/modal
    await page.waitForTimeout(2000);

    // Extract the upload URL
    const uploadUrlElement = page.locator('input[readonly], input[value*="/drop/"]').first();
    const uploadUrl = await uploadUrlElement.inputValue();
    console.log(`✅ Upload link created: ${uploadUrl}`);

    // Extract just the path (e.g., /abrn/drop/token?key=...)
    const urlPath = uploadUrl.includes('http')
      ? new URL(uploadUrl).pathname + new URL(uploadUrl).search
      : uploadUrl;

    // Close the modal
    const closeButton = page.locator('button:has-text("Done"), button:has-text("Close"), [aria-label="Close"]').first();
    await closeButton.click();
    await page.waitForTimeout(500);

    console.log('\n📋 Step 3: Open upload page in new context (as uploader)...');
    const uploaderContext = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1920, height: 1080 }
    });
    const uploaderPage = await uploaderContext.newPage();

    await uploaderPage.goto(`${TARGET_URL}${urlPath}`);
    await uploaderPage.waitForLoadState('networkidle');
    console.log('✅ Upload page loaded');

    console.log('\n📋 Step 4: Create and upload test file...');

    // Create a test file
    const testFileContent = `Test file uploaded at ${new Date().toISOString()}\nThis file should be encrypted and decryptable by the owner.`;
    const testFileName = 'test-upload.txt';

    // Set up file chooser handler
    uploaderPage.on('filechooser', async (fileChooser) => {
      // Create temp file
      const fs = require('fs');
      const tempPath = `/tmp/${testFileName}`;
      fs.writeFileSync(tempPath, testFileContent);
      await fileChooser.setFiles(tempPath);
    });

    // Trigger file chooser
    const fileInput = uploaderPage.locator('input[type="file"]');
    await fileInput.click();
    await uploaderPage.waitForTimeout(1000);

    // Click upload button
    const uploadButton = uploaderPage.locator('button:has-text("Upload")').first();
    await uploadButton.click();

    // Wait for upload success
    await uploaderPage.waitForSelector('.success, [class*="success"], :has-text("success")', {
      timeout: 15000,
      state: 'visible'
    });
    console.log('✅ File uploaded successfully');

    await uploaderPage.screenshot({ path: '/tmp/upload-success.png' });
    console.log('   Screenshot saved: /tmp/upload-success.png');

    await uploaderContext.close();

    console.log('\n📋 Step 5: Owner downloads and decrypts file...');

    // Go back to owner's page and refresh
    await page.goto(`${TARGET_URL}/abrn/files`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for the uploaded file
    const uploadedFile = page.locator(`text="${testFileName}"`).first();
    await uploadedFile.waitFor({ state: 'visible', timeout: 5000 });
    console.log(`   Found uploaded file: ${testFileName}`);

    // Click to download
    await uploadedFile.click();
    await page.waitForTimeout(1000);

    // Enter password to decrypt
    const decryptPasswordInput = page.locator('input[type="password"], input[placeholder*="password" i]').first();
    await decryptPasswordInput.fill(testPassword);
    console.log(`   Entered decryption password: ${testPassword}`);

    // Click decrypt/download button
    const decryptButton = page.locator('button:has-text("Decrypt"), button:has-text("Download"), button[type="submit"]').last();
    await decryptButton.click();

    // Wait for download to start or success message
    await page.waitForTimeout(3000);

    // Check for error messages
    const errorElements = await page.locator('.error, [class*="error"], :has-text("fail"), :has-text("invalid")').count();

    if (errorElements > 0) {
      const errorText = await page.locator('.error, [class*="error"]').first().textContent();
      console.log(`❌ DECRYPTION FAILED: ${errorText}`);
      await page.screenshot({ path: '/tmp/decryption-error.png' });
      console.log('   Error screenshot saved: /tmp/decryption-error.png');
    } else {
      console.log('✅ File decrypted successfully!');
      await page.screenshot({ path: '/tmp/decryption-success.png' });
      console.log('   Screenshot saved: /tmp/decryption-success.png');
    }

    console.log('\n🎉 END-TO-END TEST COMPLETE!');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    await page.screenshot({ path: '/tmp/test-error.png' });
    console.log('   Error screenshot saved: /tmp/test-error.png');
    throw error;
  } finally {
    await page.waitForTimeout(3000);  // Keep browser open to see results
    await browser.close();
  }
})();
