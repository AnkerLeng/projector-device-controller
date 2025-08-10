# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a projector device management system built as an Electron desktop application. The system allows users to manage and control projectors across different rooms with both individual device control and batch operations.

## Tech Stack

- **Frontend**: Vue 3, Ant Design Vue (antdv) UI library, HTML5/CSS3, JavaScript ES6+
- **Build Tool**: Vite for fast development and building
- **Desktop Framework**: Electron with IPC communication
- **Data Storage**: JSON files for device configuration persistence
- **Communication**: TCP/HTTP protocols for device control


## 重点,重点,重点
1. 需要使用context 7来查阅最新文档
2. 基于最新文档来进行工作.

## Architecture

The application follows a typical Electron architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                 │
├─────────────────────────────────────────────────────────┤
│                    Renderer Process                      │
│  ┌───────────────┬─────────────────────────────────────┐ │
│  │   房间导航    │                主内容区              │ │
│  │              │                                     │ │
│  │ 📍 所有设备   │  ┌─────┐ ┌─────┐ ┌─────┐           │ │
│  │ 🏠 会议室A   │  │设备1│ │设备2│ │设备3│           │ │
│  │ 🏠 会议室B   │  └─────┘ └─────┘ └─────┘           │ │
│  │ 🏠 未分类    │                                     │ │
│  └───────────────┴─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Core Features

### Device Management
- Room-based device categorization with default "未分类" (uncategorized) room
- Individual device control with dedicated power on/off buttons
- Batch operations for room-level or cross-room device management
- Device CRUD operations with form validation

### Data Structure
```javascript
// Device object structure
{
  id: "唯一标识符",
  name: "设备名称", 
  ip: "IP地址",
  port: 9763,  // TCP port (default 9763) or HTTP port (default 80)
  type: "tcp|http",
  room: "房间名称",  // Room classification field
  tcpCommands: {
    powerOn: "...",   // TCP command for power on
    powerOff: "...",  // TCP command for power off
    status: "..."     // TCP command for status query
  },
  httpUrls: {
    powerOn: "/api/power/on",    // HTTP GET path for power on
    powerOff: "/api/power/off",  // HTTP GET path for power off
    status: "/api/status"        // HTTP GET path for status query
  },
  httpAuth: {
    username: "admin",
    password: "password"         // Basic auth if required
  },
  // ... other configuration fields
}
```

### UI Components
- Compact device cards (300px minimum width, 280px on screens < 1200px)
- Room navigation sidebar with device count statistics
- Batch control panel (appears when devices are selected)
- Ant Design Vue integrated components: Modal, Form, Button, Card, Menu, Badge, etc.

## Development Patterns

### Device Cards
- Responsive design with Ant Design color scheme:
  - Primary: #1890ff (Ant Design Blue)
  - Success: #52c41a (Ant Design Green)
  - Warning: #faad14 (Ant Design Gold)
  - Danger: #ff4d4f (Ant Design Red)
  - Background: #f0f2f5 (Ant Design Background)
  - Border: #d9d9d9 (Ant Design Border)
  - Text: #262626 (Ant Design Text Primary)

### Room Management
- Rooms are created/managed through device forms
- Room data persisted to JSON configuration files
- Room switching filters device display
- Support for "全选" (select all) functionality per room

### State Management
- Loading states for async operations (device control)
- Success/failure message feedback
- Operation logging for debugging and user feedback

## Communication Protocols

### TCP Protocol Configuration
- **Port**: 9763 (default, configurable per device)
- **Protocol**: Raw TCP socket communication
- **Command Format**: Depends on projector manufacturer specification
- **Connection**: Persistent or per-command connections supported

