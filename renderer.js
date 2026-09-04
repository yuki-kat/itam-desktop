/* global api */

const state = {
  view: 'dashboard',
  lists: { categories: [], options: {} }
};

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                   */
/* ------------------------------------------------------------------ */

function fmtNumber(n) {
  if (n === null || n === undefined || n === '') return '';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtPercent(n) {
  if (n === null || n === undefined) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function badgeClass(value) {
  const green = ['Active', 'In Use', 'Resolved', 'Checked Out', 'Returned'];
  const amber = ['Expiring Soon', 'Renew Soon', 'In Progress', 'On Loan', 'Waiting on Parts'];
  const red = ['Expired', 'Overdue', 'Lost/Stolen'];
  if (green.includes(value)) return 'green';
  if (amber.includes(value)) return 'amber';
  if (red.includes(value)) return 'red';
  return 'grey';
}

function cellValue(col, row) {
  const v = row[col.key];
  if (col.badge) {
    if (v === null || v === undefined || v === '') return '';
    return `<span class="badge ${badgeClass(v)}">${escapeHtml(v)}</span>`;
  }
  if (col.format === 'currency') return v === null || v === undefined ? '' : fmtNumber(v);
  return v === null || v === undefined ? '' : escapeHtml(String(v));
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ------------------------------------------------------------------ */
/* View configuration for the four CRUD "sheets"                       */
/* ------------------------------------------------------------------ */

function getViews() {
  return {
    assets: {
      title: 'Asset Register',
      api: 'assets',
      columns: [
        { key: 'asset_tag', label: 'Asset Tag' },
        { key: 'category', label: 'Category' },
        { key: 'manufacturer', label: 'Manufacturer' },
        { key: 'model', label: 'Model' },
        { key: 'serial_number', label: 'Serial #' },
        { key: 'assigned_to', label: 'Assigned To' },
        { key: 'department', label: 'Department' },
        { key: 'location', label: 'Location' },
        { key: 'status', label: 'Status', badge: true },
        { key: 'condition', label: 'Condition' },
        { key: 'purchase_date', label: 'Purchase Date' },
        { key: 'purchase_cost', label: 'Purchase Cost', format: 'currency' },
        { key: 'vendor', label: 'Vendor' },
        { key: 'warranty_expiry', label: 'Warranty Expiry' },
        { key: 'warranty_status', label: 'Warranty Status', badge: true },
        { key: 'age_years', label: 'Age (yrs)' },
        { key: 'current_value', label: 'Current Value', format: 'currency' },
        { key: 'annual_depreciation', label: 'Annual Depr.', format: 'currency' },
        { key: 'notes', label: 'Notes' }
      ],
      formFields: [
        { key: 'asset_tag', label: 'Asset Tag', type: 'text', required: true },
        { key: 'category', label: 'Category', type: 'select', optionsSource: 'categories' },
        { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
        { key: 'model', label: 'Model', type: 'text' },
        { key: 'serial_number', label: 'Serial Number', type: 'text' },
        { key: 'assigned_to', label: 'Assigned To', type: 'text' },
        { key: 'department', label: 'Department', type: 'text' },
        { key: 'location', label: 'Location', type: 'select', optionsKey: 'location' },
        { key: 'status', label: 'Status', type: 'select', optionsKey: 'status' },
        { key: 'condition', label: 'Condition', type: 'select', optionsKey: 'condition' },
        { key: 'purchase_date', label: 'Purchase Date', type: 'date' },
        { key: 'purchase_cost', label: 'Purchase Cost', type: 'number' },
        { key: 'vendor', label: 'Vendor', type: 'text' },
        { key: 'warranty_expiry', label: 'Warranty Expiry', type: 'date' },
        { key: 'notes', label: 'Notes', type: 'textarea' }
      ]
    },
    assignments: {
      title: 'Assignments',
      api: 'assignments',
      columns: [
        { key: 'asset_tag', label: 'Asset Tag' },
        { key: 'assigned_to', label: 'Assigned To' },
        { key: 'department', label: 'Department' },
        { key: 'checkout_date', label: 'Checkout Date' },
        { key: 'expected_return_date', label: 'Expected Return' },
        { key: 'return_date', label: 'Return Date' },
        { key: 'status', label: 'Status', badge: true },
        { key: 'issued_by', label: 'Issued By' },
        { key: 'notes', label: 'Notes' }
      ],
      formFields: [
        { key: 'asset_tag', label: 'Asset Tag', type: 'text', required: true },
        { key: 'assigned_to', label: 'Assigned To', type: 'text' },
        { key: 'department', label: 'Department', type: 'text' },
        { key: 'checkout_date', label: 'Checkout Date', type: 'date' },
        { key: 'expected_return_date', label: 'Expected Return Date', type: 'date' },
        { key: 'return_date', label: 'Return Date', type: 'date' },
        { key: 'issued_by', label: 'Issued By', type: 'text' },
        { key: 'notes', label: 'Notes', type: 'textarea' }
      ]
    },
    maintenance: {
      title: 'Maintenance Log',
      api: 'maintenance',
      columns: [
        { key: 'ticket_id', label: 'Ticket ID' },
        { key: 'asset_tag', label: 'Asset Tag' },
        { key: 'issue_reported', label: 'Issue Reported' },
        { key: 'date_reported', label: 'Date Reported' },
        { key: 'reported_by', label: 'Reported By' },
        { key: 'ticket_status', label: 'Ticket Status', badge: true },
        { key: 'resolution', label: 'Resolution' },
        { key: 'date_resolved', label: 'Date Resolved' },
        { key: 'days_open', label: 'Days Open' },
        { key: 'cost', label: 'Cost', format: 'currency' },
        { key: 'vendor_technician', label: 'Vendor/Technician' }
      ],
      formFields: [
        { key: 'ticket_id', label: 'Ticket ID', type: 'text', required: true },
        { key: 'asset_tag', label: 'Asset Tag', type: 'text', required: true },
        { key: 'issue_reported', label: 'Issue Reported', type: 'textarea' },
        { key: 'date_reported', label: 'Date Reported', type: 'date' },
        { key: 'reported_by', label: 'Reported By', type: 'text' },
        { key: 'ticket_status', label: 'Ticket Status', type: 'select', optionsKey: 'ticket_status' },
        { key: 'resolution', label: 'Resolution', type: 'textarea' },
        { key: 'date_resolved', label: 'Date Resolved', type: 'date' },
        { key: 'cost', label: 'Cost', type: 'number' },
        { key: 'vendor_technician', label: 'Vendor/Technician', type: 'text' }
      ]
    },
    licenses: {
      title: 'Software Licenses',
      api: 'licenses',
      columns: [
        { key: 'software', label: 'Software' },
        { key: 'license_type', label: 'License Type' },
        { key: 'license_key', label: 'License Key/Account' },
        { key: 'seats_purchased', label: 'Seats Purchased' },
        { key: 'seats_used', label: 'Seats Used' },
        { key: 'seats_available', label: 'Seats Available' },
        { key: 'purchase_date', label: 'Purchase Date' },
        { key: 'renewal_date', label: 'Renewal Date' },
        { key: 'renewal_status', label: 'Renewal Status', badge: true },
        { key: 'annual_cost', label: 'Annual Cost', format: 'currency' },
        { key: 'vendor', label: 'Vendor' },
        { key: 'notes', label: 'Notes' }
      ],
      formFields: [
        { key: 'software', label: 'Software', type: 'text', required: true },
        { key: 'license_type', label: 'License Type', type: 'select', optionsKey: 'license_type' },
        { key: 'license_key', label: 'License Key/Account', type: 'text' },
        { key: 'seats_purchased', label: 'Seats Purchased', type: 'number' },
        { key: 'seats_used', label: 'Seats Used', type: 'number' },
        { key: 'purchase_date', label: 'Purchase Date', type: 'date' },
        { key: 'renewal_date', label: 'Renewal Date', type: 'date' },
        { key: 'annual_cost', label: 'Annual Cost', type: 'number' },
        { key: 'vendor', label: 'Vendor', type: 'text' },
        { key: 'notes', label: 'Notes', type: 'textarea' }
      ]
    }
  };
}

/* ------------------------------------------------------------------ */
/* Navigation                                                           */
/* ------------------------------------------------------------------ */

const viewTitleEl = document.getElementById('viewTitle');
const viewContainer = document.getElementById('viewContainer');
const topbarActions = document.getElementById('topbarActions');

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.view = btn.dataset.view;
    renderView();
  });
});

