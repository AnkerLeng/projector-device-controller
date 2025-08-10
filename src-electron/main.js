const { app, BrowserWindow, ipcMain } = require('electron');
const { join } = require('path');
const fs = require('fs').promises;
const net = require('net');
const axios = require('axios');
const DataManager = require('./data-manager');

// 使用新的数据管理器
const dataManager = new DataManager();

// Check if running in development
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// TCP Device Controller
class TCPDeviceController {
  constructor(device) {
    this.device = device;
    this.isConnected = false;
    this.socket = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.setTimeout(5000);
      
      // Enhanced connection logging
      console.log(`Attempting TCP connection to ${this.device.name} at ${this.device.ip}:${this.device.port || 9763}`);
      const startTime = Date.now();
      
      this.socket.connect(this.device.port || 9763, this.device.ip, () => {
        this.isConnected = true;
        const connectionTime = Date.now() - startTime;
        console.log(`TCP Connected to ${this.device.name} at ${this.device.ip}:${this.device.port || 9763} (${connectionTime}ms)`);
        resolve();
      });

      this.socket.on('error', (err) => {
        const connectionTime = Date.now() - startTime;
        console.error(`TCP Error for ${this.device.name} after ${connectionTime}ms:`, {
          code: err.code,
          errno: err.errno,
          address: err.address,
          port: err.port,
          message: err.message
        });
        this.isConnected = false;
        
        // Provide more specific error messages
        let friendlyError = err.message;
        switch (err.code) {
          case 'ECONNREFUSED':
            friendlyError = '连接被拒绝：设备可能未开机或端口未开放';
            break;
          case 'EHOSTUNREACH':
            friendlyError = '主机不可达：检查IP地址和网络连接';
            break;
          case 'ETIMEDOUT':
            friendlyError = '连接超时：设备响应时间过长';
            break;
          case 'ENOTFOUND':
            friendlyError = '主机未找到：IP地址可能不正确';
            break;
        }
        
        reject(new Error(friendlyError));
      });

      this.socket.on('timeout', () => {
        const connectionTime = Date.now() - startTime;
        console.error(`TCP Timeout for ${this.device.name} after ${connectionTime}ms`);
        this.socket.destroy();
        reject(new Error(`连接超时 (${connectionTime}ms)`));
      });
    });
  }

  async sendCommand(command) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      return new Promise((resolve, reject) => {
        const commandBuffer = Buffer.isBuffer(command) ? command : Buffer.from(command, 'utf8');
        
        this.socket.write(commandBuffer);
        
        this.socket.once('data', (data) => {
          const response = data.toString();
          console.log(`TCP Response from ${this.device.name}:`, response);
          resolve(response);
        });

        setTimeout(() => {
          reject(new Error('Command timeout'));
        }, 3000);
      });
    } catch (error) {
      console.error(`Failed to send TCP command to ${this.device.name}:`, error);
      throw error;
    }
  }

  async powerOn() {
    try {
      const command = this.processCommand(this.device.tcpCommands?.powerOn || 'PWR ON\r\n');
      const response = await this.sendCommand(command);
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async powerOff() {
    try {
      const command = this.processCommand(this.device.tcpCommands?.powerOff || 'PWR OFF\r\n');
      const response = await this.sendCommand(command);
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getStatus() {
    try {
      const command = this.processCommand(this.device.tcpCommands?.status || 'PWR?\r\n');
      const response = await this.sendCommand(command);
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  processCommand(command) {
    // Process escape characters in command strings
    return command.replace(/\\r/g, '\r').replace(/\\n/g, '\n');
  }

  disconnect() {
    if (this.socket) {
      this.socket.destroy();
      this.isConnected = false;
    }
  }
}

// HTTP Device Controller
class HTTPDeviceController {
  constructor(device) {
    this.device = device;
    this.baseURL = `http://${device.ip}:${device.port || 80}`;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 5000,
      auth: device.httpAuth ? {
        username: device.httpAuth.username,
        password: device.httpAuth.password
      } : undefined
    });
  }

  async powerOn() {
    const startTime = Date.now();
    try {
      const url = this.device.httpUrls?.powerOn || '/api/power/on';
      console.log(`Sending HTTP Power ON to ${this.device.name}: GET ${this.baseURL}${url}`);
      
      const response = await this.client.get(url);
      const responseTime = Date.now() - startTime;
      
      console.log(`HTTP Power ON response for ${this.device.name} (${responseTime}ms):`, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      });
      
      return { 
        success: true, 
        response: response.data,
        status: response.status,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`HTTP Power ON failed for ${this.device.name} after ${responseTime}ms:`, {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      
      // Provide more user-friendly error messages
      let friendlyError = error.message;
      if (error.code === 'ECONNREFUSED') {
        friendlyError = 'HTTP连接被拒绝：检查设备IP和端口';
      } else if (error.code === 'ETIMEDOUT') {
        friendlyError = 'HTTP请求超时：设备响应时间过长';
      } else if (error.response?.status === 401) {
        friendlyError = 'HTTP认证失败：检查用户名和密码';
      } else if (error.response?.status === 404) {
        friendlyError = 'HTTP路径不存在：检查API路径配置';
      }
      
      return { 
        success: false, 
        error: friendlyError,
        status: error.response?.status,
        responseTime
      };
    }
  }

  async powerOff() {
    try {
      const url = this.device.httpUrls?.powerOff || '/api/power/off';
      const response = await this.client.get(url);
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
      const url = this.device.httpUrls?.status || '/api/status';
      const response = await this.client.get(url);
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

// Device helper functions
function getDeviceById(deviceId) {
  const devices = dataManager.get('devices');
  return devices.find(d => d.id === deviceId);
}

// IPC Handlers
ipcMain.handle('get-devices', async () => {
  return dataManager.get('devices');
});

ipcMain.handle('save-device', async (event, device) => {
  return await dataManager.saveDevice(device);
});

ipcMain.handle('delete-device', async (event, deviceId) => {
  return await dataManager.deleteDevice(deviceId);
});

ipcMain.handle('device-power-control', async (event, deviceId, action) => {
  try {
    const device = getDeviceById(deviceId);
    if (!device) {
      return { success: false, error: 'Device not found' };
    }

    let controller;
    
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

ipcMain.handle('batch-device-control', async (event, deviceIds, action) => {
  const promises = deviceIds.map(async (deviceId) => {
    try {
      const device = getDeviceById(deviceId);
      if (!device) {
        return { deviceId, deviceName: 'Unknown', success: false, error: 'Device not found' };
      }

      let controller;
      
      if (device.type === 'tcp') {
        controller = new TCPDeviceController(device);
      } else if (device.type === 'http') {
        controller = new HTTPDeviceController(device);
      } else {
        return { deviceId, deviceName: device.name, success: false, error: `Unsupported device type: ${device.type}` };
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
          result = { success: false, error: 'Invalid action' };
      }
      
      // Cleanup for TCP connections
      if (device.type === 'tcp' && controller.disconnect) {
        controller.disconnect();
      }
      
      return { deviceId, deviceName: device.name, success: result.success, result };
    } catch (error) {
      const device = getDeviceById(deviceId);
      return { deviceId, deviceName: device?.name || 'Unknown', success: false, error: error.message };
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
});

// Device Groups IPC Handlers
ipcMain.handle('get-device-groups', async () => {
  return dataManager.get('deviceGroups');
});

ipcMain.handle('save-device-groups', async (event, groups) => {
  await dataManager.save('deviceGroups', groups);
  return true;
});

// Custom Rooms IPC Handlers
ipcMain.handle('get-custom-rooms', async () => {
  return dataManager.get('customRooms');
});

ipcMain.handle('save-custom-rooms', async (event, rooms) => {
  await dataManager.save('customRooms', rooms);
  return true;
});

// 新增：数据统计和管理 IPC Handlers
ipcMain.handle('get-stats', async () => {
  return dataManager.getStats();
});

ipcMain.handle('export-data', async () => {
  return await dataManager.exportData();
});

ipcMain.handle('import-data', async (event, importData) => {
  return await dataManager.importData(importData);
});

ipcMain.handle('create-backup', async () => {
  return await dataManager.createBackup();
});

// Test TCP command handler
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

// Electron app setup
let mainWindow;

function createWindow() {
  console.log('Creating main window...');
  console.log('Preload script path:', join(__dirname, 'preload.js'));
  console.log('Development mode:', isDev);
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js')
    },
    icon: join(__dirname, '../assets/icon.png'), // Add icon if available
    title: 'Projector Manager'
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Renderer process loaded');
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('Renderer process crashed');
  });

  // Load app
  if (isDev) {
    console.log('Loading development server at http://127.0.0.1:5173');
    mainWindow.loadURL('http://127.0.0.1:5173');
    // Wait for the page to load before opening DevTools
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.openDevTools();
    });
  } else {
    console.log('Loading production build');
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  console.log('Electron app is ready');
  console.log('Node version:', process.version);
  console.log('Electron version:', process.versions.electron);
  console.log('Main process PID:', process.pid);
  console.log('isDev:', isDev);
  
  try {
    // 使用新的数据管理器加载数据
    await dataManager.load('devices');
    await dataManager.load('deviceGroups'); 
    await dataManager.load('customRooms');
    
    const stats = dataManager.getStats();
    console.log(`Loaded ${stats.totalDevices} devices, ${stats.totalGroups} device groups, ${stats.totalRooms} custom rooms`);
    console.log('Device distribution by type:', stats.devicesByType);
    console.log('Device distribution by room:', stats.devicesByRoom);
  } catch (error) {
    console.error('Failed to load data:', error);
  }
  
  console.log('About to create window...');
  createWindow();
  console.log('Window creation initiated');
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Handle app errors
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    // Prevent new windows from being created
    event.preventDefault();
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  // 应用退出前创建备份
  try {
    const backupPath = await dataManager.createBackup();
    console.log('Backup created:', backupPath);
  } catch (error) {
    console.error('Failed to create backup on quit:', error);
  }
});