### TCP Command Implementation
```javascript
// Electron Main Process - TCP Communication Handler
const net = require('net');

class TCPDeviceController {
  constructor(device) {
    this.device = device;
    this.isConnected = false;
    this.socket = null;
  }

  // Connect to device
  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.setTimeout(5000); // 5 second timeout
      
      this.socket.connect(this.device.port, this.device.ip, () => {
        this.isConnected = true;
        console.log(`Connected to ${this.device.name} at ${this.device.ip}:${this.device.port}`);
        resolve();
      });

      this.socket.on('error', (err) => {
        console.error(`TCP Error for ${this.device.name}:`, err);
        this.isConnected = false;
        reject(err);
      });

      this.socket.on('timeout', () => {
        console.error(`TCP Timeout for ${this.device.name}`);
        this.socket.destroy();
        reject(new Error('Connection timeout'));
      });
    });
  }

  // Send TCP command
  async sendCommand(command) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      return new Promise((resolve, reject) => {
        // Convert command string to buffer if needed
        const commandBuffer = Buffer.from(command, 'utf8');
        
        this.socket.write(commandBuffer);
        
        // Listen for response
        this.socket.once('data', (data) => {
          const response = data.toString();
          console.log(`Response from ${this.device.name}:`, response);
          resolve(response);
        });

        // Handle timeout
        setTimeout(() => {
          reject(new Error('Command timeout'));
        }, 3000);
      });
    } catch (error) {
      console.error(`Failed to send command to ${this.device.name}:`, error);
      throw error;
    }
  }

  // Power control methods
  async powerOn() {
    try {
      const response = await this.sendCommand(this.device.tcpCommands.powerOn);
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async powerOff() {
    try {
      const response = await this.sendCommand(this.device.tcpCommands.powerOff);
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getStatus() {
    try {
      const response = await this.sendCommand(this.device.tcpCommands.status);
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Close connection
  disconnect() {
    if (this.socket) {
      this.socket.destroy();
      this.isConnected = false;
    }
  }
}

// IPC Handler in Main Process
const { ipcMain } = require('electron');

ipcMain.handle('device-power-control', async (event, deviceId, action) => {
  try {
    const device = getDeviceById(deviceId); // Your device lookup function
    const controller = new TCPDeviceController(device);
    
    let result;
    switch (action) {
      case 'powerOn':
        result = await controller.powerOn();
        break;
      case 'powerOff':
        result = await controller.powerOff();
        break;
      case 'status':
        result = await controller.getStatus();
        break;
      default:
        throw new Error('Invalid action');
    }
    
    controller.disconnect();
    return result;
  } catch (error) {
    console.error('Device control error:', error);
    return { success: false, error: error.message };
  }
});
```

### Common TCP Command Formats
```javascript
// Example TCP commands (adjust based on actual projector protocol)
const commonTCPCommands = {
  // Format 1: Simple text commands
  simple: {
    powerOn: "PWR ON\r\n",
    powerOff: "PWR OFF\r\n",
    status: "PWR?\r\n"
  },
  
  // Format 2: Hex commands
  hex: {
    powerOn: Buffer.from([0x02, 0x00, 0x00, 0x00, 0x00, 0x02]),
    powerOff: Buffer.from([0x02, 0x01, 0x00, 0x00, 0x00, 0x03]),
    status: Buffer.from([0x02, 0x10, 0x00, 0x00, 0x00, 0x12])
  },
  
  // Format 3: PJLink protocol (common standard)
  pjlink: {
    powerOn: "%1POWR 1\r",
    powerOff: "%1POWR 0\r", 
    status: "%1POWR ?\r"
  }
};
```

### HTTP Protocol Implementation
```javascript
// HTTP Device Controller
const axios = require('axios');

class HTTPDeviceController {
  constructor(device) {
    this.device = device;
    this.baseURL = `http://${device.ip}:${device.port || 80}`;
    
    // Setup axios instance with auth if needed
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 5000,
      auth: device.httpAuth ? {
        username: device.httpAuth.username,
        password: device.httpAuth.password
      } : undefined
    });
  }

  // Power control methods
  async powerOn() {
    try {
      const response = await this.client.get(this.device.httpUrls.powerOn);
      console.log(`HTTP Power ON response for ${this.device.name}:`, response.data);
      return { 
        success: true, 
        response: response.data,
        status: response.status
      };
    } catch (error) {
      console.error(`HTTP Power ON failed for ${this.device.name}:`, error.message);
      return { 
        success: false, 
        error: error.message,
        status: error.response?.status
      };
    }
  }

  async powerOff() {
    try {
      const response = await this.client.get(this.device.httpUrls.powerOff);
      console.log(`HTTP Power OFF response for ${this.device.name}:`, response.data);
      return { 
        success: true, 
        response: response.data,
        status: response.status
      };
    } catch (error) {
      console.error(`HTTP Power OFF failed for ${this.device.name}:`, error.message);
      return { 
        success: false, 
        error: error.message,
        status: error.response?.status
      };
    }
  }

  async getStatus() {
    try {
      const response = await this.client.get(this.device.httpUrls.status);
      console.log(`HTTP Status response for ${this.device.name}:`, response.data);
      return { 
        success: true, 
        response: response.data,
        status: response.status
      };
    } catch (error) {
      console.error(`HTTP Status failed for ${this.device.name}:`, error.message);
      return { 
        success: false, 
        error: error.message,
        status: error.response?.status
      };
    }
  }
}

