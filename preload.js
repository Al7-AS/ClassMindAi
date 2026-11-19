const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('classMindDesktop', {
  readData: () => ipcRenderer.invoke('data:read'),
  writeData: data => ipcRenderer.invoke('data:write', data),
  exportBackup: json => ipcRenderer.invoke('backup:export', json),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  exportExcel: payload => ipcRenderer.invoke('excel:export', payload),
  getActivation: () => ipcRenderer.invoke('activation:get'),
  setActivation: record => ipcRenderer.invoke('activation:set', record)
});