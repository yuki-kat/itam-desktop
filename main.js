const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const SCHEMA_SQL = require('./db/schema.js');
const SEED = require('./db/seedData.json');

let db;
let win;

/* ------------------------------------------------------------------ */
/* DB bootstrap                                                        */
/* ------------------------------------------------------------------ */

function getDbPath() {
  return path.join(app.getPath('userData'), 'itam.db');
}

function initDb() {
  const dbPath = getDbPath();
  const isNew = !fs.existsSync(dbPath);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);

  // Ensure the single P&L row always exists.
  db.prepare(`INSERT OR IGNORE INTO pnl (id) VALUES (1)`).run();

  if (isNew) {
    seedDb();
  }
}

function seedDb() {
  const insertAsset = db.prepare(`
    INSERT INTO assets (asset_tag, category, manufacturer, model, serial_number, assigned_to,
      department, location, status, condition, purchase_date, purchase_cost, vendor,
      warranty_expiry, notes)
    VALUES (@asset_tag, @category, @manufacturer, @model, @serial_number, @assigned_to,
      @department, @location, @status, @condition, @purchase_date, @purchase_cost, @vendor,
      @warranty_expiry, @notes)
  `);
  const insertAssignment = db.prepare(`
    INSERT INTO assignments (asset_tag, assigned_to, department, checkout_date,
      expected_return_date, return_date, issued_by, notes)
    VALUES (@asset_tag, @assigned_to, @department, @checkout_date,
      @expected_return_date, @return_date, @issued_by, @notes)
  `);
  const insertMaintenance = db.prepare(`
    INSERT INTO maintenance (ticket_id, asset_tag, issue_reported, date_reported, reported_by,
      ticket_status, resolution, date_resolved, cost, vendor_technician)
    VALUES (@ticket_id, @asset_tag, @issue_reported, @date_reported, @reported_by,
      @ticket_status, @resolution, @date_resolved, @cost, @vendor_technician)
  `);
  const insertLicense = db.prepare(`
    INSERT INTO licenses (software, license_type, license_key, seats_purchased, seats_used,
      purchase_date, renewal_date, annual_cost, vendor, notes)
    VALUES (@software, @license_type, @license_key, @seats_purchased, @seats_used,
      @purchase_date, @renewal_date, @annual_cost, @vendor, @notes)
  `);
  const insertCategory = db.prepare(
    `INSERT INTO categories (name, useful_life_years) VALUES (?, ?)`
  );
  const insertOption = db.prepare(
    `INSERT INTO list_options (list_name, value, sort_order) VALUES (?, ?, ?)`
  );

  const tx = db.transaction(() => {
    for (const row of SEED.assets) insertAsset.run(row);
    for (const row of SEED.assignments) insertAssignment.run(row);
    for (const row of SEED.maintenance) insertMaintenance.run(row);
    for (const row of SEED.licenses) insertLicense.run(row);
    for (const cat of SEED.categories) insertCategory.run(cat.name, cat.useful_life_years);
    for (const [listName, values] of Object.entries(SEED.option_lists)) {
      values.forEach((v, i) => insertOption.run(listName, v, i));
    }
  });
  tx();
}

/* ------------------------------------------------------------------ */
/* Date / computed-field helpers (mirror the original Excel formulas)  */
/* ------------------------------------------------------------------ */

