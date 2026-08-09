const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  saveBackup: (folderPath, data) => ipcRenderer.invoke('save-backup', { folderPath, data })
});
