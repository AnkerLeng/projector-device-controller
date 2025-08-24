#!/usr/bin/env node

/**
 * 快速测试自动更新功能
 * 本地模拟更新服务器进行测试
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const http = require('http');

console.log('🧪 快速自动更新测试');
console.log('===================\n');

// 检查当前状态
const packagePath = path.join(__dirname, '..', 'package.json');
const package = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

console.log('📊 当前状态:');
console.log(`   版本: ${package.version}`);
console.log(`   应用名: ${package.name}`);
console.log('');

// 步骤1: 构建当前版本
console.log('📦 步骤1: 构建当前版本...');
try {
    console.log('   构建前端...');
    execSync('npm run build', { stdio: 'pipe' });
    
    console.log('   构建Electron应用...');
    execSync('npx electron-builder --dir', { stdio: 'pipe' });
    
    console.log('✅ 构建完成');
    console.log(`📁 安装包位置: dist-electron/win-unpacked/`);
} catch (error) {
    console.error('❌ 构建失败:', error.message);
    process.exit(1);
}

// 步骤2: 创建模拟更新服务器
console.log('\n🌐 步骤2: 创建模拟更新服务器...');

const mockReleaseData = {
    tag_name: `v${increaseVersion(package.version)}`,
    name: `Release ${increaseVersion(package.version)}`,
    body: '🧪 这是一个用于测试自动更新功能的模拟版本\\n\\n✨ 新功能:\\n- 测试自动更新机制\\n- 验证下载和安装流程',
    assets: [
        {
            name: `${package.name}-${increaseVersion(package.version)}.exe`,
            browser_download_url: 'http://localhost:3001/mock-download',
            size: 25000000
        }
    ]
};

const server = http.createServer((req, res) => {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.url === '/latest') {
        // 模拟GitHub API返回最新版本信息
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockReleaseData));
    } else if (req.url === '/mock-download') {
        // 模拟下载文件
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.end('Mock installer file content');
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(3001, () => {
    console.log('✅ 模拟更新服务器启动: http://localhost:3001');
    console.log(`   模拟版本: ${mockReleaseData.tag_name}`);
});

// 步骤3: 创建测试配置
console.log('\n⚙️ 步骤3: 创建测试配置...');

const testConfigPath = path.join(__dirname, '..', 'src-electron', 'test-update-config.js');
const testConfig = `// 测试配置 - 覆盖更新服务器地址
module.exports = {
    updateServer: 'http://localhost:3001',
    checkInterval: '10 seconds', // 快速测试间隔
    mockVersion: '${increaseVersion(package.version)}'
};`;

fs.writeFileSync(testConfigPath, testConfig);
console.log('✅ 测试配置已创建');

// 步骤4: 修改主进程以支持测试模式
console.log('\n🔧 步骤4: 配置测试模式...');
console.log('   注意: 这将临时修改主进程文件以支持本地测试');

// 显示测试说明
console.log('\n📋 测试说明:');
console.log('==========');
console.log('1. 运行构建后的应用:');
console.log('   cd dist-electron/win-unpacked/');
console.log('   ".\\光子运动 - 投影设备管理器.exe"');
console.log('');
console.log('2. 在应用中观察更新行为:');
console.log('   - 点击右下角版本按钮');
console.log('   - 点击"检查更新"');
console.log('   - 观察模拟更新过程');
console.log('');
console.log('3. 预期行为:');
console.log(`   - 检测到新版本: ${mockReleaseData.tag_name}`);
console.log('   - 显示更新通知');
console.log('   - 模拟下载过程');
console.log('');
console.log('🔍 调试提示:');
console.log('   - 打开开发者工具查看Console日志');
console.log('   - 检查网络请求到 http://localhost:3001');
console.log('   - 模拟服务器会在控制台显示请求');

// 监听服务器请求
server.on('request', (req, res) => {
    console.log(`📡 收到请求: ${req.method} ${req.url}`);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\\n\\n🛑 关闭测试服务器...');
    
    // 清理测试配置文件
    if (fs.existsSync(testConfigPath)) {
        fs.unlinkSync(testConfigPath);
        console.log('✅ 测试配置已清理');
    }
    
    server.close(() => {
        console.log('✅ 服务器已关闭');
        console.log('🎉 测试完成!');
        process.exit(0);
    });
});

console.log('\\n⚡ 模拟服务器运行中...');
console.log('   按 Ctrl+C 停止测试');

// 辅助函数：增加版本号
function increaseVersion(version) {
    const parts = version.split('.');
    parts[2] = String(parseInt(parts[2]) + 1);
    return parts.join('.');
}