function parseDate(s) {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getUsefulLifeMap() {
  const rows = db.prepare(`SELECT name, useful_life_years FROM categories`).all();
  const map = {};
  for (const r of rows) map[r.name] = r.useful_life_years;
  return map;
}

// Warranty Status: mirrors =IF(ISNUMBER(N),IF(N<TODAY(),"Expired",IF(N<TODAY()+90,"Expiring Soon","Active")),"")
// Age (Years):     mirrors =ROUND((TODAY()-K)/365.25,1)
// Current Value:   mirrors =MAX(cost*(1-age/usefulLife),0)
// Annual Depreciation: mirrors =cost/usefulLife
function computeAsset(row, usefulLifeMap) {
  const t = today();
  const purchaseDate = parseDate(row.purchase_date);
  const warrantyExpiry = parseDate(row.warranty_expiry);

  let warranty_status = '';
  if (warrantyExpiry) {
    const days = daysBetween(t, warrantyExpiry);
    warranty_status = days < 0 ? 'Expired' : days < 90 ? 'Expiring Soon' : 'Active';
  }

  let age_years = null;
  if (purchaseDate) {
    age_years = Math.round((daysBetween(purchaseDate, t) / 365.25) * 10) / 10;
  }

  let current_value = null;
  let annual_depreciation = null;
  if (purchaseDate && row.purchase_cost != null) {
    const usefulLife = usefulLifeMap[row.category] || 4;
    annual_depreciation = row.purchase_cost / usefulLife;
    current_value = Math.max(row.purchase_cost * (1 - age_years / usefulLife), 0);
  }

  return { ...row, warranty_status, age_years, current_value, annual_depreciation };
}

// Status: mirrors =IF(D="","",IF(F<>"","Returned",IF(AND(ISNUMBER(E),E<TODAY()),"Overdue","Checked Out")))
function computeAssignment(row) {
  const t = today();
  let status = '';
  if (row.checkout_date) {
    if (row.return_date) {
      status = 'Returned';
    } else {
      const expected = parseDate(row.expected_return_date);
      status = expected && expected < t ? 'Overdue' : 'Checked Out';
    }
  }
  return { ...row, status };
}

// Days Open: mirrors =IF(ISNUMBER(D),IF(ISNUMBER(H),H-D,TODAY()-D),"")
function computeMaintenance(row) {
  let days_open = null;
  const reported = parseDate(row.date_reported);
  if (reported) {
    const end = parseDate(row.date_resolved) || today();
    days_open = daysBetween(reported, end);
  }
  return { ...row, days_open };
}

// Seats Available: mirrors =purchased-used
// Renewal Status:  mirrors =IF(ISNUMBER(H),IF(H<TODAY(),"Expired",IF(H<TODAY()+60,"Renew Soon","Active")),"")
function computeLicense(row) {
  const t = today();
  let seats_available = null;
  if (row.seats_purchased != null && row.seats_used != null) {
    seats_available = row.seats_purchased - row.seats_used;
  }
  let renewal_status = '';
  const renewal = parseDate(row.renewal_date);
  if (renewal) {
    const days = daysBetween(t, renewal);
    renewal_status = days < 0 ? 'Expired' : days < 60 ? 'Renew Soon' : 'Active';
  }
  return { ...row, seats_available, renewal_status };
}

/* ------------------------------------------------------------------ */
/* Generic CRUD over the four "sheet" tables                           */
/* ------------------------------------------------------------------ */

const TABLE_DEFS = {
  assets: {
    table: 'assets',
    columns: ['asset_tag', 'category', 'manufacturer', 'model', 'serial_number', 'assigned_to',
      'department', 'location', 'status', 'condition', 'purchase_date', 'purchase_cost',
      'vendor', 'warranty_expiry', 'notes'],
    compute: computeAsset
  },
  assignments: {
    table: 'assignments',
    columns: ['asset_tag', 'assigned_to', 'department', 'checkout_date', 'expected_return_date',
      'return_date', 'issued_by', 'notes'],
    compute: computeAssignment
  },
  maintenance: {
    table: 'maintenance',
    columns: ['ticket_id', 'asset_tag', 'issue_reported', 'date_reported', 'reported_by',
      'ticket_status', 'resolution', 'date_resolved', 'cost', 'vendor_technician'],
    compute: computeMaintenance
  },
  licenses: {
    table: 'licenses',
    columns: ['software', 'license_type', 'license_key', 'seats_purchased', 'seats_used',
      'purchase_date', 'renewal_date', 'annual_cost', 'vendor', 'notes'],
    compute: computeLicense
  }
};

function normalize(v) {
  return v === undefined || v === '' ? null : v;
}

function listRows(defName) {
  const def = TABLE_DEFS[defName];
  const rows = db.prepare(`SELECT * FROM ${def.table} ORDER BY id DESC`).all();
  if (!def.compute) return rows;
  const usefulLifeMap = defName === 'assets' ? getUsefulLifeMap() : null;
  return rows.map((r) => (defName === 'assets' ? def.compute(r, usefulLifeMap) : def.compute(r)));
}

function addRow(defName, data) {
  const def = TABLE_DEFS[defName];
  const cols = def.columns.filter((c) => c in data);
  if (!cols.length) throw new Error('No valid columns supplied');
  const stmt = db.prepare(
    `INSERT INTO ${def.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
  );
  const info = stmt.run(...cols.map((c) => normalize(data[c])));
  return info.lastInsertRowid;
}

function updateRow(defName, id, data) {
  const def = TABLE_DEFS[defName];
  const cols = def.columns.filter((c) => c in data);
  if (!cols.length) return;
  const stmt = db.prepare(
    `UPDATE ${def.table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`
  );
  stmt.run(...cols.map((c) => normalize(data[c])), id);
}

function deleteRow(defName, id) {
  const def = TABLE_DEFS[defName];
  db.prepare(`DELETE FROM ${def.table} WHERE id = ?`).run(id);
}

function registerCrudHandlers(defName) {
  ipcMain.handle(`${defName}:list`, () => listRows(defName));
  ipcMain.handle(`${defName}:add`, (_evt, data) => addRow(defName, data || {}));
  ipcMain.handle(`${defName}:update`, (_evt, { id, data }) => updateRow(defName, id, data || {}));
  ipcMain.handle(`${defName}:delete`, (_evt, id) => deleteRow(defName, id));
}

/* ------------------------------------------------------------------ */
/* Lists (categories / dropdown options) IPC                           */
/* ------------------------------------------------------------------ */

function registerListsHandlers() {
  ipcMain.handle('lists:getAll', () => {
    const categories = db
      .prepare(`SELECT name, useful_life_years FROM categories ORDER BY name`)
      .all();
    const optionNames = ['status', 'location', 'condition', 'ticket_status', 'license_type'];
    const options = {};
    for (const name of optionNames) {
      options[name] = db
        .prepare(`SELECT value FROM list_options WHERE list_name = ? ORDER BY sort_order`)
        .all(name)
        .map((r) => r.value);
    }
    return { categories, options };
  });

  ipcMain.handle('lists:saveCategories', (_evt, categories) => {
    const del = db.prepare(`DELETE FROM categories`);
    const ins = db.prepare(`INSERT INTO categories (name, useful_life_years) VALUES (?, ?)`);
    const tx = db.transaction((cats) => {
      del.run();
      for (const c of cats) {
        if (c.name && c.name.trim()) {
          ins.run(c.name.trim(), Number(c.useful_life_years) || 4);
        }
      }
    });
    tx(categories || []);
    return true;
  });

  ipcMain.handle('lists:saveOptions', (_evt, { listName, values }) => {
    const del = db.prepare(`DELETE FROM list_options WHERE list_name = ?`);
    const ins = db.prepare(
      `INSERT INTO list_options (list_name, value, sort_order) VALUES (?, ?, ?)`
    );
    const tx = db.transaction((vals) => {
      del.run(listName);
      vals.forEach((v, i) => {
        if (v && v.trim()) ins.run(listName, v.trim(), i);
      });
    });
    tx(values || []);
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* P&L IPC                                                              */
/* ------------------------------------------------------------------ */

function registerPnlHandlers() {
  ipcMain.handle('pnl:get', () => {
    const row = db.prepare(`SELECT * FROM pnl WHERE id = 1`).get();
    const usefulLifeMap = getUsefulLifeMap();
    const assets = db.prepare(`SELECT category, purchase_cost, purchase_date FROM assets`).all();
    const da = assets.reduce((sum, a) => {
      if (a.purchase_date && a.purchase_cost != null) {
        const usefulLife = usefulLifeMap[a.category] || 4;
        return sum + a.purchase_cost / usefulLife;
      }
      return sum;
    }, 0);

    const gross_profit = row.revenue - row.cogs;
    const ebitda = gross_profit - row.opex;
    const ebitda_margin = row.revenue === 0 ? null : ebitda / row.revenue;
    const ebit = ebitda - da;
    const net_income = ebit - row.interest_expense - row.income_tax;

    return { ...row, da, gross_profit, ebitda, ebitda_margin, ebit, net_income };
  });

  ipcMain.handle('pnl:update', (_evt, data) => {
    const fields = ['revenue', 'cogs', 'opex', 'interest_expense', 'income_tax'];
    const cols = fields.filter((f) => f in data);
    if (!cols.length) return;
    const stmt = db.prepare(
      `UPDATE pnl SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = 1`
    );
    stmt.run(...cols.map((c) => Number(data[c]) || 0));
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Dashboard IPC (mirrors the Dashboard sheet's aggregate formulas)    */
/* ------------------------------------------------------------------ */

function registerDashboardHandler() {
  ipcMain.handle('dashboard:get', () => {
    const usefulLifeMap = getUsefulLifeMap();
    const assets = db.prepare(`SELECT * FROM assets`).all().map((a) => computeAsset(a, usefulLifeMap));
    const assignments = db.prepare(`SELECT * FROM assignments`).all().map(computeAssignment);
    const maintenance = db.prepare(`SELECT * FROM maintenance`).all();
    const licenses = db.prepare(`SELECT * FROM licenses`).all().map(computeLicense);
    const categories = db.prepare(`SELECT name FROM categories ORDER BY name`).all().map((c) => c.name);

    const countBy = (arr, field, value) => arr.filter((r) => r[field] === value).length;

    const totalAssetValue = assets.reduce((s, a) => s + (a.current_value || 0), 0);

    const byCategory = categories.map((cat) => ({
      category: cat,
      count: countBy(assets, 'category', cat)
    }));

    const warrantyStatus = ['Active', 'Expiring Soon', 'Expired'].map((s) => ({
      status: s,
      count: countBy(assets, 'warranty_status', s)
    }));

    const openMaintenanceStatuses = ['Open', 'In Progress', 'Waiting on Parts'];
    const openTickets = maintenance.filter((m) => openMaintenanceStatuses.includes(m.ticket_status)).length;
    const overdueReturns = assignments.filter((a) => a.status === 'Overdue').length;
    const licensesRenewSoon = licenses.filter((l) => l.renewal_status === 'Renew Soon').length;
    const overAllocatedLicenses = licenses.filter((l) => l.seats_available != null && l.seats_available < 0).length;

    return {
      totalAssets: assets.length,
      inUse: countBy(assets, 'status', 'In Use'),
      inStock: countBy(assets, 'status', 'In Stock'),
      inRepair: countBy(assets, 'status', 'In Repair'),
      retiredOrDisposed: countBy(assets, 'status', 'Retired') + countBy(assets, 'status', 'Disposed'),
      totalAssetValue,
      byCategory,
      warrantyStatus,
      openTickets,
      overdueReturns,
      licensesRenewSoon,
      overAllocatedLicenses
    };
  });
}

/* ------------------------------------------------------------------ */
/* CSV export (handy extra; not in original workbook but trivial & safe)*/
/* ------------------------------------------------------------------ */

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(','));
  return lines.join('\n');
}

function registerExportHandler() {
  ipcMain.handle('app:exportCsv', async (_evt, defName) => {
    const rows = listRows(defName);
    const csv = toCsv(rows);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Export CSV',
      defaultPath: `${defName}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    });
    if (canceled || !filePath) return false;
    fs.writeFileSync(filePath, csv, 'utf-8');
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Window + app lifecycle                                              */
/* ------------------------------------------------------------------ */

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  initDb();

  Object.keys(TABLE_DEFS).forEach(registerCrudHandlers);
  registerListsHandlers();
  registerPnlHandlers();
  registerDashboardHandler();
  registerExportHandler();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (db) db.close();
  if (process.platform !== 'darwin') app.quit();
});
