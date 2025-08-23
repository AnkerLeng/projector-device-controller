const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Device management
  getDevices: () => ipcRenderer.invoke('get-devices'),
  saveDevice: (device) => ipcRenderer.invoke('save-device', device),
  deleteDevice: (deviceId) => ipcRenderer.invoke('delete-device', deviceId),
  
  // Device control
  deviceControl: (deviceId, action) => 
    ipcRenderer.invoke('device-power-control', deviceId, action),
  
  // Batch operations
  batchDeviceControl: (deviceIds, action) =>
    ipcRenderer.invoke('batch-device-control', deviceIds, action),

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
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status')
});