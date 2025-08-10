// Simple Electron starter script
const { spawn } = require('child_process');
const path = require('path');

// Start Vite dev server
console.log('Starting Vite development server...');
const vite = spawn('npx', ['vite'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname
});

// Wait a bit for Vite to start, then launch Electron
setTimeout(() => {
  console.log('Starting Electron...');
  const electron = spawn('npx', ['electron', 'src-electron/main.js'], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: 'development' }
  });

  electron.on('close', (code) => {
    console.log(`Electron exited with code ${code}`);
    vite.kill();
    process.exit(code);
  });
}, 3000);

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  vite.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  vite.kill();
  process.exit(0);
});