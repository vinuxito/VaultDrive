const { chromium } = require('playwright');
const BASE = 'https://dev-app.filemonprime.net/abrn';
const API  = 'https://dev-app.filemonprime.net/abrn/api';
const R = [];
const ok  = m => { console.log(`✅ PASS  ${m}`); R.push('P'); };
const wn  = m => { console.log(`⚠️  WARN  ${m}`); R.push('W'); };
const fail= m => { console.log(`❌ FAIL  ${m}`); R.push('F'); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();

  try {
    // 1. Get real token via browser fetch (same origin as app)
    await page.goto(`${BASE}/login`, { waitUntil:'domcontentloaded' });

    const loginResult = await page.evaluate(async (api) => {
      const r = await fetch(`${api}/login`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email:'filemon@abrn.mx', password:'986532' })
      });
      return { status: r.status, body: await r.text() };
    }, API);

    console.log(`  Login API: ${loginResult.status} → ${loginResult.body.slice(0,80)}`);

    if (loginResult.status !== 200) { fail(`Login API returned ${loginResult.status}`); }
    else {
      const data = JSON.parse(loginResult.body);
      ok(`Login API OK — user: ${data.first_name} ${data.last_name}`);

      // 2. Inject auth into localStorage
      await page.evaluate((d) => {
        localStorage.setItem('token', d.token);
        if (d.refresh_token) localStorage.setItem('refresh_token', d.refresh_token);
        localStorage.setItem('user', JSON.stringify({
          username: d.username, email: d.email,
          first_name: d.first_name, last_name: d.last_name,
          is_admin: d.is_admin, pin_set: d.pin_set,
          private_key_encrypted: d.private_key_encrypted,
          private_key_pin_encrypted: d.private_key_pin_encrypted || null,
          public_key: d.public_key,
        }));
      }, data);
      ok('Auth injected into localStorage');
    }

    // 3. Files page
    await page.goto(`${BASE}/files`, { waitUntil:'networkidle', timeout:15000 });
    await page.screenshot({ path:'/tmp/e1-files.png' });
    const h1 = await page.locator('h1').first().textContent().catch(()=>'?');
    h1.includes('Vault') ? ok(`Files page h1: "${h1}"`) : wn(`Files h1: "${h1}"`);

    // 4. "Manage" button in Drop Links
    const mBtn = page.getByRole('button', { name:'Manage' }).first();
    const mVis = await mBtn.isVisible({ timeout:3000 }).catch(()=>false);
    mVis ? ok('"Manage" button visible in Drop Links sidebar') : wn('"Manage" button not found');
    if (mVis) {
      await mBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path:'/tmp/e2-manage-drops.png' });
      const panel = await page.locator('text=/Drop Link|Upload Link|Active|Expired/i').first().isVisible({timeout:3000}).catch(()=>false);
      panel ? ok('UploadLinksSection panel rendered') : wn('UploadLinksSection panel not detected');
    }

    // 5. Quick Share / Zap icon (need files to exist)
    await page.goto(`${BASE}/files`, { waitUntil:'networkidle', timeout:12000 });
    await page.waitForTimeout(800);
    const fileRows = await page.locator('[data-file-id], button.group, [class*="file-row"]').count();
    const svgButtons = await page.locator('button:has(svg)').count();
    console.log(`  File rows: ${fileRows} | Button w/SVG: ${svgButtons}`);
    const zapSvg = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button svg')).filter(s =>
        (s.outerHTML||'').toLowerCase().includes('zap') ||
        (s.parentElement?.title||'').toLowerCase().includes('share')
      ).length
    );
    zapSvg > 0 ? ok(`Quick Share Zap icons: ${zapSvg}`) : wn(`No Zap icons (${svgButtons} btn-SVGs total; may need a file)`);
    await page.screenshot({ path:'/tmp/e3-files-actions.png' });

    // 6. Action buttons visible (not opacity:0)
    const downloadBtn = await page.locator('button:has(.lucide-download), button[aria-label*="download" i]').first();
    const downloadVis = await downloadBtn.isVisible({ timeout:2000 }).catch(()=>false);
    downloadVis ? ok('Download button visible on file row') : wn('Download button not visible (no files or hidden)');

    // 7. Dashboard
    await page.goto(`${BASE}/dashboard`, { waitUntil:'networkidle', timeout:12000 });
    await page.screenshot({ path:'/tmp/e4-dashboard.png' });
    const greet = await page.locator('text=/Good (morning|afternoon|evening)/i').first().isVisible({timeout:5000}).catch(()=>false);
    greet ? ok('Dashboard greeting visible') : wn('Dashboard greeting not found');
    const stats = await page.locator('text=/Total Files|Active Links|Shared Files|Groups/i').count();
    stats >= 2 ? ok(`Stat cards: ${stats}/4 visible`) : wn(`Stat cards: ${stats}/4`);
    const dashLink = await page.locator('a[href*="dashboard"]').first().isVisible({timeout:3000}).catch(()=>false);
    dashLink ? ok('Sidebar "Dashboard" nav link') : wn('Sidebar dashboard link missing');

    // 8. OnboardingWizard NOT shown (filemon already has PIN)
    const wizard = await page.locator('.z-\\[200\\], [class*="onboarding"]').first().isVisible({timeout:1000}).catch(()=>false);
    !wizard ? ok('OnboardingWizard correctly hidden (PIN already set)') : wn('OnboardingWizard shown unexpectedly');

    // 9. Drop page — bad token
    await page.goto(`${BASE}/drop/testbadtoken0000`, { waitUntil:'networkidle', timeout:12000 });
    await page.screenshot({ path:'/tmp/e5-drop-error.png' });
    const dropErr = await page.locator('text=/invalid|expired|error/i').first().isVisible({timeout:4000}).catch(()=>false);
    dropErr ? ok('Drop page: error state for invalid token') : wn('Drop error state not detected');

    // 10. dist/binary freshness
    const fs = require('fs');
    const dAge = (Date.now()-fs.statSync('/lamp/www/ABRN-Drive/vaultdrive_client/dist/index.html').mtimeMs)/60000;
    dAge<60 ? ok(`Frontend dist: ${Math.round(dAge)}m old`) : wn(`dist is ${Math.round(dAge)}m old`);
    const bAge = (Date.now()-fs.statSync('/lamp/www/ABRN-Drive/abrndrive').mtimeMs)/60000;
    bAge<60 ? ok(`Backend binary: ${Math.round(bAge)}m old`) : wn(`binary is ${Math.round(bAge)}m old`);

  } catch(e) {
    fail(`Exception: ${e.message}`);
    await page.screenshot({path:'/tmp/e-error.png'}).catch(()=>{});
  } finally {
    const p=R.filter(r=>r==='P').length, w=R.filter(r=>r==='W').length, f=R.filter(r=>r==='F').length;
    console.log(`\n📊  ${p} PASS  ${w} WARN  ${f} FAIL`);
    await browser.close();
  }
})();
