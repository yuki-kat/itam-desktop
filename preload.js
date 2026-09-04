const { contextBridge, ipcRenderer } = require('electron');

// Whitelist of channels the renderer is allowed to invoke.
// Keeps nodeIntegration off / contextIsolation on while still giving
// the renderer a simple request/response API.
const ALLOWED_CHANNELS = new Set([
  'assets:list', 'assets:add', 'assets:update', 'assets:delete',
  'assignments:list', 'assignments:add', 'assignments:update', 'assignments:delete',
  'maintenance:list', 'maintenance:add', 'maintenance:update', 'maintenance:delete',
  'licenses:list', 'licenses:add', 'licenses:update', 'licenses:delete',
  'lists:getAll', 'lists:saveCategories', 'lists:saveOptions',
  'pnl:get', 'pnl:update',
  'dashboard:get',
  'app:exportCsv'
]);

contextBridge.exposeInMainWorld('api', {
  invoke: (channel, payload) => {
    if (!ALLOWED_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`Blocked IPC channel: ${channel}`));
    }
    return ipcRenderer.invoke(channel, payload);
  }
});
