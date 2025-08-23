// 测试自动更新功能的脚本
const { app, BrowserWindow } = require('electron');
const { updateElectronApp } = require('update-electron-app');
const log = require('electron-log');

// 配置日志输出到文件和控制台
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

console.log('🚀 测试自动更新功能');
console.log('📦 当前版本:', app.getVersion());
console.log('🏢 应用名称:', app.getName());
console.log('🔧 开发模式:', !app.isPackaged);

// 模拟自动更新初始化（仅在生产环境）
if (app.isPackaged) {
    try {
        updateElectronApp({
            updateInterval: '1 minute', // 测试时使用1分钟
            logger: log,
            notifyUser: true
        });
        console.log('✅ 自动更新已初始化');
    } catch (error) {
        console.error('❌ 自动更新初始化失败:', error.message);
    }
} else {
    console.log('⚠️  开发模式 - 自动更新已禁用');
}

// 创建测试窗口
app.whenReady().then(() => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // 显示测试页面
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>自动更新测试</title>
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
                    max-width: 800px; margin: 50px auto; padding: 20px;
                    background: #f5f5f5;
                }
                .card { 
                    background: white; border-radius: 8px; padding: 20px; 
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px;
                }
                .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
                .success { background: #f6ffed; border-left: 3px solid #52c41a; }
                .warning { background: #fffbe6; border-left: 3px solid #faad14; }
                .info { background: #e6f7ff; border-left: 3px solid #1890ff; }
                button { 
                    background: #1890ff; color: white; border: none; 
                    padding: 8px 16px; border-radius: 4px; cursor: pointer;
                    margin-right: 10px; margin-top: 10px;
                }
                button:hover { background: #40a9ff; }
                code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🔄 自动更新功能测试</h1>
                <div class="status info">
                    <strong>当前版本:</strong> ${app.getVersion()}
                </div>
                <div class="status ${app.isPackaged ? 'success' : 'warning'}">
                    <strong>运行模式:</strong> ${app.isPackaged ? '生产环境 (自动更新已启用)' : '开发环境 (自动更新已禁用)'}
                </div>
            </div>

            <div class="card">
                <h2>📋 功能说明</h2>
                <ul>
                    <li><strong>自动检查:</strong> 应用启动时和每小时检查一次更新</li>
                    <li><strong>后台下载:</strong> 发现更新时自动在后台下载</li>
                    <li><strong>用户提示:</strong> 下载完成后提示用户重启应用</li>
                    <li><strong>无缝安装:</strong> 重启后自动安装新版本</li>
                </ul>
            </div>

            <div class="card">
                <h2>🧪 测试步骤</h2>
                <ol>
                    <li>当前运行在 <code>${app.isPackaged ? '生产' : '开发'}</code> 模式</li>
                    ${app.isPackaged ? `
                    <li>自动更新已启用，每1分钟检查一次（测试配置）</li>
                    <li>如有更新将自动下载并提示安装</li>
                    ` : `
                    <li>开发模式下自动更新已禁用</li>
                    <li>需要打包后的应用才能测试更新功能</li>
                    `}
                </ol>
            </div>

            <div class="card">
                <h2>🔨 如何发布更新</h2>
                <pre><code># 1. 更新版本号
npm version patch

# 2. 构建并发布到GitHub
npm run release

# 3. 用户将自动收到更新</code></pre>
            </div>

            ${!app.isPackaged ? `
            <div class="card">
                <h2>📦 打包测试</h2>
                <p>要测试自动更新功能，需要先打包应用：</p>
                <pre><code># 构建生产版本
npm run electron:build

# 或者构建未发布版本用于测试
npm run electron:pack</code></pre>
            </div>
            ` : ''}
        </body>
        </html>
    `));

    // 监听更新事件（如果是生产环境）
    if (app.isPackaged) {
        // 这些事件需要在实际的update-electron-app中监听
        console.log('🔍 监听更新事件...');
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});