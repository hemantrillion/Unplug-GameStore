const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('unplugDesktop', {
  isElectron: true,
  pushToAndroid: (gameData) => ipcRenderer.invoke('unplug:push-to-android', gameData),
  buildApk: () => ipcRenderer.invoke('unplug:build-apk'),
  openApkFolder: () => ipcRenderer.invoke('unplug:open-apk-folder'),
  connectRemote: (url) => ipcRenderer.invoke('unplug:connect-remote', url)
});