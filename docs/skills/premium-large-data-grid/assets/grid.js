/* Dependency-free teaching controller, file:// compatible.
 * SimulatedBackend replaces a real server only for this demo. A production host
 * must adapt page/aggregate/detail owners, authorization, dataset revisions,
 * exact decimal handling, persistence, exports and finality independently.
 */
(() => {
  'use strict';
  const PAGE_SIZE = 50;
  const DATASET_SIZE = 20000;
  const DATASET_REVISION = 'synthetic-v1';
  const categories = ['services', 'supplies', 'travel', 'equipment'];
  const categoryNames = { services: 'Services', supplies: 'Supplies', travel: 'Travel', equipment: 'Equipment' };
  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MXN', currencyDisplay: 'narrowSymbol', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatMoney = cents => currency.format(cents / 100);
  const formatCount = value => new Intl.NumberFormat('en-US').format(value);
  const $ = id => document.getElementById(id);
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // Every amount and aggregate is an exact, safe integer number of cents.
  // This specific synthetic workload remains below Number.MAX_SAFE_INTEGER.
  // Real multi-currency/decimal ledgers need their own host arithmetic policy.
  const records = Array.from({ length: DATASET_SIZE }, (_, index) => {
    const n = index + 1;
    const names = ['Estudio Marquez', 'North Field Laboratory', 'Mercado de la Luz', 'Atlas Works', 'Taller del Horizonte', 'Marina & Partners'];
    const purposes = ['Professional services and technical support', 'Materials for recurring operations', 'Travel and field work', 'Equipment, maintenance and installation'];
    const category = categories[index % categories.length];
    return Object.freeze({
      id: `DOC-${String(n).padStart(6, '0')}`,
      date: `2026-${String((index % 9) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
      party: n % 97 === 0 ? 'Synthetic <img src=x onerror=alert(1)> text' : `${names[index % names.length]} ${String.fromCharCode(65 + index % 26)}`,
      purpose: `${purposes[index % purposes.length]} · record ${n}${n % 13 === 0 ? ' · A deliberately long description whose complete value remains in the document detail.' : ''}`,
      category,
      ready: n % 4 !== 0,
      cents: n % 497 === 0 ? 123456789012 : 12500 + ((n * 7919) % 97543210)
    });
  });
  const recordById = new Map(records.map(record => [record.id, record]));
  const filterRecords = scope => records.filter(record => {
    if (scope.category !== 'all' && record.category !== scope.category) return false;
    return !scope.search || `${record.id} ${record.party} ${record.purpose}`.toLocaleLowerCase('en-US').includes(scope.search);
  });
  const totalCents = rows => {
    const result = rows.reduce((sum, row) => sum + row.cents, 0);
    if (!Number.isSafeInteger(result)) throw new Error('Synthetic aggregate exceeds its integer policy.');
    return result;
  };
  const SimulatedBackend = {
    page(scope, page) {
      const filtered = filterRecords(scope);
      return { rows: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), count: filtered.length };
    },
    async totals(scope, delay, fail) {
      await new Promise(resolve => setTimeout(resolve, delay));
      if (fail) throw new Error('Simulated supporting owner is temporarily unavailable.');
      const filtered = filterRecords(scope);
      return { cents: totalCents(filtered), count: filtered.length, revision: DATASET_REVISION };
    },
    async summary(scope, delay) {
      await new Promise(resolve => setTimeout(resolve, delay));
      const filtered = filterRecords(scope);
      return { ready: filtered.filter(row => row.ready).length, missing: filtered.filter(row => !row.ready).length, count: filtered.length, revision: DATASET_REVISION };
    }
  };
  let scope = { search: '', category: 'all', revision: DATASET_REVISION };
  let page = 1;
  let generation = 0;
  let totalsRequest = 0;
  let summaryRequest = 0;
  let visible = [];
  let resultCount = DATASET_SIZE;
  let selected = new Set();
  let currentTotal = null;
  let failNext = false;
  let summaryOpen = false;
  let ignored = 0;
  let menu = null;
  let menuTrigger = null;
  let detailTrigger = null;
  let totalsLifecycle = 'pending';
  const scopeKey = candidate => JSON.stringify(candidate);
  const snapshotScope = () => ({ ...scope });
  const recordIgnored = () => { ignored += 1; $('stale-note').textContent = `${ignored} old-view response${ignored === 1 ? '' : 's'} ignored.`; };
  const currentResponse = (capturedGeneration, capturedScope, request, owner) => capturedGeneration === generation && scopeKey(capturedScope) === scopeKey(scope) && request === (owner === 'totals' ? totalsRequest : summaryRequest);
  const setState = (node, value) => { node.className = `tag ${value}`; node.textContent = value[0].toUpperCase() + value.slice(1); };

  function selectionPaint() {
    const chosen = Array.from(selected, id => recordById.get(id)).filter(Boolean);
    $('selected-total').textContent = formatMoney(totalCents(chosen));
    $('selected-count').textContent = `${formatCount(chosen.length)} selected in this view · includes other pages`;
    $('clear-selection').disabled = !chosen.length;
    for (const tr of $('rows').children) {
      const checked = selected.has(tr.dataset.rowid);
      tr.classList.toggle('selected', checked);
      tr.querySelector('input').checked = checked;
    }
    const pageSelected = visible.filter(row => selected.has(row.id)).length;
    $('select-page').checked = !!visible.length && pageSelected === visible.length;
    $('select-page').indeterminate = pageSelected > 0 && pageSelected < visible.length;
    $('select-page').disabled = !visible.length;
  }

  function closeMenu(restoreFocus = false) {
    if (!menu) return;
    menu.remove(); menu = null;
    if (menuTrigger) { menuTrigger.setAttribute('aria-expanded', 'false'); if (restoreFocus && menuTrigger.isConnected) menuTrigger.focus(); }
    menuTrigger = null;
  }
  function openDetail(id, trigger) {
    closeMenu();
    const record = recordById.get(id);
    if (!record) return;
    detailTrigger = trigger;
    $('detail-title').textContent = record.id;
    const fields = [ ['Date', record.date], ['Counterparty', record.party], ['Purpose', record.purpose], ['Category', categoryNames[record.category]], ['State', record.ready ? 'Evidence ready · synthetic' : 'Proof needed · synthetic'], ['Amount · MXN', formatMoney(record.cents)], ['Dataset revision', DATASET_REVISION] ];
    const fragment = document.createDocumentFragment();
    for (const [label, value] of fields) { fragment.append(element('dt', '', label), element('dd', label.startsWith('Amount') ? 'money' : '', value)); }
    $('detail-fields').replaceChildren(fragment);
    $('detail-dialog').showModal();
  }
  function openMenu(id, trigger) {
    if (menuTrigger === trigger) { closeMenu(true); return; }
    closeMenu(); menuTrigger = trigger; trigger.setAttribute('aria-expanded', 'true');
    menu = element('div', 'menu'); menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', `Secondary actions for ${id}`);
    const detail = element('button', '', 'Inspect complete record'); detail.type = 'button'; detail.setAttribute('role', 'menuitem'); detail.addEventListener('click', () => openDetail(id, trigger));
    const select = element('button', '', selected.has(id) ? 'Remove from selection' : 'Add to selection'); select.type = 'button'; select.setAttribute('role', 'menuitem'); select.addEventListener('click', () => { selected.has(id) ? selected.delete(id) : selected.add(id); closeMenu(true); selectionPaint(); });
    menu.append(detail, select); $('grid-demo').append(menu);
    const rect = trigger.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(rect.right - 182, window.innerWidth - 190))}px`;
    menu.style.top = `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - 8))}px`;
    menu.addEventListener('keydown', event => {
      const buttons = Array.from(menu.querySelectorAll('button'));
      const index = buttons.indexOf(document.activeElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length; buttons[next].focus();
      }
    });
    detail.focus();
  }

  function renderRow(record) {
    const row = element('tr'); row.dataset.rowid = record.id;
    const checkCell = element('td', 'selection-cell'); checkCell.dataset.label = 'Select';
    const selectTarget = element('label', 'selection-target');
    const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.dataset.selectId = record.id; checkbox.setAttribute('aria-label', `Select ${record.id}`); selectTarget.append(checkbox); checkCell.append(selectTarget);
    const documentCell = element('td', 'document-cell'); documentCell.dataset.label = 'Document'; documentCell.append(element('span', 'doc-id', record.id), element('span', 'doc-date', record.date));
    const partyCell = element('td', 'party-cell'); partyCell.dataset.label = 'Counterparty & purpose';
    const party = element('span', 'party', record.party); party.title = record.party;
    const purpose = element('span', 'purpose', record.purpose); purpose.title = record.purpose; partyCell.append(party, purpose);
    const categoryCell = element('td', 'category-name', categoryNames[record.category]); categoryCell.dataset.label = 'Category';
    const stateCell = element('td'); stateCell.dataset.label = 'State'; stateCell.append(element('span', `tag ${record.ready ? 'ready' : 'pending'}`, record.ready ? 'Evidence ready' : 'Proof needed'));
    const amountCell = element('td', 'numeric', formatMoney(record.cents)); amountCell.dataset.label = 'Amount · MXN'; amountCell.dataset.cents = String(record.cents);
    const actionCell = element('td', 'actions-cell'); actionCell.dataset.label = 'Next action';
    const actions = element('div', 'row-actions');
    const action = element('button', `button row-action${record.ready ? ' ready-action' : ''}`, record.ready ? 'Inspect' : 'Resolve'); action.type = 'button'; action.dataset.detailId = record.id; action.setAttribute('aria-label', `${record.ready ? 'Inspect' : 'Resolve'} ${record.id}`);
    const kebab = element('button', 'button ghost kebab', '⋮'); kebab.type = 'button'; kebab.dataset.menuId = record.id; kebab.setAttribute('aria-label', `More actions for ${record.id}`); kebab.setAttribute('aria-haspopup', 'menu'); kebab.setAttribute('aria-expanded', 'false');
    actions.append(action, kebab); actionCell.append(actions);
    row.append(checkCell, documentCell, partyCell, categoryCell, stateCell, amountCell, actionCell);
    return row;
  }

  async function loadTotals() {
    const capturedGeneration = generation; const capturedScope = snapshotScope(); const request = ++totalsRequest;
    const shouldFail = failNext; failNext = false; $('fail-note').textContent = 'No failure armed.';
    currentTotal = null; totalsLifecycle = 'loading'; setState($('totals-state'), 'loading'); $('full-total').dataset.pending = 'true'; $('full-total').textContent = 'Loading · whole filtered dataset'; $('totals-detail').textContent = 'Rows and actions remain usable.'; $('totals-retry').hidden = true;
    try {
      const response = await SimulatedBackend.totals(capturedScope, Number($('delay').value), shouldFail);
      if (!currentResponse(capturedGeneration, capturedScope, request, 'totals')) { recordIgnored(); return; }
      if (response.count !== resultCount || response.revision !== scope.revision) throw new Error('Supporting result no longer matches this view.');
      currentTotal = response.cents; $('full-total').dataset.pending = 'false'; $('full-total').textContent = formatMoney(response.cents); $('totals-detail').textContent = `${formatCount(response.count)} filtered records · not limited to this page`;
      // Announce ready after the actual number has had a paint opportunity.
      requestAnimationFrame(() => requestAnimationFrame(() => { if (currentResponse(capturedGeneration, capturedScope, request, 'totals')) { totalsLifecycle = 'ready'; setState($('totals-state'), 'ready'); } }));
    } catch (error) {
      if (!currentResponse(capturedGeneration, capturedScope, request, 'totals')) { recordIgnored(); return; }
      currentTotal = null; totalsLifecycle = 'error'; setState($('totals-state'), 'error'); $('full-total').textContent = 'Unavailable · amount unknown'; $('totals-detail').textContent = error.message; $('totals-retry').hidden = false;
    }
  }
  async function loadSummary() {
    const capturedGeneration = generation; const capturedScope = snapshotScope(); const request = ++summaryRequest;
    setState($('summary-state'), 'loading'); $('summary-content').textContent = 'Loading supporting evidence for this exact view.'; $('summary-retry').hidden = true;
    try {
      const response = await SimulatedBackend.summary(capturedScope, Number($('delay').value));
      if (!currentResponse(capturedGeneration, capturedScope, request, 'summary')) { recordIgnored(); return; }
      if (response.revision !== scope.revision || response.count !== resultCount) throw new Error('Summary does not match this view.');
      $('summary-content').textContent = `${formatCount(response.ready)} records have synthetic evidence ready; ${formatCount(response.missing)} still need proof. These are workflow states, not approvals or finalized financial results.`; setState($('summary-state'), 'ready');
    } catch (error) {
      if (!currentResponse(capturedGeneration, capturedScope, request, 'summary')) { recordIgnored(); return; }
      $('summary-content').textContent = error.message; setState($('summary-state'), 'error'); $('summary-retry').hidden = false;
    }
  }
  function render() {
    generation += 1; totalsRequest += 1; summaryRequest += 1; currentTotal = null; totalsLifecycle = 'pending'; closeMenu();
    const response = SimulatedBackend.page(scope, page); visible = response.rows; resultCount = response.count;
    const fragment = document.createDocumentFragment(); for (const record of visible) fragment.append(renderRow(record)); $('rows').replaceChildren(fragment);
    $('empty').hidden = !!visible.length;
    $('result-count').textContent = `${formatCount(visible.length)} shown of ${formatCount(resultCount)} matching records`;
    $('scope-label').textContent = `View ${generation} · ${scope.category === 'all' ? 'all categories' : categoryNames[scope.category]}`;
    const pages = Math.max(1, Math.ceil(resultCount / PAGE_SIZE)); $('page-label').textContent = `Page ${page} of ${formatCount(pages)}`; $('previous').disabled = page === 1; $('next').disabled = page >= pages;
    setState($('totals-state'), 'pending'); $('full-total').dataset.pending = 'true'; $('full-total').textContent = 'Pending · not a page total'; $('totals-detail').textContent = 'Computed after useful rows are painted.'; $('totals-retry').hidden = true;
    setState($('summary-state'), 'pending'); $('summary-content').textContent = 'Supporting evidence has not been loaded for this view.';
    selectionPaint();
    const capturedGeneration = generation;
    requestAnimationFrame(() => requestAnimationFrame(() => { if (capturedGeneration === generation) { loadTotals(); if (summaryOpen) loadSummary(); } }));
  }
  $('filters').addEventListener('submit', event => { event.preventDefault(); scope = { search: $('search').value.trim().toLocaleLowerCase('en-US'), category: $('category').value, revision: DATASET_REVISION }; page = 1; selected.clear(); render(); });
  $('filter-reset').addEventListener('click', () => { $('search').value = ''; $('category').value = 'all'; scope = { search: '', category: 'all', revision: DATASET_REVISION }; page = 1; selected.clear(); render(); });
  $('rows').addEventListener('change', event => { const id = event.target.dataset.selectId; if (id) { event.target.checked ? selected.add(id) : selected.delete(id); selectionPaint(); } });
  $('rows').addEventListener('click', event => { const action = event.target.closest('button'); if (!action) return; if (action.dataset.detailId) openDetail(action.dataset.detailId, action); if (action.dataset.menuId) openMenu(action.dataset.menuId, action); });
  $('select-page').addEventListener('change', event => { for (const row of visible) event.target.checked ? selected.add(row.id) : selected.delete(row.id); selectionPaint(); });
  $('clear-selection').addEventListener('click', () => { selected.clear(); selectionPaint(); });
  $('previous').addEventListener('click', () => { if (page > 1) { page -= 1; render(); } });
  $('next').addEventListener('click', () => { if (page * PAGE_SIZE < resultCount) { page += 1; render(); } });
  $('totals-retry').addEventListener('click', loadTotals); $('refresh-totals').addEventListener('click', loadTotals);
  $('fail-next').addEventListener('click', () => { failNext = true; $('fail-note').textContent = 'Next full-total request will fail once.'; });
  $('summary-open').addEventListener('click', () => { summaryOpen = !summaryOpen; $('summary-panel').hidden = !summaryOpen; $('summary-open').setAttribute('aria-expanded', String(summaryOpen)); $('summary-open').textContent = summaryOpen ? 'Close supporting summary' : 'Open supporting summary'; if (summaryOpen) loadSummary(); });
  $('summary-retry').addEventListener('click', loadSummary);
  $('detail-close').addEventListener('click', () => $('detail-dialog').close());
  $('detail-dialog').addEventListener('close', () => { if (detailTrigger?.isConnected) detailTrigger.focus(); detailTrigger = null; });
  document.addEventListener('click', event => { if (menu && !menu.contains(event.target) && event.target !== menuTrigger) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu) { event.preventDefault(); closeMenu(true); } });
  document.querySelector('.table-frame').addEventListener('scroll', () => closeMenu(), { passive: true });
  window.addEventListener('resize', () => closeMenu()); window.addEventListener('scroll', () => closeMenu(), { passive: true });
  // Read-only observability for focused demo checks; not an authorization API.
  Object.defineProperty(window, 'gridDemoDiagnostics', { value: Object.freeze({ snapshot: () => Object.freeze({ datasetSize: DATASET_SIZE, pageSize: PAGE_SIZE, generation, page, resultCount, mountedRows: $('rows').children.length, selectedCount: selected.size, selectedCents: totalCents(Array.from(selected, id => recordById.get(id))), currentTotalCents: currentTotal, totalsState: totalsLifecycle, ignoredResponses: ignored, scope: Object.freeze(snapshotScope()) }) }), writable: false });
  render();
})();