async function refreshLists() {
  state.lists = await api.invoke('lists:getAll');
}

async function renderView() {
  topbarActions.innerHTML = '';
  const views = getViews();

  if (state.view === 'dashboard') {
    viewTitleEl.textContent = 'Dashboard';
    return renderDashboard();
  }
  if (state.view === 'pnl') {
    viewTitleEl.textContent = 'P&L (EBITDA)';
    return renderPnl();
  }
  if (state.view === 'lists') {
    viewTitleEl.textContent = 'Lists / Settings';
    return renderLists();
  }

  const view = views[state.view];
  viewTitleEl.textContent = view.title;

  const addBtn = document.createElement('button');
  addBtn.className = 'primary';
  addBtn.textContent = '+ Add';
  addBtn.addEventListener('click', () => openRecordModal(view));
  const exportBtn = document.createElement('button');
  exportBtn.className = 'secondary';
  exportBtn.style.marginRight = '8px';
  exportBtn.textContent = 'Export CSV';
  exportBtn.addEventListener('click', () => api.invoke('app:exportCsv', view.api));
  topbarActions.appendChild(exportBtn);
  topbarActions.appendChild(addBtn);

  await renderTable(view);
}

/* ------------------------------------------------------------------ */
/* Generic table rendering + row actions                                */
/* ------------------------------------------------------------------ */

