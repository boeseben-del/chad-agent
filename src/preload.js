const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chadAPI', {
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),
  getConnectionStatus: () => ipcRenderer.invoke('get-connection-status'),
  sendChatMessage: (message) => ipcRenderer.invoke('send-chat-message', message),
  createTicket: (ticket) => ipcRenderer.invoke('create-ticket', ticket),
  setServerUrl: (url) => ipcRenderer.invoke('set-server-url', url),
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  
  onConnectionStatus: (callback) => {
    ipcRenderer.on('connection-status', (event, data) => callback(data));
  },
  onChatMessage: (callback) => {
    ipcRenderer.on('chat-message', (event, data) => callback(data));
  },
  onOpenChat: (callback) => {
    ipcRenderer.on('open-chat', () => callback());
  },
  onOpenSettings: (callback) => {
    ipcRenderer.on('open-settings', () => callback());
  },
  onDeploymentStarted: (callback) => {
    ipcRenderer.on('deployment-started', (event, data) => callback(data));
  }
});
