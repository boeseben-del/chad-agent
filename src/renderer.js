let isConnected = false;
let chatMessages = [];

const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const statusIndicator = document.getElementById('statusIndicator');
const chatMessagesContainer = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const minimizeBtn = document.getElementById('minimizeBtn');
const settingsBtn = document.getElementById('settingsBtn');
const ticketForm = document.getElementById('ticketForm');
const settingsForm = document.getElementById('settingsForm');
const deviceInfoContainer = document.getElementById('deviceInfo');
const connectionStatus = document.getElementById('connectionStatus');
const displayDeviceId = document.getElementById('displayDeviceId');
const serverUrlInput = document.getElementById('serverUrl');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;
    
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(tc => tc.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(`tab-${targetTab}`).classList.add('active');
    
    if (targetTab === 'device') {
      loadDeviceInfo();
    }
    if (targetTab === 'settings') {
      loadSettings();
    }
  });
});

minimizeBtn.addEventListener('click', () => {
  window.chadAPI.minimizeWindow();
});

settingsBtn.addEventListener('click', () => {
  tabs.forEach(t => t.classList.remove('active'));
  tabContents.forEach(tc => tc.classList.remove('active'));
  
  document.querySelector('[data-tab="settings"]').classList.add('active');
  document.getElementById('tab-settings').classList.add('active');
  loadSettings();
});

function updateConnectionStatus(connected) {
  isConnected = connected;
  
  if (connected) {
    statusIndicator.classList.add('connected');
    connectionStatus.classList.add('connected');
    connectionStatus.querySelector('.status-text').textContent = 'Connected';
  } else {
    statusIndicator.classList.remove('connected');
    connectionStatus.classList.remove('connected');
    connectionStatus.querySelector('.status-text').textContent = 'Disconnected';
  }
  
  sendBtn.disabled = !connected;
}

window.chadAPI.onConnectionStatus((data) => {
  updateConnectionStatus(data.connected);
});

async function checkConnection() {
  const status = await window.chadAPI.getConnectionStatus();
  updateConnectionStatus(status.connected);
}
checkConnection();

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message || !isConnected) return;
  
  addMessage(message, 'sent');
  chatInput.value = '';
  
  const result = await window.chadAPI.sendChatMessage(message);
  if (!result.success) {
    addMessage('Failed to send message. Please try again.', 'error');
  }
}

function addMessage(content, type = 'received') {
  const welcomeMessage = chatMessagesContainer.querySelector('.welcome-message');
  if (welcomeMessage) {
    welcomeMessage.remove();
  }
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  messageDiv.innerHTML = `
    <div class="message-content">${escapeHtml(content)}</div>
    <div class="message-time">${timeStr}</div>
  `;
  
  chatMessagesContainer.appendChild(messageDiv);
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  
  chatMessages.push({ content, type, time: now });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

window.chadAPI.onChatMessage((data) => {
  addMessage(data.message, 'received');
});

window.chadAPI.onOpenChat(() => {
  tabs.forEach(t => t.classList.remove('active'));
  tabContents.forEach(tc => tc.classList.remove('active'));
  
  document.querySelector('[data-tab="chat"]').classList.add('active');
  document.getElementById('tab-chat').classList.add('active');
  chatInput.focus();
});

window.chadAPI.onOpenSettings(() => {
  tabs.forEach(t => t.classList.remove('active'));
  tabContents.forEach(tc => tc.classList.remove('active'));
  
  document.querySelector('[data-tab="settings"]').classList.add('active');
  document.getElementById('tab-settings').classList.add('active');
  loadSettings();
});

ticketForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const subject = document.getElementById('ticketSubject').value;
  const priority = document.getElementById('ticketPriority').value;
  const description = document.getElementById('ticketDescription').value;
  const includeDeviceInfo = document.getElementById('includeDeviceInfo').checked;
  
  const ticket = {
    subject,
    priority,
    description,
    includeDeviceInfo
  };
  
  const result = await window.chadAPI.createTicket(ticket);
  
  if (result.success) {
    ticketForm.reset();
    document.getElementById('includeDeviceInfo').checked = true;
    
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(tc => tc.classList.remove('active'));
    
    document.querySelector('[data-tab="chat"]').classList.add('active');
    document.getElementById('tab-chat').classList.add('active');
    
    addMessage(`Ticket created: "${subject}". An IT specialist will respond shortly.`, 'system');
  } else {
    alert('Failed to create ticket. Please try again.');
  }
});