async function renderTable(view) {
  const rows = await api.invoke(`${view.api}:list`);
  if (!rows.length) {
    viewContainer.innerHTML = '<div class="empty-state">No records yet. Click "+ Add" to create one.</div>';
    return;
  }

  const thead = `<tr>${view.columns.map((c) => `<th>${c.label}</th>`).join('')}<th></th></tr>`;
  const tbody = rows
    .map((row) => {
      const cells = view.columns.map((c) => `<td>${cellValue(c, row)}</td>`).join('');
      return `<tr data-id="${row.id}">${cells}<td>
        <button class="small edit-btn">Edit</button>
        <button class="small danger del-btn">Delete</button>
      </td></tr>`;
    })
    .join('');

  viewContainer.innerHTML = `<div class="table-wrap"><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`;

  viewContainer.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = Number(tr.dataset.id);
    const row = rows.find((r) => r.id === id);
    tr.querySelector('.edit-btn').addEventListener('click', () => openRecordModal(view, row));
    tr.querySelector('.del-btn').addEventListener('click', async () => {
      if (confirm('Delete this record? This cannot be undone.')) {
        await api.invoke(`${view.api}:delete`, id);
        renderTable(view);
        if (view.api === 'assets' || view.api === 'assignments' || view.api === 'maintenance' || view.api === 'licenses') {
          // dashboard numbers may have changed; nothing to do here since dashboard re-fetches on view switch
        }
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/* Modal (Add / Edit)                                                   */
/* ------------------------------------------------------------------ */

const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalForm = document.getElementById('modalForm');
document.getElementById('modalClose').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

function closeModal() {
  modalOverlay.classList.add('hidden');
  modalForm.innerHTML = '';
}

function optionsFor(field) {
  if (field.optionsSource === 'categories') return state.lists.categories.map((c) => c.name);
  if (field.optionsKey) return state.lists.options[field.optionsKey] || [];
  return [];
}

function openRecordModal(view, record) {
  const isEdit = !!record;
  modalTitle.textContent = isEdit ? `Edit ${view.title.replace(/s$/, '')}` : `Add ${view.title.replace(/s$/, '')}`;
  modalForm.innerHTML = '';

  view.formFields.forEach((field) => {
    const row = document.createElement('div');
    row.className = 'form-row';
    const label = document.createElement('label');
    label.textContent = field.label + (field.required ? ' *' : '');
    row.appendChild(label);

    let input;
    if (field.type === 'select') {
      input = document.createElement('select');
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '—';
      input.appendChild(blank);
      const opts = optionsFor(field);
      const currentVal = isEdit ? record[field.key] : null;
      if (currentVal && !opts.includes(currentVal)) opts.push(currentVal); // keep legacy values selectable
      opts.forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        input.appendChild(o);
      });
    } else if (field.type === 'textarea') {
      input = document.createElement('textarea');
    } else {
      input = document.createElement('input');
      input.type = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
      if (field.type === 'number') input.step = 'any';
    }
    input.name = field.key;
    if (isEdit && record[field.key] !== null && record[field.key] !== undefined) {
      input.value = record[field.key];
    }
    row.appendChild(input);
    modalForm.appendChild(row);
  });

  const actions = document.createElement('div');
  actions.className = 'form-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', closeModal);
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'primary';
  saveBtn.textContent = isEdit ? 'Save changes' : 'Add record';
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  modalForm.appendChild(actions);

  modalForm.onsubmit = async (e) => {
    e.preventDefault();
    const data = {};
    view.formFields.forEach((field) => {
      const el = modalForm.elements[field.key];
      let v = el.value;
      if (field.type === 'number') v = v === '' ? null : Number(v);
      data[field.key] = v === '' ? null : v;
    });
    if (isEdit) {
      await api.invoke(`${view.api}:update`, { id: record.id, data });
    } else {
      await api.invoke(`${view.api}:add`, data);
    }
    closeModal();
    renderTable(view);
  };

  modalOverlay.classList.remove('hidden');
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                            */
/* ------------------------------------------------------------------ */

async function renderDashboard() {
  const d = await api.invoke('dashboard:get');

  const cards = [
    { label: 'Total Assets', value: d.totalAssets },
    { label: 'In Use', value: d.inUse },
    { label: 'In Stock', value: d.inStock },
    { label: 'In Repair', value: d.inRepair, cls: d.inRepair > 0 ? 'amber' : '' },
    { label: 'Retired / Disposed', value: d.retiredOrDisposed },
    { label: 'Total Asset Value (Current)', value: fmtNumber(d.totalAssetValue) }
  ];

  const cardHtml = cards
    .map((c) => `<div class="card"><div class="label">${c.label}</div><div class="value ${c.cls || ''}">${c.value}</div></div>`)
    .join('');

  const byCategoryRows = d.byCategory
    .map((c) => `<tr><td>${escapeHtml(c.category)}</td><td>${c.count}</td></tr>`)
    .join('');

  const warrantyRows = d.warrantyStatus
    .map((w) => `<tr><td><span class="badge ${badgeClass(w.status)}">${w.status}</span></td><td>${w.count}</td></tr>`)
    .join('');

  const alerts = [
    { label: 'Open Maintenance Tickets', value: d.openTickets },
    { label: 'Overdue Asset Returns', value: d.overdueReturns },
    { label: 'Licenses Expiring Soon', value: d.licensesRenewSoon },
    { label: 'Over-Allocated Licenses', value: d.overAllocatedLicenses }
  ];
  const alertCards = alerts
    .map((a) => `<div class="card"><div class="label">${a.label}</div><div class="value ${a.value > 0 ? 'amber' : ''}">${a.value}</div></div>`)
    .join('');

  viewContainer.innerHTML = `
    <div class="cards">${cardHtml}</div>
    <div class="panels">
      <div class="panel">
        <h3>Assets by Category</h3>
        <table><tbody>${byCategoryRows}</tbody></table>
      </div>
      <div class="panel">
        <h3>Warranty Status</h3>
        <table><tbody>${warrantyRows}</tbody></table>
      </div>
    </div>
    <div class="panel" style="margin-top:16px;">
      <h3>Operational Alerts</h3>
      <div class="cards">${alertCards}</div>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/* P&L                                                                   */
/* ------------------------------------------------------------------ */

async function renderPnl() {
  const p = await api.invoke('pnl:get');

  viewContainer.innerHTML = `
    <div class="panel pnl-grid">
      <h3>Inputs</h3>
      <form id="pnlForm">
        <div class="pnl-row"><span>Revenue</span><input type="number" step="any" name="revenue" value="${p.revenue}"></div>
        <div class="pnl-row"><span>Cost of Goods Sold (COGS)</span><input type="number" step="any" name="cogs" value="${p.cogs}"></div>
        <div class="pnl-row"><span>Operating Expenses (excl. D&amp;A)</span><input type="number" step="any" name="opex" value="${p.opex}"></div>
        <div class="pnl-row"><span>Interest Expense</span><input type="number" step="any" name="interest_expense" value="${p.interest_expense}"></div>
        <div class="pnl-row"><span>Income Tax Expense</span><input type="number" step="any" name="income_tax" value="${p.income_tax}"></div>
        <div class="form-actions"><button type="submit" class="primary">Save</button></div>
      </form>
    </div>
    <div class="panel pnl-grid" style="margin-top:16px;">
      <h3>Calculated</h3>
      <div class="pnl-row"><span>Gross Profit</span><strong>${fmtNumber(p.gross_profit)}</strong></div>
      <div class="pnl-row"><span>EBITDA</span><strong>${fmtNumber(p.ebitda)}</strong></div>
      <div class="pnl-row"><span>EBITDA Margin</span><strong>${fmtPercent(p.ebitda_margin)}</strong></div>
      <div class="pnl-row"><span>Depreciation &amp; Amortization (from Asset Register)</span><strong>${fmtNumber(p.da)}</strong></div>
      <div class="pnl-row"><span>EBIT (Operating Income)</span><strong>${fmtNumber(p.ebit)}</strong></div>
      <div class="pnl-row total"><span>Net Income</span><strong>${fmtNumber(p.net_income)}</strong></div>
    </div>
    <p class="hint">D&amp;A is summed automatically from the Asset Register (Purchase Cost ÷ Useful Life per asset). Edit useful-life assumptions under Lists / Settings.</p>
  `;

  document.getElementById('pnlForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {};
    for (const [k, v] of fd.entries()) data[k] = Number(v) || 0;
    await api.invoke('pnl:update', data);
    renderPnl();
  });
}

/* ------------------------------------------------------------------ */
/* Lists / Settings                                                     */
/* ------------------------------------------------------------------ */

async function renderLists() {
  await refreshLists();
  const { categories, options } = state.lists;

  const catRows = categories
    .map(
      (c, i) => `<div class="form-row" style="flex-direction:row; align-items:center; gap:8px;">
        <input type="text" data-cat-name value="${escapeHtml(c.name)}" style="flex:1;">
        <input type="number" step="any" data-cat-life value="${c.useful_life_years}" style="width:90px;" title="Useful life (years)">
        <button type="button" class="small danger" data-remove-cat="${i}">Remove</button>
      </div>`
    )
    .join('');

  const optionBlocks = Object.entries(options)
    .map(
      ([name, values]) => `
      <div class="panel">
        <h3>${name.replace(/_/g, ' ')}</h3>
        <textarea data-option-list="${name}">${values.join('\n')}</textarea>
        <div class="hint">One value per line — used to populate the matching dropdown.</div>
      </div>`
    )
    .join('');

  viewContainer.innerHTML = `
    <div class="panel" style="margin-bottom:16px;">
      <h3>Categories &amp; Useful Life (years)</h3>
      <div id="catList">${catRows}</div>
      <div class="form-actions" style="border-top:none; padding-top:12px;">
        <button type="button" class="secondary" id="addCatBtn">+ Add category</button>
        <button type="button" class="primary" id="saveCatBtn">Save categories</button>
      </div>
      <p class="hint">Useful life drives depreciation on the Asset Register (Current Value / Annual Depreciation) and the D&amp;A figure on the P&amp;L page.</p>
    </div>
    <div class="lists-grid">${optionBlocks}</div>
    <div class="form-actions" style="border-top:none; padding-top:16px;">
      <button type="button" class="primary" id="saveOptionsBtn">Save dropdown lists</button>
    </div>
  `;

  document.getElementById('addCatBtn').addEventListener('click', () => {
    const div = document.createElement('div');
    div.className = 'form-row';
    div.style.cssText = 'flex-direction:row; align-items:center; gap:8px;';
    div.innerHTML = `<input type="text" data-cat-name value="" placeholder="New category" style="flex:1;">
      <input type="number" step="any" data-cat-life value="4" style="width:90px;">
      <button type="button" class="small danger">Remove</button>`;
    div.querySelector('button').addEventListener('click', () => div.remove());
    document.getElementById('catList').appendChild(div);
  });

  document.querySelectorAll('[data-remove-cat]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('.form-row').remove());
  });

  document.getElementById('saveCatBtn').addEventListener('click', async () => {
    const rows = document.querySelectorAll('#catList .form-row');
    const cats = Array.from(rows)
      .map((r) => ({
        name: r.querySelector('[data-cat-name]').value.trim(),
        useful_life_years: Number(r.querySelector('[data-cat-life]').value) || 4
      }))
      .filter((c) => c.name);
    await api.invoke('lists:saveCategories', cats);
    renderLists();
  });

  document.getElementById('saveOptionsBtn').addEventListener('click', async () => {
    const textareas = document.querySelectorAll('[data-option-list]');
    for (const ta of textareas) {
      const listName = ta.dataset.optionList;
      const values = ta.value.split('\n').map((v) => v.trim()).filter(Boolean);
      await api.invoke('lists:saveOptions', { listName, values });
    }
    renderLists();
  });
}

/* ------------------------------------------------------------------ */
/* Boot                                                                  */
/* ------------------------------------------------------------------ */

(async function init() {
  await refreshLists();
  renderView();
})();