// Updated IPC Handler supporting both TCP and HTTP
ipcMain.handle('device-power-control', async (event, deviceId, action) => {
  try {
    const device = getDeviceById(deviceId);
    let controller;
    
    // Create appropriate controller based on device type
    if (device.type === 'tcp') {
      controller = new TCPDeviceController(device);
    } else if (device.type === 'http') {
      controller = new HTTPDeviceController(device);
    } else {
      throw new Error(`Unsupported device type: ${device.type}`);
    }
    
    let result;
    switch (action) {
      case 'powerOn':
        result = await controller.powerOn();
        break;
      case 'powerOff':
        result = await controller.powerOff();
        break;
      case 'status':
        result = await controller.getStatus();
        break;
      default:
        throw new Error('Invalid action');
    }
    
    // Cleanup for TCP connections
    if (device.type === 'tcp' && controller.disconnect) {
      controller.disconnect();
    }
    
    return result;
  } catch (error) {
    console.error('Device control error:', error);
    return { success: false, error: error.message };
  }
});
```

### Common HTTP API Formats
```javascript
// Example HTTP URL patterns for different projector brands
const commonHTTPPatterns = {
  // Simple REST API
  restful: {
    powerOn: "/api/power/on",
    powerOff: "/api/power/off", 
    status: "/api/power/status"
  },
  
  // Query parameter based
  query: {
    powerOn: "/control?cmd=power&action=on",
    powerOff: "/control?cmd=power&action=off",
    status: "/control?cmd=power&action=status"
  },
  
  // CGI style
  cgi: {
    powerOn: "/cgi-bin/proj_control.cgi?power=on",
    powerOff: "/cgi-bin/proj_control.cgi?power=off",
    status: "/cgi-bin/proj_control.cgi?power=status"
  },
  
  // Custom command format
  custom: {
    powerOn: "/api/v1/projector/command/power_on",
    powerOff: "/api/v1/projector/command/power_off",
    status: "/api/v1/projector/status"
  }
};
```

## Responsive Design
- Optimized for various screen sizes
- Touch-screen friendly interface
- Minimum card widths adjust based on viewport
- Mobile and desktop compatibility

## Key Implementation Notes
- All device operations include loading states and user feedback
- Form validation for all device configuration inputs
- Persistent storage ensures data survives application restarts
- Modern ES6+ JavaScript with Vue 3 Composition API patterns expected

## Ant Design Vue Integration

### Installation
```bash
npm install ant-design-vue
npm install @ant-design/icons-vue
```

### Vite Configuration
```javascript
// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  css: {
    preprocessorOptions: {
      less: {
        modifyVars: {
          // Ant Design theme customization
          '@primary-color': '#1890ff',
          '@link-color': '#1890ff',
          '@success-color': '#52c41a',
          '@warning-color': '#faad14',
          '@error-color': '#ff4d4f',
          '@font-size-base': '14px',
          '@border-radius-base': '6px'
        },
        javascriptEnabled: true
      }
    }
  },
  // Electron-specific configuration
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      external: ['electron']
    }
  }
})
```

### Main.js Setup
```javascript
import { createApp } from 'vue'
import App from './App.vue'

// Import Ant Design Vue
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/antd.css'

// Import icons (optional, can import specific icons as needed)
import * as Icons from '@ant-design/icons-vue'

