const { app, BrowserWindow } = require('electron');

// Keep a global reference of the window object
let win;

function createWindow() {
  // Create the browser window
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Don't show until ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the app
  win.loadURL('http://localhost:5173');

  // Show window when ready
  win.once('ready-to-show', () => {
    console.log('Window is ready to show');
    win.show();
    win.webContents.openDevTools();
  });

  // Handle window closed
  win.on('closed', () => {
    win = null;
  });
}

// This method will be called when Electron has finished initialization
app.on('ready', createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (win === null) {
    createWindow();
  }
});

console.log('Electron app script loaded successfully');