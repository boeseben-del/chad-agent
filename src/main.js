const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, nativeImage, Notification } = require('electron');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const Store = require('electron-store');
const WebSocket = require('ws');
const si = require('systeminformation');

const store = new Store();

let mainWindow = null;
let tray = null;
let ws = null;
let isConnected = false;
let reconnectInterval = null;
let deviceInfo = null;

const CHAD_SERVER_URL = store.get('serverUrl') || 'ws://localhost:5000';
const DEVICE_ID = store.get('deviceId') || uuidv4();
store.set('deviceId', DEVICE_ID);

async function getDeviceInfo() {
  try {
    const [system, osInfo, cpu, mem, disk, network] = await Promise.all([
      si.system(),
      si.osInfo(),
      si.cpu(),
      si.mem(),
      si.diskLayout(),
      si.networkInterfaces()
    ]);

    const primaryNetwork = network.find(n => n.ip4 && !n.internal) || network[0];

    return {
      deviceId: DEVICE_ID,
      hostname: os.hostname(),
      platform: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
      arch: osInfo.arch,
      manufacturer: system.manufacturer,
      model: system.model,
      serial: system.serial,
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores
      },
      memory: {
        total: mem.total,
        free: mem.free,
        used: mem.used
      },
      disk: disk.map(d => ({
        name: d.name,
        size: d.size,
        type: d.type
      })),
      network: {
        ip4: primaryNetwork?.ip4,
        ip6: primaryNetwork?.ip6,
        mac: primaryNetwork?.mac,
        iface: primaryNetwork?.iface
      },
      username: os.userInfo().username,
      uptime: os.uptime()
    };
  } catch (error) {
    console.error('Error getting device info:', error);
    return {
      deviceId: DEVICE_ID,
      hostname: os.hostname(),
      platform: os.platform(),
      username: os.userInfo().username
    };
  }
}

function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  try {
    ws = new WebSocket(`${CHAD_SERVER_URL}/agent`);

    ws.on('open', async () => {
      console.log('Connected to CHAD server');
      isConnected = true;
      
      deviceInfo = await getDeviceInfo();
      
      ws.send(JSON.stringify({
        type: 'register',
        data: deviceInfo
      }));

      if (mainWindow) {
        mainWindow.webContents.send('connection-status', { connected: true });
      }

      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }

      startHeartbeat();
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleServerMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      console.log('Disconnected from CHAD server');
      isConnected = false;
      if (mainWindow) {
        mainWindow.webContents.send('connection-status', { connected: false });
      }
      scheduleReconnect();
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error.message);
      isConnected = false;
    });

  } catch (error) {
    console.error('Failed to connect:', error);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectInterval) return;
  
  reconnectInterval = setInterval(() => {
    console.log('Attempting to reconnect...');
    connectWebSocket();
  }, 5000);
}

let heartbeatInterval = null;
function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  
  heartbeatInterval = setInterval(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const status = await getQuickStatus();
      ws.send(JSON.stringify({
        type: 'heartbeat',
        data: {
          deviceId: DEVICE_ID,
          ...status
        }
      }));
    }
  }, 30000);
}

async function getQuickStatus() {
  try {
    const [mem, currentLoad] = await Promise.all([
      si.mem(),
      si.currentLoad()
    ]);
    return {
      memoryUsage: Math.round((mem.used / mem.total) * 100),
      cpuLoad: Math.round(currentLoad.currentLoad),
      uptime: os.uptime()
    };
  } catch (error) {
    return { uptime: os.uptime() };
  }
}

function handleServerMessage(message) {
  console.log('Received message:', message.type);
  
  switch (message.type) {
    case 'command':
      executeCommand(message.data);
      break;
    case 'chat':
      showChatNotification(message.data);
      if (mainWindow) {
        mainWindow.webContents.send('chat-message', message.data);
      }
      break;
    case 'deploy':
      handleDeployment(message.data);
      break;
    case 'registered':
      console.log('Device registered successfully');
      showNotification('CHAD Agent', 'Connected to CHAD server');
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
}

function executeCommand(command) {
  console.log('Executing command:', command);
  const { exec } = require('child_process');
  
  exec(command.script, { timeout: 60000 }, (error, stdout, stderr) => {
    ws.send(JSON.stringify({
      type: 'command-result',
      data: {
        commandId: command.id,
        deviceId: DEVICE_ID,
        success: !error,
        stdout,
        stderr,
        error: error?.message
      }
    }));
  });
}

function handleDeployment(deployment) {
  console.log('Handling deployment:', deployment);
  showNotification('CHAD Deployment', `Installing: ${deployment.name}`);
  
  if (mainWindow) {
    mainWindow.webContents.send('deployment-started', deployment);
  }
}

function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

function showChatNotification(chat) {
  showNotification('New Message from IT Support', chat.message);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 600,
    show: false,
    frame: false,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('blur', () => {
    if (!mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.hide();
    }
  });

  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  let trayIcon;
  
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createEmpty();
    }
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Open CHAD',
      click: () => toggleWindow()
    },
    { 
      label: 'New Support Request',
      click: () => openSupportChat()
    },
    { type: 'separator' },
    { 
      label: isConnected ? '● Connected' : '○ Disconnected',
      enabled: false
    },
    { 
      label: 'Reconnect',
      click: () => connectWebSocket()
    },
    { type: 'separator' },
    { 
      label: 'Settings',
      click: () => openSettings()
    },
    { 
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('CHAD Agent');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => toggleWindow());
}

function toggleWindow() {
  if (!mainWindow) {
    createWindow();
  }
  
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    const trayBounds = tray.getBounds();
    const windowBounds = mainWindow.getBounds();
    
    const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
    const y = Math.round(trayBounds.y + trayBounds.height + 4);
    
    mainWindow.setPosition(x, y, false);
    mainWindow.show();
    mainWindow.focus();
  }
}

function openSupportChat() {
  if (!mainWindow) {
    createWindow();
  }
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('open-chat');
}

function openSettings() {
  if (!mainWindow) {
    createWindow();
  }
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('open-settings');
}

function registerHotkeys() {
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    openSupportChat();
  });
}

ipcMain.handle('get-device-info', async () => {
  if (!deviceInfo) {
    deviceInfo = await getDeviceInfo();
  }
  return deviceInfo;
});

ipcMain.handle('get-connection-status', () => {
  return { connected: isConnected };
});

ipcMain.handle('send-chat-message', (event, message) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'chat',
      data: {
        deviceId: DEVICE_ID,
        message,
        timestamp: new Date().toISOString()
      }
    }));
    return { success: true };
  }
  return { success: false, error: 'Not connected' };
});

ipcMain.handle('create-ticket', (event, ticket) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'create-ticket',
      data: {
        deviceId: DEVICE_ID,
        deviceInfo,
        ...ticket
      }
    }));
    return { success: true };
  }
  return { success: false, error: 'Not connected' };
});

ipcMain.handle('set-server-url', (event, url) => {
  store.set('serverUrl', url);
  if (ws) {
    ws.close();
  }
  connectWebSocket();
  return { success: true };
});

ipcMain.handle('get-server-url', () => {
  return store.get('serverUrl') || 'ws://localhost:5000';
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.hide();
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerHotkeys();
  connectWebSocket();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (ws) ws.close();
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (reconnectInterval) clearInterval(reconnectInterval);
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