const app = createApp(App)

// Use Ant Design Vue
app.use(Antd)

// Register icons globally (optional)
Object.keys(Icons).forEach(key => {
  app.component(key, Icons[key])
})

app.mount('#app')
```

### Development Commands
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Electron development (if electron-builder is configured)
npm run electron:dev

# Build electron app
npm run electron:build
```

### Component Usage Examples

#### Device Control Vue Component
```vue
<template>
  <!-- Device Card with TCP Control -->
  <a-card 
    :title="device.name"
    size="small"
    :style="{ width: '300px', minWidth: '280px' }"
  >
    <template #extra>
      <a-space>
        <a-tag :color="device.type === 'tcp' ? 'blue' : 'green'">
          {{ device.type.toUpperCase() }}
        </a-tag>
        <a-tag v-if="device.type === 'tcp'" color="orange">
          :{{ device.port || 9763 }}
        </a-tag>
      </a-space>
    </template>
    
    <a-space direction="vertical" size="small" style="width: 100%">
      <a-tag color="default">{{ device.room }}</a-tag>
      
      <!-- Connection Status -->
      <a-tag 
        :color="device.status === 'online' ? 'green' : 'red'"
        v-if="device.status"
      >
        {{ device.status === 'online' ? '在线' : '离线' }}
      </a-tag>
      
      <!-- Power Control Buttons -->
      <a-space>
        <a-button 
          type="primary" 
          size="small"
          :loading="device.powering === 'on'"
          :disabled="device.powering !== false"
          @click="handlePowerControl(device, 'powerOn')"
        >
          <PoweroffOutlined />
          开机
        </a-button>
        <a-button 
          danger 
          size="small"
          :loading="device.powering === 'off'"
          :disabled="device.powering !== false"
          @click="handlePowerControl(device, 'powerOff')"
        >
          <PoweroffOutlined />
          关机
        </a-button>
        <a-button 
          size="small"
          :loading="device.checking"
          @click="checkDeviceStatus(device)"
        >
          <SyncOutlined />
          状态
        </a-button>
      </a-space>
      
      <!-- TCP Command Configuration (Admin Mode) -->
      <a-collapse v-if="adminMode && device.type === 'tcp'" size="small">
        <a-collapse-panel key="1" header="TCP命令配置">
          <a-form layout="vertical" size="small">
            <a-form-item label="开机命令">
              <a-input 
                v-model:value="device.tcpCommands.powerOn"
                placeholder="例如: PWR ON\r\n"
              />
            </a-form-item>
            <a-form-item label="关机命令">
              <a-input 
                v-model:value="device.tcpCommands.powerOff"
                placeholder="例如: PWR OFF\r\n"
              />
            </a-form-item>
            <a-form-item label="状态查询命令">
              <a-input 
                v-model:value="device.tcpCommands.status"
                placeholder="例如: PWR?\r\n"
              />
            </a-form-item>
            <a-button size="small" @click="saveDeviceCommands(device)">
              保存命令
            </a-button>
          </a-form>
        </a-collapse-panel>
      </a-collapse>
    </a-space>
  </a-card>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { message } from 'ant-design-vue';
import { PoweroffOutlined, SyncOutlined } from '@ant-design/icons-vue';

const props = defineProps({
  device: {
    type: Object,
    required: true
  },
  adminMode: {
    type: Boolean,
    default: false
  }
});

// Device power control via IPC
const handlePowerControl = async (device, action) => {
  try {
    // Set loading state
    device.powering = action === 'powerOn' ? 'on' : 'off';
    
    // Call Electron IPC
    const result = await window.electronAPI.deviceControl(device.id, action);
    
    if (result.success) {
      message.success(`${device.name} ${action === 'powerOn' ? '开机' : '关机'}成功`);
      device.status = action === 'powerOn' ? 'online' : 'offline';
    } else {
      message.error(`${device.name} 操作失败: ${result.error}`);
    }
  } catch (error) {
    console.error('Power control error:', error);
    message.error(`设备控制失败: ${error.message}`);
  } finally {
    device.powering = false;
  }
};

// Check device status
const checkDeviceStatus = async (device) => {
  try {
    device.checking = true;
    const result = await window.electronAPI.deviceControl(device.id, 'status');
    
    if (result.success) {
      // Parse status response based on device protocol
      const status = parseDeviceStatus(result.response);
      device.status = status;
      message.info(`${device.name} 状态: ${status}`);
    } else {
      message.error(`状态查询失败: ${result.error}`);
    }
  } catch (error) {
    message.error(`状态查询失败: ${error.message}`);
  } finally {
    device.checking = false;
  }
};

// Parse device status response
const parseDeviceStatus = (response) => {
  // This should be customized based on actual device response format
  if (response.includes('ON') || response.includes('1')) {
    return 'online';
  } else if (response.includes('OFF') || response.includes('0')) {
    return 'offline';
  }
  return 'unknown';
};

// Save TCP commands
const saveDeviceCommands = async (device) => {
  try {
    await window.electronAPI.saveDeviceConfig(device);
    message.success('TCP命令配置已保存');
  } catch (error) {
    message.error('保存失败: ' + error.message);
  }
};
</script>
```

