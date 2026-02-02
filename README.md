# CHAD Agent

Desktop agent for the CHAD (Cyber Helpdesk & Automation Daemon) system. This lightweight Electron app runs on Windows, macOS, and Linux endpoints, providing:

- **System tray integration** - Runs quietly in the background
- **Hotkey activation** - Press `Ctrl+Shift+H` to open support chat
- **Device registration** - Auto-registers with CHAD server
- **Real-time chat** - Direct communication with IT support
- **Ticket creation** - Create support tickets with device context
- **Remote commands** - Execute IT-approved scripts
- **Deployment support** - Receive software deployments

## Installation

### Pre-built Binaries

Download the latest release for your platform from the [Releases](../../releases) page:

- **Windows**: `CHAD-Agent-Setup-x.x.x.exe` (installer) or `CHAD-Agent-x.x.x-portable.exe`
- **macOS**: `CHAD-Agent-x.x.x.dmg`
- **Linux**: `CHAD-Agent-x.x.x.AppImage` or `.deb` package

### Building from Source

```bash
# Install dependencies
cd chad-agent
npm install

# Run in development
npm start

# Build for current platform
npm run build

# Build for specific platform
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## Configuration

On first launch, configure the CHAD server URL in Settings:

1. Click the tray icon or press `Ctrl+Shift+H`
2. Go to Settings tab
3. Enter your CHAD server WebSocket URL (e.g., `ws://your-chad-server.com:5000`)
4. Click Save Settings

## Features

### Chat with IT Support
Open the agent window and use the Chat tab to message IT directly. Messages are routed to the CHAD helpdesk for response.

### Create Support Tickets
Use the "New Ticket" tab to create a formal support request. The agent can automatically include device information:
- Hostname and OS details
- Hardware specifications
- Network configuration
- Current logged-in user

### View Device Information
The "Device Info" tab shows detailed system information that IT can use for troubleshooting.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+H` | Open CHAD Agent (global) |

## System Requirements

- **Windows**: Windows 10 or later
- **macOS**: macOS 10.13 (High Sierra) or later
- **Linux**: Ubuntu 18.04+ or equivalent

## Security

- Device ID is generated locally and stored securely
- Communications use WebSocket (recommend WSS in production)
- No passwords or sensitive data stored on device
- Command execution is sandboxed and logged

## Development

```bash
# Install dependencies
npm install

# Start in development mode
npm start

# The app will connect to ws://localhost:5000/agent by default
```

## Building Releases

The GitHub Actions workflow automatically builds releases for all platforms when you push a version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This triggers the build workflow which creates Windows, macOS, and Linux binaries and publishes them as a GitHub Release.

## License

MIT
