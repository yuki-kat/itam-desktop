// SQLite schema. Kept as a JS string (not a .sql file) so it works transparently
// whether the app is running unpacked or inside an asar archive.
module.exports = `
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_tag TEXT,
  category TEXT,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  assigned_to TEXT,
  department TEXT,
  location TEXT,
  status TEXT,
  condition TEXT,
  purchase_date TEXT,       -- ISO 'YYYY-MM-DD' or NULL
  purchase_cost REAL,
  vendor TEXT,
  warranty_expiry TEXT,     -- ISO 'YYYY-MM-DD' or NULL
  notes TEXT
);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_tag TEXT,
  assigned_to TEXT,
  department TEXT,
  checkout_date TEXT,
  expected_return_date TEXT,
  return_date TEXT,
  issued_by TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS maintenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT,
  asset_tag TEXT,
  issue_reported TEXT,
  date_reported TEXT,
  reported_by TEXT,
  ticket_status TEXT,
  resolution TEXT,
  date_resolved TEXT,
  cost REAL,
  vendor_technician TEXT
);

CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  software TEXT,
  license_type TEXT,
  license_key TEXT,
  seats_purchased INTEGER,
  seats_used INTEGER,
  purchase_date TEXT,
  renewal_date TEXT,
  annual_cost REAL,
  vendor TEXT,
  notes TEXT
);

-- Category -> useful life (years), used for depreciation calc. Mirrors "Lists" sheet cols A & G.
CREATE TABLE IF NOT EXISTS categories (
  name TEXT PRIMARY KEY,
  useful_life_years REAL NOT NULL DEFAULT 4
);

-- Generic dropdown option lists, mirrors "Lists" sheet cols B-F
-- list_name in ('status','location','condition','ticket_status','license_type')
CREATE TABLE IF NOT EXISTS list_options (
  list_name TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pnl (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revenue REAL NOT NULL DEFAULT 0,
  cogs REAL NOT NULL DEFAULT 0,
  opex REAL NOT NULL DEFAULT 0,
  interest_expense REAL NOT NULL DEFAULT 0,
  income_tax REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;