#### Electron Preload Script
```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Device control
  deviceControl: (deviceId, action) => 
    ipcRenderer.invoke('device-power-control', deviceId, action),
  
  // Save device configuration
  saveDeviceConfig: (device) => 
    ipcRenderer.invoke('save-device-config', device),
  
  // Get all devices
  getDevices: () => 
    ipcRenderer.invoke('get-devices'),
  
  // Batch operations
  batchDeviceControl: (deviceIds, action) =>
    ipcRenderer.invoke('batch-device-control', deviceIds, action)
});
```

#### Batch TCP Control Implementation
```javascript
// Electron Main Process - Batch Operations
ipcMain.handle('batch-device-control', async (event, deviceIds, action) => {
  const results = [];
  const controllers = [];
  
  try {
    // Create controllers for all devices
    for (const deviceId of deviceIds) {
      const device = getDeviceById(deviceId);
      if (device.type === 'tcp') {
        const controller = new TCPDeviceController(device);
        controllers.push({ deviceId, controller, device });
      }
    }
    
    // Execute commands in parallel for better performance
    const promises = controllers.map(async ({ deviceId, controller, device }) => {
      try {
        let result;
        switch (action) {
          case 'powerOn':
            result = await controller.powerOn();
            break;
          case 'powerOff':
            result = await controller.powerOff();
            break;
          case 'status':
            result = await controller.getStatus();
            break;
        }
        
        controller.disconnect();
        return { deviceId, device: device.name, success: true, result };
      } catch (error) {
        controller.disconnect();
        return { deviceId, device: device.name, success: false, error: error.message };
      }
    });
    
    const results = await Promise.all(promises);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    return {
      success: true,
      results,
      summary: { successful, failed, total: results.length }
    };
    
  } catch (error) {
    // Cleanup all controllers on error
    controllers.forEach(({ controller }) => controller.disconnect());
    return { success: false, error: error.message };
  }
});
```

#### TCP Protocol Testing and Debugging
```javascript
// Utility for testing TCP commands
ipcMain.handle('test-tcp-command', async (event, deviceConfig, command) => {
  const controller = new TCPDeviceController(deviceConfig);
  
  try {
    await controller.connect();
    const response = await controller.sendCommand(command);
    controller.disconnect();
    
    return {
      success: true,
      response,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    controller.disconnect();
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
});
```

### Theme Customization
```javascript
// main.js or app setup
import { ConfigProvider } from 'ant-design-vue';

// Custom theme tokens
const theme = {
  token: {
    colorPrimary: '#1890ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    borderRadius: 6,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
  }
};

// Wrap app with ConfigProvider for consistent theming
app.use(ConfigProvider, { theme });
```

### Message and Notification
```javascript
import { message, notification } from 'ant-design-vue';

// Success feedback
message.success('设备操作成功');

// Error feedback  
message.error('设备连接失败');

// Batch operation notification
notification.success({
  message: '批量操作完成',
  description: `成功控制 ${successCount} 台设备，${failCount} 台设备操作失败`
});
```