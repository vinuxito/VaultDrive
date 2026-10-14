#!/usr/bin/env node
/* Focused offline demonstration check. This never opens the host application.
 * Usage: node <skill>/scripts/test_demo.cjs /tmp/grid-demo-proof-<unique>
 * Requires Node.js and Playwright installed in a resolvable module directory.
 * If needed: NODE_PATH=/path/to/node_modules node ...
 * PLAYWRIGHT_MODULE_DIR may name a node_modules directory containing playwright.
 * CHROME_PATH (or GRID_DEMO_BROWSER) may select an existing Chrome executable. Default:
 * /usr/bin/google-chrome; otherwise Playwright's installed Chromium is used.
 * The output directory must not exist. Browser sandbox permissions are a host
 * decision; this helper does not grant authorization or bypass task test policy.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const crypto = require('node:crypto');
let chromium;
try { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE_DIR ? path.resolve(process.env.PLAYWRIGHT_MODULE_DIR, 'playwright') : 'playwright')); }
catch { process.stderr.write('Playwright is unavailable. Install it for this helper or provide PLAYWRIGHT_MODULE_DIR=/path/to/node_modules.\n'); process.exit(2); }
const output = process.argv[2];
if (!output || fs.existsSync(output)) { process.stderr.write('Provide a fresh output directory.\n'); process.exit(2); }
fs.mkdirSync(output, { recursive: true });
const html = path.resolve(__dirname, '../assets/demo.html');
const sourceHashes = Object.fromEntries(['assets/demo.html', 'assets/grid.css', 'assets/grid.js', 'scripts/test_demo.cjs'].map(relative => [relative, crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '..', relative))).digest('hex')]));
const checks = [];
const errors = [];
const remoteRequests = [];
const record = (name, value, detail) => { checks.push({ name, ok: Boolean(value), detail }); if (!value) throw new Error(name); };
const ready = async page => page.waitForFunction(() => window.gridDemoDiagnostics?.snapshot().totalsState === 'ready');
const snapshot = page => page.evaluate(() => window.gridDemoDiagnostics.snapshot());
let browser;
(async () => {
  const configured = process.env.CHROME_PATH || process.env.GRID_DEMO_BROWSER;
  const executablePath = configured || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const observe = page => {
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/i.test(request.url())) remoteRequests.push(request.url()); });
  };
  observe(desktop);
  await desktop.goto(pathToFileURL(html).href);
  await ready(desktop);
  let state = await snapshot(desktop);
  record('Bounded first DOM over 20,000 synthetic records', state.datasetSize === 20000 && state.mountedRows === 50 && state.resultCount === 20000, state);
  record('One contextual action and one kebab per row', await desktop.locator('#rows tr').evaluateAll(rows => rows.every(row => row.querySelectorAll('.row-action').length === 1 && row.querySelectorAll('.kebab').length === 1)));
  record('Stable unique row identities', await desktop.locator('#rows tr').evaluateAll(rows => new Set(rows.map(row => row.dataset.rowid)).size === 50));
  record('Desktop has no viewport or monetary overflow', await desktop.evaluate(() => document.documentElement.scrollWidth <= innerWidth && Array.from(document.querySelectorAll('td.numeric')).every(node => node.scrollWidth <= node.clientWidth)));
  const desktopGeometry = await desktop.evaluate(() => {
    const frame = document.querySelector('.table-frame');
    const footer = document.querySelector('.workspace-footer');
    const firstHead = document.querySelector('thead th');
    frame.scrollTop = frame.scrollHeight;
    const stickyAtEnd = Math.abs(firstHead.getBoundingClientRect().top - frame.getBoundingClientRect().top) <= 2;
    const result = { frameHeight: frame.clientHeight, contentHeight: frame.scrollHeight, footerBottom: footer.getBoundingClientRect().bottom, viewportHeight: innerHeight, stickyAtEnd };
    frame.scrollTop = 0;
    return result;
  });
  record('Desktop rows have bounded vertical scrolling, sticky header and a visible external footer', desktopGeometry.contentHeight > desktopGeometry.frameHeight && desktopGeometry.frameHeight <= 320 && desktopGeometry.footerBottom <= desktopGeometry.viewportHeight && desktopGeometry.stickyAtEnd, desktopGeometry);
  const firstTotal = state.currentTotalCents;
  await desktop.screenshot({ path: path.join(output, 'desktop.png') });
  await desktop.locator('#select-page').check();
  state = await snapshot(desktop);
  const pageCents = await desktop.locator('td.numeric').evaluateAll(cells => cells.reduce((sum, cell) => sum + Number(cell.dataset.cents), 0));
  record('Selection has its own exact cents and whole total remains unchanged', state.selectedCount === 50 && state.selectedCents === pageCents && state.currentTotalCents === firstTotal, state);
  await desktop.locator('#next').click(); await ready(desktop);
  await desktop.locator('#rows input').first().check();
  state = await snapshot(desktop);
  record('Selection persists across bounded pages', state.page === 2 && state.mountedRows === 50 && state.selectedCount === 51 && state.currentTotalCents === firstTotal, state);
  await desktop.locator('.kebab').first().click();
  record('Secondary menu opens and focuses an action', await desktop.locator('[role=menu]').count() === 1 && await desktop.evaluate(() => document.activeElement?.getAttribute('role') === 'menuitem'));
  await desktop.keyboard.press('Escape');
  record('Escape closes menu and restores trigger focus', await desktop.locator('[role=menu]').count() === 0 && await desktop.evaluate(() => document.activeElement?.classList.contains('kebab')));
  await desktop.locator('.kebab').first().click(); await desktop.locator('h1').click();
  record('Outside click closes secondary menu', await desktop.locator('[role=menu]').count() === 0);
  await desktop.locator('.kebab').first().click();
  await desktop.locator('.table-frame').evaluate(node => { node.scrollTop += 48; });
  await desktop.waitForFunction(() => document.querySelector('[role=menu]') === null);
  record('Scrolling the row viewport closes an anchored secondary menu', await desktop.locator('[role=menu]').count() === 0);
  await desktop.locator('.row-action').first().click();
  record('Complete detail uses stable ID', await desktop.locator('#detail-dialog').evaluate(node => node.open) && (await desktop.locator('#detail-title').textContent()) === 'DOC-000051');
  await desktop.keyboard.press('Escape');
  record('Dialog closes through native Escape', await desktop.locator('#detail-dialog').evaluate(node => !node.open));
  await desktop.locator('#delay').selectOption('2400');
  await desktop.locator('#refresh-totals').click();
  await desktop.locator('#category').selectOption('services'); await desktop.locator('#filters button[type=submit]').click();
  state = await desktop.evaluate(() => ({ ...window.gridDemoDiagnostics.snapshot(), totalLabel: document.getElementById('full-total').textContent }));
  record('Filter change clears selection and old monetary evidence', state.selectedCount === 0 && state.currentTotalCents === null && ['pending', 'loading'].includes(state.totalsState) && state.scope.category === 'services' && state.resultCount === 5000 && !state.totalLabel.includes('$'), state);
  await ready(desktop); state = await snapshot(desktop);
  record('Late old-view response is rejected', state.resultCount === 5000 && state.scope.category === 'services' && state.ignoredResponses >= 1, state);
  await desktop.locator('#delay').selectOption('650');
  await desktop.locator('#fail-next').click(); await desktop.locator('#refresh-totals').click();
  await desktop.waitForFunction(() => window.gridDemoDiagnostics.snapshot().totalsState === 'error');
  state = await snapshot(desktop);
  record('Auxiliary failure is unknown rather than zero, rows stay usable', state.currentTotalCents === null && state.mountedRows === 50 && (await desktop.locator('#full-total').textContent()).includes('unknown') && await desktop.locator('#totals-retry').isVisible(), state);
  await desktop.locator('#totals-retry').click(); await ready(desktop);
  record('Local retry restores supporting total', (await snapshot(desktop)).currentTotalCents > 0);
  await desktop.locator('#summary-open').click(); await desktop.waitForFunction(() => document.getElementById('summary-state').textContent === 'Ready');
  record('On-intent summary is scoped and not a final approval', (await desktop.locator('#summary-content').textContent()).includes('not approvals'));
  await desktop.locator('#filter-reset').click(); await ready(desktop);
  await desktop.locator('#search').fill('Synthetic <img'); await desktop.locator('#filters button[type=submit]').click(); await ready(desktop);
  record('Synthetic hostile-looking values render as inert text', (await desktop.locator('#rows .party').first().textContent()).includes('<img') && await desktop.locator('#rows img').count() === 0);
  await desktop.locator('#search').fill('DOC-000497'); await desktop.locator('#filters button[type=submit]').click(); await ready(desktop);
  record('Large monetary digits remain complete on desktop', (await desktop.locator('td.numeric').textContent()) === '$1,234,567,890.12' && await desktop.locator('td.numeric').evaluate(node => node.scrollWidth <= node.clientWidth));
  await desktop.locator('#search').fill('no-matching-synthetic-record-xyz'); await desktop.locator('#filters button[type=submit]').click(); await ready(desktop);
  state = await snapshot(desktop);
  record('Actual empty result is distinct from failed read', state.mountedRows === 0 && state.resultCount === 0 && state.currentTotalCents === 0 && await desktop.locator('#empty').isVisible(), state);
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); observe(mobile);
  await mobile.goto(pathToFileURL(html).href); await ready(mobile);
  const mobileLayout = await mobile.evaluate(() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, moneyVisible: Array.from(document.querySelectorAll('td.numeric')).every(node => node.scrollWidth <= node.clientWidth), labels: Array.from(document.querySelectorAll('#rows td')).every(node => !!node.dataset.label), touches: Array.from(document.querySelectorAll('.row-action, .kebab, .selection-target')).every(node => { const bounds = node.getBoundingClientRect(); return bounds.width >= 44 && bounds.height >= 44; }), layout: getComputedStyle(document.querySelector('#rows tr')).display }));
  record('Mobile has labelled cards, complete amounts and 44px row targets', mobileLayout.documentWidth <= mobileLayout.viewport && mobileLayout.moneyVisible && mobileLayout.labels && mobileLayout.touches && mobileLayout.layout === 'grid', mobileLayout);
  await mobile.screenshot({ path: path.join(output, 'mobile.png') });
  await mobile.locator('#search').fill('DOC-000497'); await mobile.locator('#filters button[type=submit]').click(); await ready(mobile);
  record('Large monetary digits remain complete on mobile', (await mobile.locator('td.numeric').textContent()) === '$1,234,567,890.12' && await mobile.locator('td.numeric').evaluate(node => node.scrollWidth <= node.clientWidth));
  await mobile.locator('.row-action').first().click();
  record('Mobile natural detail entry works', await mobile.locator('#detail-dialog').evaluate(node => node.open));
  await mobile.locator('#detail-close').click();
  record('No browser errors or network dependencies', errors.length === 0 && remoteRequests.length === 0, { errors, remoteRequests });
})().then(async () => {
  if (browser) await browser.close();
  const report = { ok: true, checks, errors, remoteRequests, sourceHashes, scope: 'Offline synthetic teaching asset only. No application, real server, fiscal, auth, native mobile or throughput verification.', generatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ ok: true, checks: checks.length, output }) + '\n');
}).catch(async error => {
  if (browser) await browser.close();
  errors.push(error.message);
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify({ ok: false, checks, errors, remoteRequests, sourceHashes }, null, 2));
  process.stderr.write(error.stack + '\n'); process.exitCode = 1;
});
