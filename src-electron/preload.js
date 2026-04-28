const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Device management
  getDevices: () => ipcRenderer.invoke('get-devices'),
  saveDevice: (device) => ipcRenderer.invoke('save-device', device),
  deleteDevice: (deviceId) => ipcRenderer.invoke('delete-device', deviceId),
  
  // Device control
  deviceControl: (deviceId, action) => 
    ipcRenderer.invoke('device-power-control', deviceId, action),
  testDeviceConfig: (deviceConfig, action = 'status') =>
    ipcRenderer.invoke('test-device-config', deviceConfig, action),
  
  // Batch operations
  batchDeviceControl: (deviceIds, action) =>
    ipcRenderer.invoke('batch-device-control', deviceIds, action),
  
  // Batch operations with progress
  batchDeviceControlWithProgress: (deviceIds, action, operationId) =>
    ipcRenderer.invoke('batch-device-control-with-progress', deviceIds, action, operationId),
  
  // Cancel batch operation
  cancelBatchOperation: (operationId) =>
    ipcRenderer.invoke('cancel-batch-operation', operationId),

  // Device Groups management
  getDeviceGroups: () => ipcRenderer.invoke('get-device-groups'),
  saveDeviceGroups: (groups) => ipcRenderer.invoke('save-device-groups', groups),

  // Custom Rooms management
  getCustomRooms: () => ipcRenderer.invoke('get-custom-rooms'),
  saveCustomRooms: (rooms) => ipcRenderer.invoke('save-custom-rooms', rooms),

  // Test TCP command
  testTcpCommand: (deviceConfig, command) =>
    ipcRenderer.invoke('test-tcp-command', deviceConfig, command),

  // 数据管理和统计
  getStats: () => ipcRenderer.invoke('get-stats'),
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: (data) => ipcRenderer.invoke('import-data', data),
  createBackup: () => ipcRenderer.invoke('create-backup'),

  // Auto-updater
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  restartAndInstallUpdate: () => ipcRenderer.invoke('restart-and-install-update'),
  
  // 监听更新事件
  onUpdateDownloaded: (callback) => {
    const listener = (_event, info) => callback(info);
    ipcRenderer.on('update-downloaded', listener);
    return () => ipcRenderer.removeListener('update-downloaded', listener);
  },
  onUpdateAvailable: (callback) => {
    const listener = (_event, info) => callback(info);
    ipcRenderer.on('update-available', listener);
    return () => ipcRenderer.removeListener('update-available', listener);
  },
  onUpdateNotAvailable: (callback) => {
    const listener = (_event, info) => callback(info);
    ipcRenderer.on('update-not-available', listener);
    return () => ipcRenderer.removeListener('update-not-available', listener);
  },
  
  // 监听批量操作进度事件
  onBatchProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('batch-progress', listener);
    return () => ipcRenderer.removeListener('batch-progress', listener);
  }
});
