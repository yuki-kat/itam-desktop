# IT Asset Manager (desktop)

Electron + SQLite (`better-sqlite3`) port of the "IT Asset Management" workbook.
Functional parity with all 7 original tabs:

| Excel tab            | App view            | Notes |
|-----------------------|----------------------|-------|
| Asset Register        | Asset Register       | Warranty Status, Age, Current Value, Annual Depreciation are computed live, same formulas as the workbook |
| Assignments            | Assignments          | Status (Checked Out / Overdue / Returned) computed live |
| Maintenance Log        | Maintenance Log      | Days Open computed live |
| Software Licenses      | Software Licenses    | Seats Available, Renewal Status computed live |
| Dashboard               | Dashboard            | Same aggregate metrics/alerts as the workbook |
| P&L (EBITDA)            | P&L (EBITDA)         | D&A auto-pulled from Asset Register, same as workbook |
| Lists                   | Lists / Settings     | Edit categories + useful-life years, and every dropdown's allowed values |

Data lives in a local SQLite file in the OS user-data folder (not inside the app
bundle), so it survives app updates/reinstalls:
- Windows: `%APPDATA%\itam-desktop\itam.db`
- macOS: `~/Library/Application Support/itam-desktop/itam.db`

On first launch the app seeds itself from `db/seedData.json`, which contains the
data that was in the original workbook (including its placeholder/example rows —
delete those from the Asset Register / Assignments / Maintenance Log / Software
Licenses views once you're ready to use it for real).

## Run in development

```bash
npm install
npm start
```

`better-sqlite3` is a native module. `npm install` compiles it for the Node/Electron
ABI on your current machine automatically via its install script.

## Build installers

```bash
# one-time, only needed if native deps get out of sync with Electron's ABI
npx electron-builder install-app-deps

# build for the platform you're running on:
npm run dist:mac      # -> release/*.dmg, release/*.zip
npm run dist:win      # -> release/*.exe (NSIS installer)

# both at once (requires the appropriate toolchains / cross-build setup):
npm run dist
```

Notes:
- **Cross-building**: electron-builder can cross-build Windows targets from macOS/Linux,
  but it cannot build a `.dmg` from Windows/Linux (Apple's tooling is mac-only). Build
  the mac target on a Mac (or in CI, e.g. GitHub Actions `macos-latest` runner).
- **Code signing**: unsigned builds work fine locally. If you plan to distribute outside
  your org, macOS binaries need notarization/signing (or users must right-click → Open
  the first time) and Windows binaries will trigger SmartScreen warnings unless signed
  with a code-signing certificate.
- **App icon**: drop `build/icon.icns` (mac) and `build/icon.ico` (win) in `build/` and
  reference them in `package.json`'s `build.mac.icon` / `build.win.icon` — currently
  the default Electron icon is used.

## Project layout

```
main.js           Electron main process: window, SQLite, all IPC handlers
preload.js        contextBridge — whitelists exactly which IPC channels the UI can call
db/schema.js       SQLite DDL
db/seedData.json   Initial data extracted from the original workbook
src/index.html     App shell (sidebar + content + modal)
src/styles.css     Styling
src/renderer.js    All UI logic: view configs, table rendering, forms, dashboard, lists, P&L
```

## Extending

- **Add a column**: extend the relevant table in `db/schema.js`, add it to `columns`
  in `main.js`'s `TABLE_DEFS`, and add it to the view's `columns`/`formFields` arrays
  in `src/renderer.js`.
- **Change currency formatting**: `fmtNumber()` in `src/renderer.js` uses
  `toLocaleString()` with no currency symbol (the source data was in JPY without a
  symbol). Add `style: 'currency', currency: 'JPY'` (or your currency) there if wanted.
- **CSV export** is included per-view (top-right "Export CSV" button) as a bonus —
  it wasn't in the original workbook.
