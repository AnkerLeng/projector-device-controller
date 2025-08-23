const { app, BrowserWindow, ipcMain } = require('electron');
const { join } = require('path');
const fs = require('fs').promises;
const net = require('net');
const axios = require('axios');
const { updateElectronApp } = require('update-electron-app');
const log = require('electron-log');
const DataManager = require('./data-manager');
const PCController = require('./pc-controller');

// 使用新的数据管理器
const dataManager = new DataManager();

// Check if running in development
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// 配置electron-log
log.transports.file.level = 'info';
log.transports.console.level = isDev ? 'debug' : 'info';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB

// 初始化自动更新 (只在生产环境)
if (!isDev) {
  try {
    updateElectronApp({
      updateInterval: '1 hour', // 每小时检查一次更新
      logger: log,
      notifyUser: true // 通知用户有可用更新
    });
    log.info('Auto-updater initialized');
  } catch (error) {
    log.error('Failed to initialize auto-updater:', error);
  }
}

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
      
      // Enhanced connection logging with IP format like projector_control.js
      console.log(`[${this.device.ip}] 尝试TCP连接到 ${this.device.name}...`);
      const startTime = Date.now();
      
      this.socket.connect(this.device.port || 9763, this.device.ip, () => {
        this.isConnected = true;
        const connectionTime = Date.now() - startTime;
        console.log(`[${this.device.ip}] TCP连接成功 (${connectionTime}ms)`);
        resolve();
      });

      this.socket.on('error', (err) => {
        const connectionTime = Date.now() - startTime;
        this.isConnected = false;
        
        // Log error in the same format as projector_control.js
        let errorMessage = '';
        switch (err.code) {
          case 'ECONNREFUSED':
            errorMessage = '连接被拒绝';
            break;
          case 'EHOSTUNREACH':
            errorMessage = '主机不可达';
            break;
          case 'ETIMEDOUT':
            errorMessage = '连接超时';
            break;
          case 'ENOTFOUND':
            errorMessage = '主机未找到';
            break;
          default:
            errorMessage = `错误: ${err.message}`;
        }
        
        console.log(`[${this.device.ip}] ${errorMessage}`);
        reject(new Error(errorMessage));
      });

      this.socket.on('timeout', () => {
        const connectionTime = Date.now() - startTime;
        console.log(`[${this.device.ip}] 连接超时`);
        this.socket.destroy();
        reject(new Error('连接超时'));
      });

      this.socket.on('close', () => {
        console.log(`[${this.device.ip}] 连接已关闭`);
      });
    });
  }

  async sendCommand(command, retryCount = 0) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      return new Promise((resolve, reject) => {
        const commandBuffer = Buffer.isBuffer(command) ? command : Buffer.from(command, 'utf8');
        
        // Log command send in projector_control.js format
        const retryText = retryCount > 0 ? ` (第${retryCount}次重试)` : '';
        console.log(`[${this.device.ip}] 发送指令 ${command.trim()}${retryText}...`);
        
        this.socket.write(commandBuffer);
        
        this.socket.once('data', (data) => {
          const response = data.toString().trim();
          console.log(`[${this.device.ip}] 收到响应: ${response}`);
          
          // Validate response matches command (like projector_control.js)
          if (response === command.trim()) {
            console.log(`[${this.device.ip}] 指令执行成功`);
          } else if (response.includes('OK') || response.includes('SUCCESS')) {
            console.log(`[${this.device.ip}] 指令执行成功 (收到确认响应)`);
          } else {
            console.log(`[${this.device.ip}] 响应不匹配，但已收到响应`);
          }
          
          resolve(response);
        });

        setTimeout(() => {
          console.log(`[${this.device.ip}] 命令执行超时`);
          reject(new Error('命令执行超时'));
        }, 3000);
      });
    } catch (error) {
      console.log(`[${this.device.ip}] 发送指令失败: ${error.message}`);
      throw error;
    }
  }

  async powerOn(retryCount = 0) {
    try {
      const command = this.processCommand(this.device.tcpCommands?.powerOn || 'PWR ON\r\n');
      const response = await this.sendCommand(command, retryCount);
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async powerOff(retryCount = 0) {
    try {
      const command = this.processCommand(this.device.tcpCommands?.powerOff || 'PWR OFF\r\n');
      const response = await this.sendCommand(command, retryCount);
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getStatus(retryCount = 0) {
    try {
      const command = this.processCommand(this.device.tcpCommands?.status || 'PWR?\r\n');
      const response = await this.sendCommand(command, retryCount);
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

  // 带重试机制的电源控制方法
  async powerControlWithRetry(action, maxRetries = 10, retryDelay = 5000) {
    let lastError = null;
    let actionCommand = '';
    
    // 获取实际执行的命令以便在日志中显示
    switch (action) {
      case 'powerOn':
        actionCommand = this.processCommand(this.device.tcpCommands?.powerOn || 'PWR ON\r\n').trim();
        break;
      case 'powerOff':
        actionCommand = this.processCommand(this.device.tcpCommands?.powerOff || 'PWR OFF\r\n').trim();
        break;
      case 'status':
        actionCommand = this.processCommand(this.device.tcpCommands?.status || 'PWR?\r\n').trim();
        break;
      default:
        actionCommand = action;
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let result;
        switch (action) {
          case 'powerOn':
            result = await this.powerOn(attempt > 1 ? attempt - 1 : 0);
            break;
          case 'powerOff':
            result = await this.powerOff(attempt > 1 ? attempt - 1 : 0);
            break;
          case 'status':
            result = await this.getStatus(attempt > 1 ? attempt - 1 : 0);
            break;
          default:
            throw new Error('Invalid action');
        }
        
        if (result.success) {
          // 对于TCP设备，验证响应是否正确
          const receivedResponse = result.response?.trim();
          const isValidResponse = this.validateResponse(action, receivedResponse);
          
          if (isValidResponse) {
            // 成功日志已在sendCommand中输出
            return { ...result, attempts: attempt };
          } else {
            console.log(`[${this.device.ip}] 响应不匹配，需要重试`);
            lastError = new Error('响应验证失败');
          }
        } else {
          lastError = new Error(result.error);
        }
      } catch (error) {
        lastError = error;
      }
      
      // 如果不是最后一次尝试，等待重试间隔
      if (attempt < maxRetries) {
        // 等待重试间隔
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    // 所有重试都失败了
    console.log(`[${this.device.ip}] 所有重试均失败`);
    return { 
      success: false, 
      error: lastError?.message || '重试次数已用完', 
      attempts: maxRetries 
    };
  }

  // 验证响应是否有效
  validateResponse(action, response) {
    if (!response) return false;
    
    const responseUpper = response.toUpperCase();
    switch (action) {
      case 'powerOn':
        // 检查是否包含开机成功的关键字
        return responseUpper.includes('ON') || responseUpper.includes('POWER1') || 
               responseUpper.includes('PWR') || responseUpper.includes('1');
      case 'powerOff':
        // 检查是否包含关机成功的关键字
        return responseUpper.includes('OFF') || responseUpper.includes('POWER0') ||
               responseUpper.includes('PWR') || responseUpper.includes('0');
      case 'status':
        // 状态查询只要有响应就认为成功
        return true;
      default:
        return true;
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

  async powerOn(retryCount = 0) {
    const startTime = Date.now();
    try {
      const url = this.device.httpUrls?.powerOn || '/api/power/on';
      const retryText = retryCount > 0 ? ` (第${retryCount}次重试)` : '';
      console.log(`[${this.device.ip}] 发送HTTP请求 GET ${url}${retryText}...`);
      
      const response = await this.client.get(url);
      const responseTime = Date.now() - startTime;
      
      console.log(`[${this.device.ip}] 收到HTTP响应: ${response.status} ${response.statusText} (${responseTime}ms)`);
      
      if (response.status >= 200 && response.status < 300) {
        console.log(`[${this.device.ip}] HTTP请求执行成功`);
      } else {
        console.log(`[${this.device.ip}] HTTP响应状态异常: ${response.status}`);
      }
      
      return { 
        success: true, 
        response: response.data,
        status: response.status,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Log error in the same format
      let errorMessage = '';
      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'HTTP连接被拒绝';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'HTTP请求超时';
      } else if (error.response?.status === 401) {
        errorMessage = 'HTTP认证失败';
      } else if (error.response?.status === 404) {
        errorMessage = 'HTTP路径不存在';
      } else {
        errorMessage = `HTTP错误: ${error.message}`;
      }
      
      console.log(`[${this.device.ip}] ${errorMessage}`);
      
      return { 
        success: false, 
        error: errorMessage,
        status: error.response?.status,
        responseTime
      };
    }
  }

  async powerOff(retryCount = 0) {
    const startTime = Date.now();
    try {
      const url = this.device.httpUrls?.powerOff || '/api/power/off';
      const retryText = retryCount > 0 ? ` (第${retryCount}次重试)` : '';
      console.log(`[${this.device.ip}] 发送HTTP请求 GET ${url}${retryText}...`);
      
      const response = await this.client.get(url);
      const responseTime = Date.now() - startTime;
      
      console.log(`[${this.device.ip}] 收到HTTP响应: ${response.status} ${response.statusText} (${responseTime}ms)`);
      
      if (response.status >= 200 && response.status < 300) {
        console.log(`[${this.device.ip}] HTTP请求执行成功`);
      }
      
      return { 
        success: true, 
        response: response.data,
        status: response.status,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      let errorMessage = error.code === 'ECONNREFUSED' ? 'HTTP连接被拒绝' : 
                        error.code === 'ETIMEDOUT' ? 'HTTP请求超时' : 
                        `HTTP错误: ${error.message}`;
      
      console.log(`[${this.device.ip}] ${errorMessage}`);
      return { 
        success: false, 
        error: errorMessage,
        status: error.response?.status,
        responseTime
      };
    }
  }

  async getStatus(retryCount = 0) {
    const startTime = Date.now();
    try {
      const url = this.device.httpUrls?.status || '/api/status';
      const retryText = retryCount > 0 ? ` (第${retryCount}次重试)` : '';
      console.log(`[${this.device.ip}] 发送HTTP状态查询 GET ${url}${retryText}...`);
      
      const response = await this.client.get(url);
      const responseTime = Date.now() - startTime;
      
      console.log(`[${this.device.ip}] 收到HTTP状态响应: ${response.status} ${response.statusText} (${responseTime}ms)`);
      
      if (response.status >= 200 && response.status < 300) {
        console.log(`[${this.device.ip}] HTTP状态查询成功`);
      }
      
      return { 
        success: true, 
        response: response.data,
        status: response.status,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      let errorMessage = error.code === 'ECONNREFUSED' ? 'HTTP连接被拒绝' : 
                        error.code === 'ETIMEDOUT' ? 'HTTP请求超时' : 
                        `HTTP错误: ${error.message}`;
      
      console.log(`[${this.device.ip}] ${errorMessage}`);
      return { 
        success: false, 
        error: errorMessage,
        status: error.response?.status,
        responseTime
      };
    }
  }

  // 带重试机制的电源控制方法
  async powerControlWithRetry(action, maxRetries = 10, retryDelay = 5000) {
    let lastError = null;
    let actionCommand = '';
    
    // 获取实际执行的操作以便在日志中显示
    switch (action) {
      case 'powerOn':
        actionCommand = this.device.httpUrls?.powerOn || '/api/power/on';
        break;
      case 'powerOff':
        actionCommand = this.device.httpUrls?.powerOff || '/api/power/off';
        break;
      case 'status':
        actionCommand = this.device.httpUrls?.status || '/api/status';
        break;
      default:
        actionCommand = action;
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let result;
        switch (action) {
          case 'powerOn':
            result = await this.powerOn(attempt > 1 ? attempt - 1 : 0);
            break;
          case 'powerOff':
            result = await this.powerOff(attempt > 1 ? attempt - 1 : 0);
            break;
          case 'status':
            result = await this.getStatus(attempt > 1 ? attempt - 1 : 0);
            break;
          default:
            throw new Error('Invalid action');
        }
        
        if (result.success) {
          // 成功日志已在各个方法中输出
          return { ...result, attempts: attempt };
        } else {
          lastError = new Error(result.error);
          console.log(`[${this.device.ip}] HTTP操作失败，准备重试`);
        }
      } catch (error) {
        lastError = error;
        console.log(`[${this.device.ip}] HTTP操作异常: ${error.message}`);
      }
      
      // 如果不是最后一次尝试，等待重试间隔
      if (attempt < maxRetries) {
        console.log(`[${this.device.ip}] 等待 ${retryDelay}ms 后进行第${attempt + 1}次重试...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    // 所有重试都失败了
    console.log(`[${this.device.ip}] 所有重试均失败`);
    return { 
      success: false, 
      error: lastError?.message || '重试次数已用完', 
      attempts: maxRetries 
    };
  }
}

// Device helper functions
function getDeviceById(deviceId) {
  const devices = dataManager.get('devices');
  return devices.find(d => d.id === deviceId);
}

// 数据迁移函数：从旧位置迁移数据到userData目录
async function migrateOldDataIfNeeded() {
  const fs = require('fs').promises;
  const path = require('path');
  
  const oldDataDir = join(__dirname, '..');
  const newDataDir = app.getPath('userData');
  
  console.log('检查数据迁移...');
  console.log('旧数据目录:', oldDataDir);
  console.log('新数据目录:', newDataDir);
  
  const filesToMigrate = ['devices.json', 'device-groups.json', 'custom-rooms.json', 'operation-logs.json'];
  
  for (const fileName of filesToMigrate) {
    const oldFilePath = join(oldDataDir, fileName);
    const newFilePath = join(newDataDir, fileName);
    
    try {
      // 检查旧文件是否存在
      await fs.access(oldFilePath);
      
      // 检查新文件是否已存在
      try {
        await fs.access(newFilePath);
        console.log(`${fileName} 已存在于新位置，跳过迁移`);
        continue;
      } catch (error) {
        // 新文件不存在，执行迁移
      }
      
      // 确保新目录存在
      await fs.mkdir(newDataDir, { recursive: true });
      
      // 复制文件
      await fs.copyFile(oldFilePath, newFilePath);
      console.log(`迁移文件: ${fileName} -> userData目录`);
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`迁移 ${fileName} 时出错:`, error.message);
      }
    }
  }
  
  console.log('数据迁移检查完成');
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
    } else if (device.type === 'pc') {
      controller = new PCController(device);
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
    
    // 确保返回可序列化的数据
    const safeResult = {
      success: Boolean(result.success),
      error: result.error ? String(result.error) : null,
      response: null,
      status: result.status ? Number(result.status) : null,
      responseTime: result.responseTime ? Number(result.responseTime) : null
    };

    // 安全处理response字段
    if (result.response) {
      try {
        if (typeof result.response === 'string') {
          safeResult.response = result.response;
        } else if (typeof result.response === 'object') {
          safeResult.response = JSON.parse(JSON.stringify(result.response));
        } else {
          safeResult.response = String(result.response);
        }
      } catch (serializeError) {
        console.warn(`Failed to serialize response for device ${device.name}:`, serializeError);
        safeResult.response = '[Response not serializable]';
      }
    }

    return safeResult;
  } catch (error) {
    console.error('Device control error:', error);
    return { 
      success: false, 
      error: String(error.message),
      response: null,
      status: null,
      responseTime: null
    };
  }
});

ipcMain.handle('batch-device-control', async (event, deviceIds, action) => {
  // 获取所有设备的IP地址用于日志
  const devices = deviceIds.map(id => getDeviceById(id)).filter(d => d);
  const ips = devices.map(d => d.ip);
  
  console.log(`开始批量${action}操作，共${ips.length}个设备...`);
  console.log(`目标设备列表:`);
  devices.forEach((device, index) => {
    console.log(`  ${index + 1}. [${device.ip}] ${device.name} (${device.type.toUpperCase()})`);
  });
  console.log('');
  
  // 确保deviceIds是纯净的数组
  let cleanDeviceIds;
  try {
    cleanDeviceIds = Array.isArray(deviceIds) ? deviceIds.map(id => String(id)) : [];
  } catch (error) {
    console.error('处理设备ID数组时出错:', error);
    return {
      success: false,
      error: '设备ID数组处理失败',
      results: [],
      summary: { successful: 0, failed: 0, total: 0, totalAttempts: 0, maxAttempts: 0 }
    };
  }
  
  // 配置重试参数
  const retryConfig = {
    maxRetries: 10,
    retryDelay: 5000,
    deviceDelay: 500 // 设备之间的间隔
  };

  const promises = cleanDeviceIds.map(async (deviceId, index) => {
    try {
      // 设备之间添加小间隔，避免网络拥塞
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, retryConfig.deviceDelay));
      }

      const device = getDeviceById(deviceId);
      if (!device) {
        return { 
          deviceId: String(deviceId),
          deviceName: 'Unknown', 
          success: false, 
          error: 'Device not found',
          attempts: 0
        };
      }

      let controller;
      
      if (device.type === 'tcp') {
        controller = new TCPDeviceController(device);
      } else if (device.type === 'http') {
        controller = new HTTPDeviceController(device);
      } else if (device.type === 'pc') {
        controller = new PCController(device);
      } else {
        return { 
          deviceId: String(deviceId),
          deviceName: String(device.name), 
          success: false, 
          error: `Unsupported device type: ${device.type}`,
          attempts: 0
        };
      }
      
      // 使用带重试机制的方法
      let result;
      if (action === 'powerOn' || action === 'powerOff') {
        // 对于开机关机操作，使用重试机制
        result = await controller.powerControlWithRetry(action, retryConfig.maxRetries, retryConfig.retryDelay);
      } else {
        // 对于状态查询，使用普通方法（不需要重试太多次）
        switch (action) {
          case 'status':
            result = await controller.powerControlWithRetry(action, 3, 2000); // 状态查询只重试3次
            break;
          default:
            result = { success: false, error: 'Invalid action', attempts: 0 };
        }
      }
      
      // Cleanup for TCP connections (PC devices don't need disconnect)
      if (device.type === 'tcp' && controller.disconnect) {
        controller.disconnect();
      }
      
      // 创建一个完全可序列化的对象，避免任何克隆错误
      const safeResult = {
        deviceId: String(deviceId),
        deviceName: String(device.name || 'Unknown'),
        success: Boolean(result.success),
        error: result.error ? String(result.error) : null,
        response: null,
        status: result.status ? Number(result.status) : null,
        responseTime: result.responseTime ? Number(result.responseTime) : null,
        attempts: result.attempts ? Number(result.attempts) : 0
      };

      // 安全处理response字段，确保可序列化
      if (result.response) {
        try {
          if (typeof result.response === 'string') {
            safeResult.response = result.response;
          } else if (typeof result.response === 'object') {
            // 使用JSON.parse(JSON.stringify())确保完全可序列化
            safeResult.response = JSON.parse(JSON.stringify(result.response));
          } else {
            safeResult.response = String(result.response);
          }
        } catch (serializeError) {
          console.warn(`Failed to serialize response for device ${device.name}:`, serializeError);
          safeResult.response = '[Response not serializable]';
        }
      }

      return safeResult;
    } catch (error) {
      const device = getDeviceById(deviceId);
      console.error(`批量操作设备 ${device?.name} 异常:`, error);
      return { 
        deviceId: String(deviceId),
        deviceName: String(device?.name || 'Unknown'),
        success: false,
        error: String(error.message),
        response: null,
        status: null,
        responseTime: null,
        attempts: 0
      };
    }
  });
  
  try {
    console.log('等待所有设备操作完成...');
    const results = await Promise.all(promises);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    // 统计重试信息
    const totalAttempts = results.reduce((sum, r) => sum + (r.attempts || 0), 0);
    const maxAttempts = Math.max(...results.map(r => r.attempts || 0));
    
    // 输出类似projector_control.js的执行结果
    console.log('\n===== 批量操作执行结果 =====');
    
    // 显示需要重试的设备信息
    const needRetryDevices = results.filter(r => (r.attempts || 0) > 1);
    if (needRetryDevices.length > 0) {
      console.log(`\n需要重试的设备 (${needRetryDevices.length}个):`);
      needRetryDevices.forEach(result => {
        const device = getDeviceById(result.deviceId);
        console.log(`- ${device?.ip || result.deviceId} (${device?.name || 'Unknown'}) - 重试${result.attempts - 1}次${result.success ? '后成功' : '仍失败'}`);
      });
    }
    
    console.log(`\n成功设备 (${successful}个):`);
    results.filter(r => r.success).forEach(result => {
      const device = getDeviceById(result.deviceId);
      console.log(`- ${device?.ip || result.deviceId} (${device?.name || 'Unknown'}) - 尝试${result.attempts}次`);
    });
    
    if (failed > 0) {
      console.log(`\n失败设备 (${failed}个):`);
      results.filter(r => !r.success).forEach(result => {
        const device = getDeviceById(result.deviceId);
        console.log(`- ${device?.ip || result.deviceId} (${device?.name || 'Unknown'}) - ${result.error}`);
      });
    }
    
    console.log(`\n批量操作统计:`);
    console.log(`- 总设备数: ${results.length}`);
    console.log(`- 成功设备: ${successful}`);
    console.log(`- 失败设备: ${failed}`);
    console.log(`- 总重试次数: ${totalAttempts}`);
    console.log(`- 最大重试次数: ${maxAttempts}`);
    console.log('\n所有操作完成');
    
    // 确保返回的对象完全可序列化
    return {
      success: true,
      results: results,
      summary: { 
        successful: Number(successful), 
        failed: Number(failed), 
        total: Number(results.length),
        totalAttempts: Number(totalAttempts),
        maxAttempts: Number(maxAttempts)
      }
    };
  } catch (error) {
    console.error('批量设备控制错误:', error);
    return {
      success: false,
      error: String(error.message),
      results: [],
      summary: { successful: 0, failed: 0, total: 0, totalAttempts: 0, maxAttempts: 0 }
    };
  }
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

// Auto-updater IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-for-updates', async () => {
  if (isDev) {
    return { success: false, error: 'Updates not available in development mode' };
  }
  
  try {
    // update-electron-app 会自动检查更新，这里只是返回当前状态
    return { success: true, message: 'Update check initiated' };
  } catch (error) {
    log.error('Manual update check failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-update-status', () => {
  return {
    isDev,
    version: app.getVersion(),
    autoUpdaterEnabled: !isDev
  };
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
    icon: join(__dirname, '../app.png'), // 光子运动主题图标
    title: '光子运动 - 投影设备管理器'
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Renderer process loaded');
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('Renderer process crashed');
  });

  // Load app
  if (isDev) {
    console.log('Loading development server at http://127.0.0.1:5174');
    mainWindow.loadURL('http://127.0.0.1:5174');
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
    // 数据迁移：从项目目录迁移到userData目录
    await migrateOldDataIfNeeded();
    
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