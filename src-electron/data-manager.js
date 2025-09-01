const { promises: fs } = require('fs');
const { join } = require('path');
const path = require('path');
const { app } = require('electron');

class DataManager {
  constructor() {
    this.locks = new Map();
    
    // 使用userData目录统一存储数据，确保开发和生产环境一致
    this.dataDir = app.getPath('userData');
    
    this.files = {
      devices: join(this.dataDir, 'devices.json'),
      deviceGroups: join(this.dataDir, 'device-groups.json'),
      customRooms: join(this.dataDir, 'custom-rooms.json'),
      operationLogs: join(this.dataDir, 'operation-logs.json')
    };
    
    this.cache = {
      devices: [],
      deviceGroups: [],
      customRooms: [],
      operationLogs: []
    };
    
    // 确保数据目录存在
    this.ensureDataDir();
  }

  // 确保数据目录存在
  async ensureDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      console.log('数据目录已确保存在:', this.dataDir);
    } catch (error) {
      console.error('创建数据目录失败:', error);
    }
  }

  // 获取文件锁
  async acquireLock(key) {
    while (this.locks.has(key)) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.locks.set(key, true);
  }

  // 释放文件锁
  releaseLock(key) {
    this.locks.delete(key);
  }

  // 原子写入文件
  async atomicWrite(filePath, data) {
    const tempPath = filePath + '.tmp';
    const backupPath = filePath + '.backup';
    
    try {
      // 确保目录存在
      await this.ensureDataDir();
      
      // 如果原文件存在，创建备份
      try {
        await fs.access(filePath);
        await fs.copyFile(filePath, backupPath);
      } catch (error) {
        // 原文件不存在，继续
      }
      
      // 写入临时文件
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
      
      // 原子性重命名
      await fs.rename(tempPath, filePath);
      
      // 删除备份文件
      try {
        await fs.unlink(backupPath);
      } catch (error) {
        // 忽略删除备份文件的错误
      }
      
    } catch (error) {
      // 清理临时文件
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // 忽略清理错误
      }
      
      // 如果有备份，尝试恢复
      try {
        await fs.access(backupPath);
        await fs.rename(backupPath, filePath);
      } catch (restoreError) {
        // 忽略恢复错误
      }
      
      throw error;
    }
  }

  // 加载数据
  async load(key) {
    const filePath = this.files[key];
    if (!filePath) throw new Error(`Unknown data key: ${key}`);
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      this.cache[key] = JSON.parse(data);
      return this.cache[key];
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 文件不存在，返回空数组
        this.cache[key] = [];
        return this.cache[key];
      }
      throw error;
    }
  }

  // 保存数据
  async save(key, data) {
    const filePath = this.files[key];
    if (!filePath) throw new Error(`Unknown data key: ${key}`);
    
    await this.acquireLock(key);
    
    try {
      await this.atomicWrite(filePath, data);
      this.cache[key] = data;
      
      // 记录操作日志
      await this.logOperation({
        timestamp: new Date().toISOString(),
        operation: 'save',
        dataType: key,
        recordCount: Array.isArray(data) ? data.length : 1
      });
      
    } finally {
      this.releaseLock(key);
    }
  }

  // 获取缓存数据
  get(key) {
    return this.cache[key] || [];
  }

  // 记录操作日志
  async logOperation(logEntry) {
    try {
      const logs = await this.load('operationLogs');
      
      // 只保留最近1000条日志
      const maxLogs = 1000;
      if (logs.length >= maxLogs) {
        logs.splice(0, logs.length - maxLogs + 1);
      }
      
      logs.push(logEntry);
      await this.atomicWrite(this.files.operationLogs, logs);
      
    } catch (error) {
      console.warn('Failed to write operation log:', error);
      // 日志写入失败不应该影响主操作
    }
  }

  // 数据验证
  validateDeviceData(device) {
    console.log('DataManager: 开始验证设备数据:', device);
    
    const required = ['name', 'ip', 'type'];
    const missing = required.filter(field => !device[field]);
    
    if (missing.length > 0) {
      console.log('DataManager: 缺少必填字段:', missing);
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    
    // IP地址格式验证
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(device.ip)) {
      console.log('DataManager: IP地址格式无效:', device.ip);
      throw new Error('Invalid IP address format');
    }
    
    // 协议类型验证
    if (!['tcp', 'http', 'pc'].includes(device.type)) {
      console.log('DataManager: 不支持的设备类型:', device.type);
      throw new Error('Invalid device type, must be tcp, http, or pc');
    }
    
    // PC设备特殊验证
    if (device.type === 'pc') {
      console.log('DataManager: 验证PC设备配置:', device.pcConfig);
      if (device.pcConfig && device.pcConfig.macAddress) {
        console.log('DataManager: PC设备包含MAC地址:', device.pcConfig.macAddress);
      } else {
        console.log('DataManager: PC设备缺少MAC地址配置');
      }
    }
    
    console.log('DataManager: 设备数据验证通过');
    return true;
  }

  // 增强的设备操作
  async saveDevice(device, forceAsNew = false) {
    console.log('DataManager: Attempting to save device:', device);
    console.log('DataManager: Device type:', device.type);
    
    if (device.type === 'pc') {
      console.log('DataManager: 保存PC设备，pcConfig内容:', JSON.stringify(device.pcConfig, null, 2));
    }
    
    this.validateDeviceData(device);
    
    const devices = this.get('devices');
    console.log('DataManager: Current devices count:', devices.length);
    
    if (device.type === 'pc') {
      const existingPCDevices = devices.filter(d => d.type === 'pc');
      console.log('DataManager: 当前PC设备数量:', existingPCDevices.length);
    }
    
    if (device.id && !forceAsNew) {
      // 更新现有设备
      const index = devices.findIndex(d => d.id === device.id);
      if (index !== -1) {
        const existingDevice = devices[index];
        
        // 只更新提供的字段，保留未提供字段的原有值
        const updatedDevice = { ...existingDevice };
        
        // 更新基础字段（确保这些字段被正确更新）
        const fieldsToUpdate = ['name', 'ip', 'port', 'type', 'room'];
        fieldsToUpdate.forEach(field => {
          if (device.hasOwnProperty(field) && device[field] !== undefined && device[field] !== null) {
            updatedDevice[field] = device[field];
          }
        });
        
        // 更新协议相关配置
        if (device.tcpCommands) {
          updatedDevice.tcpCommands = { ...device.tcpCommands };
        }
        if (device.httpUrls) {
          updatedDevice.httpUrls = { ...device.httpUrls };
        }
        if (device.httpAuth) {
          updatedDevice.httpAuth = { ...device.httpAuth };
        }
        if (device.pcConfig) {
          updatedDevice.pcConfig = { ...device.pcConfig };
        }
        
        // 如果协议类型变化，清理不相关的配置
        if (device.type) {
          if (device.type === 'tcp') {
            delete updatedDevice.httpUrls;
            delete updatedDevice.httpAuth;
            delete updatedDevice.pcConfig;
          } else if (device.type === 'http') {
            delete updatedDevice.tcpCommands;
            delete updatedDevice.pcConfig;
          } else if (device.type === 'pc') {
            delete updatedDevice.tcpCommands;
            delete updatedDevice.httpUrls;
            delete updatedDevice.httpAuth;
          }
        }
        
        // 更新时间戳
        updatedDevice.updatedAt = new Date().toISOString();
        
        devices[index] = updatedDevice;
        device = updatedDevice; // 返回完整的设备对象
      } else {
        // 设备ID不存在，作为新设备处理（用于导入场景）
        device.createdAt = device.createdAt || new Date().toISOString();
        device.updatedAt = new Date().toISOString();
        devices.push(device);
      }
    } else {
      // 添加新设备
      if (!device.id || forceAsNew) {
        device.id = Date.now().toString();
      }
      device.createdAt = device.createdAt || new Date().toISOString();
      device.updatedAt = new Date().toISOString();
      devices.push(device);
    }
    
    await this.save('devices', devices);
    console.log('DataManager: Device saved successfully:', device);
    console.log('DataManager: File path:', this.files.devices);
    
    // PC设备保存后验证
    if (device.type === 'pc') {
      const updatedDevices = this.get('devices');
      const savedPCDevice = updatedDevices.find(d => d.id === device.id);
      if (savedPCDevice) {
        console.log('DataManager: PC设备保存验证成功，MAC地址:', savedPCDevice.pcConfig?.macAddress);
      } else {
        console.log('DataManager: 警告：PC设备保存后在缓存中未找到！');
      }
      
      const pcDevicesCount = updatedDevices.filter(d => d.type === 'pc').length;
      console.log('DataManager: 保存后PC设备总数:', pcDevicesCount);
    }
    
    return device;
  }

  // 删除设备
  async deleteDevice(deviceId) {
    const devices = this.get('devices');
    const initialLength = devices.length;
    const filteredDevices = devices.filter(d => d.id !== deviceId);
    
    if (filteredDevices.length === initialLength) {
      throw new Error('Device not found for deletion');
    }
    
    await this.save('devices', filteredDevices);
    return true;
  }

  // 获取统计信息
  getStats() {
    const devices = this.get('devices');
    const deviceGroups = this.get('deviceGroups');
    const customRooms = this.get('customRooms');
    
    const stats = {
      totalDevices: devices.length,
      devicesByType: {
        tcp: devices.filter(d => d.type === 'tcp').length,
        http: devices.filter(d => d.type === 'http').length,
        pc: devices.filter(d => d.type === 'pc').length
      },
      devicesByRoom: {},
      totalGroups: deviceGroups.length,
      totalRooms: customRooms.length
    };
    
    // 按房间统计设备
    devices.forEach(device => {
      const room = device.room || '未分类';
      stats.devicesByRoom[room] = (stats.devicesByRoom[room] || 0) + 1;
    });
    
    return stats;
  }

  // 数据导出
  async exportData() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      devices: this.get('devices'),
      deviceGroups: this.get('deviceGroups'),
      customRooms: this.get('customRooms'),
      stats: this.getStats()
    };
    
    return exportData;
  }

  // 数据导入（带验证）
  async importData(importData) {
    // 验证导入数据格式
    if (!importData.devices || !Array.isArray(importData.devices)) {
      throw new Error('Invalid import data: devices array is required');
    }
    
    // 验证每个设备数据
    for (const device of importData.devices) {
      this.validateDeviceData(device);
    }
    
    // 执行导入
    const results = {
      devices: { imported: 0, updated: 0, skipped: 0, errors: [] },
      deviceGroups: { imported: 0, skipped: 0, errors: [] },
      customRooms: { imported: 0, skipped: 0, errors: [] }
    };
    
    const existingDevices = this.get('devices');
    
    // 导入设备
    for (const device of importData.devices) {
      try {
        // 检查是否存在相同IP的设备（避免重复）
        const existingByIp = existingDevices.find(d => d.ip === device.ip);
        
        if (existingByIp) {
          // 更新现有设备
          const updatedDevice = { ...device, id: existingByIp.id };
          await this.saveDevice(updatedDevice);
          results.devices.updated++;
        } else {
          // 导入为新设备，移除原ID避免冲突
          const newDevice = { ...device };
          delete newDevice.id;
          await this.saveDevice(newDevice);
          results.devices.imported++;
        }
      } catch (error) {
        results.devices.errors.push({ device: device.name || device.id, error: error.message });
        results.devices.skipped++;
      }
    }
    
    // 导入设备组
    if (importData.deviceGroups && Array.isArray(importData.deviceGroups)) {
      await this.save('deviceGroups', importData.deviceGroups);
      results.deviceGroups.imported = importData.deviceGroups.length;
    }
    
    // 导入自定义房间
    if (importData.customRooms && Array.isArray(importData.customRooms)) {
      await this.save('customRooms', importData.customRooms);
      results.customRooms.imported = importData.customRooms.length;
    }
    
    return results;
  }

  // 数据备份
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = join(this.dataDir, 'backups');
    
    // 确保备份目录存在
    try {
      await fs.mkdir(backupDir, { recursive: true });
    } catch (error) {
      // 目录已存在
    }
    
    const exportData = await this.exportData();
    const backupPath = join(backupDir, `backup-${timestamp}.json`);
    
    await fs.writeFile(backupPath, JSON.stringify(exportData, null, 2));
    
    // 清理旧备份（保留最近10个）
    const backupFiles = await fs.readdir(backupDir);
    const backupPattern = /^backup-.*\.json$/;
    const backups = backupFiles
      .filter(f => backupPattern.test(f))
      .sort()
      .reverse();
    
    if (backups.length > 10) {
      const toDelete = backups.slice(10);
      for (const file of toDelete) {
        try {
          await fs.unlink(join(backupDir, file));
        } catch (error) {
          console.warn(`Failed to delete old backup ${file}:`, error);
        }
      }
    }
    
    return backupPath;
  }
}

module.exports = DataManager;