async function loadDeviceInfo() {
  deviceInfoContainer.innerHTML = '<div class="loading">Loading device information...</div>';
  
  try {
    const info = await window.chadAPI.getDeviceInfo();
    
    const formatBytes = (bytes) => {
      if (!bytes) return 'N/A';
      const gb = bytes / (1024 * 1024 * 1024);
      return gb.toFixed(1) + ' GB';
    };
    
    deviceInfoContainer.innerHTML = `
      <div class="info-section">
        <h4>System</h4>
        <div class="info-row">
          <span class="info-label">Hostname</span>
          <span class="info-value">${info.hostname || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Manufacturer</span>
          <span class="info-value">${info.manufacturer || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Model</span>
          <span class="info-value">${info.model || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Serial</span>
          <span class="info-value">${info.serial || 'N/A'}</span>
        </div>
      </div>
      
      <div class="info-section">
        <h4>Operating System</h4>
        <div class="info-row">
          <span class="info-label">Platform</span>
          <span class="info-value">${info.platform || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Distribution</span>
          <span class="info-value">${info.distro || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Version</span>
          <span class="info-value">${info.release || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Architecture</span>
          <span class="info-value">${info.arch || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Username</span>
          <span class="info-value">${info.username || 'N/A'}</span>
        </div>
      </div>
      
      <div class="info-section">
        <h4>Hardware</h4>
        <div class="info-row">
          <span class="info-label">CPU</span>
          <span class="info-value">${info.cpu?.brand || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Cores</span>
          <span class="info-value">${info.cpu?.cores || 'N/A'} (${info.cpu?.physicalCores || 'N/A'} physical)</span>
        </div>
        <div class="info-row">
          <span class="info-label">Total Memory</span>
          <span class="info-value">${formatBytes(info.memory?.total)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Used Memory</span>
          <span class="info-value">${formatBytes(info.memory?.used)}</span>
        </div>
      </div>
      
      <div class="info-section">
        <h4>Network</h4>
        <div class="info-row">
          <span class="info-label">Interface</span>
          <span class="info-value">${info.network?.iface || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">IPv4</span>
          <span class="info-value">${info.network?.ip4 || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">MAC Address</span>
          <span class="info-value">${info.network?.mac || 'N/A'}</span>
        </div>
      </div>
      
      <div class="info-section">
        <h4>Agent</h4>
        <div class="info-row">
          <span class="info-label">Device ID</span>
          <span class="info-value">${info.deviceId || 'N/A'}</span>
        </div>
      </div>
    `;
  } catch (error) {
    deviceInfoContainer.innerHTML = '<div class="loading">Failed to load device information</div>';
  }
}

async function loadSettings() {
  const serverUrl = await window.chadAPI.getServerUrl();
  serverUrlInput.value = serverUrl;
  
  const info = await window.chadAPI.getDeviceInfo();
  displayDeviceId.textContent = info.deviceId || 'Unknown';
  
  const status = await window.chadAPI.getConnectionStatus();
  updateConnectionStatus(status.connected);
}

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const serverUrl = serverUrlInput.value.trim();
  if (serverUrl) {
    await window.chadAPI.setServerUrl(serverUrl);
    alert('Settings saved. Reconnecting to server...');
  }
});

window.chadAPI.onDeploymentStarted((deployment) => {
  addMessage(`Deployment started: ${deployment.name}`, 'system');
});
