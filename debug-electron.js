console.log('Starting Electron debug script...');

const { app, BrowserWindow } = require('electron');
const { join } = require('path');

console.log('Electron modules loaded');

let mainWindow;

function createWindow() {
  console.log('Creating main window...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'src-electron/preload.js')
    },
    title: 'Projector Manager (Debug)'
  });

  console.log('Window object created, loading URL...');

  // Load the Vite dev server
  mainWindow.loadURL('http://localhost:5173').then(() => {
    console.log('URL loaded successfully');
    mainWindow.webContents.openDevTools();
  }).catch((error) => {
    console.error('Failed to load URL:', error);
  });

  mainWindow.on('closed', () => {
    console.log('Window closed');
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  console.log('App is ready, creating window...');
  createWindow();
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') {
    console.log('Quitting app');
    app.quit();
  }
});

app.on('activate', () => {
  console.log('App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

console.log('Event listeners set up');