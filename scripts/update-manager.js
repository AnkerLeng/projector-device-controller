#!/usr/bin/env node

/**
 * 自动更新管理脚本
 * 用于检查、发布和测试应用更新
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packagePath = path.join(__dirname, '..', 'package.json');
const package = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

console.log('🚀 投影设备管理器 - 更新管理工具\n');

// 显示当前状态
function showStatus() {
    console.log('📊 当前状态:');
    console.log(`   版本: ${package.version}`);
    console.log(`   应用名: ${package.name}`);
    console.log(`   仓库: ${package.repository?.url || '未配置'}`);
    console.log(`   发布配置: ${package.build?.publish ? '已配置' : '未配置'}\n`);
}

// 检查配置
function checkConfig() {
    console.log('🔍 检查配置:');
    
    const issues = [];
    
    if (!package.repository?.url) {
        issues.push('❌ 未配置 repository.url');
    } else {
        console.log('✅ 仓库URL已配置');
    }
    
    if (!package.build?.publish) {
        issues.push('❌ 未配置 build.publish');
    } else {
        console.log('✅ 发布配置已设置');
    }
    
    if (!process.env.GITHUB_TOKEN) {
        issues.push('⚠️  未设置 GITHUB_TOKEN 环境变量');
    } else {
        console.log('✅ GITHUB_TOKEN 已设置');
    }
    
    if (issues.length > 0) {
        console.log('\n❗ 发现问题:');
        issues.forEach(issue => console.log(`   ${issue}`));
        console.log('\n📖 参考 AUTO_UPDATE_README.md 获取配置帮助\n');
    } else {
        console.log('\n✅ 配置检查通过!\n');
    }
    
    return issues.length === 0;
}

// 更新版本
function updateVersion(type = 'patch') {
    console.log(`📝 更新版本 (${type}):`);
    
    try {
        const oldVersion = package.version;
        execSync(`npm version ${type}`, { stdio: 'inherit' });
        
        // 重新读取更新后的版本
        const updatedPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        console.log(`   ${oldVersion} → ${updatedPackage.version}\n`);
        
        return updatedPackage.version;
    } catch (error) {
        console.error('❌ 版本更新失败:', error.message);
        return null;
    }
}

// 构建应用
function buildApp() {
    console.log('🔨 构建应用:');
    
    try {
        execSync('npm run build', { stdio: 'inherit' });
        console.log('✅ 前端构建完成\n');
        return true;
    } catch (error) {
        console.error('❌ 构建失败:', error.message);
        return false;
    }
}

// 打包Electron应用
function packElectron(publish = false) {
    console.log(`📦 打包Electron应用 ${publish ? '(发布模式)' : '(本地模式)'}:`);
    
    try {
        const command = publish ? 'npm run release' : 'npm run electron:build';
        execSync(command, { stdio: 'inherit' });
        console.log(`✅ 打包完成\n`);
        return true;
    } catch (error) {
        console.error('❌ 打包失败:', error.message);
        return false;
    }
}

// 测试更新功能
function testUpdate() {
    console.log('🧪 测试更新功能:');
    console.log('启动测试窗口...\n');
    
    try {
        execSync('node test-update.js', { stdio: 'inherit' });
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    }
}

// 创建发布
function createRelease(version) {
    if (!checkConfig()) {
        console.log('❌ 配置检查未通过，无法发布');
        return false;
    }
    
    console.log('🚀 创建发布:');
    
    // 构建
    if (!buildApp()) return false;
    
    // 打包并发布
    if (!packElectron(true)) return false;
    
    console.log('✅ 发布完成!');
    console.log(`🎉 版本 ${version} 已发布到 GitHub Releases`);
    console.log('📱 用户将在1小时内收到更新通知\n');
    
    return true;
}

// 显示帮助
function showHelp() {
    console.log('📖 使用说明:');
    console.log('');
    console.log('   node scripts/update-manager.js [命令]');
    console.log('');
    console.log('📋 可用命令:');
    console.log('   status      - 显示当前状态');
    console.log('   check       - 检查配置');
    console.log('   patch       - 发布补丁版本 (1.0.0 → 1.0.1)');
    console.log('   minor       - 发布功能版本 (1.0.0 → 1.1.0)');
    console.log('   major       - 发布主版本 (1.0.0 → 2.0.0)');
    console.log('   build       - 仅构建不发布');
    console.log('   test        - 测试更新功能');
    console.log('   help        - 显示帮助');
    console.log('');
    console.log('💡 示例:');
    console.log('   node scripts/update-manager.js patch   # 发布补丁更新');
    console.log('   node scripts/update-manager.js check   # 检查配置');
    console.log('   node scripts/update-manager.js test    # 测试更新');
    console.log('');
}

// 主程序
function main() {
    const command = process.argv[2] || 'help';
    
    switch (command) {
        case 'status':
            showStatus();
            break;
            
        case 'check':
            showStatus();
            checkConfig();
            break;
            
        case 'patch':
        case 'minor':
        case 'major':
            showStatus();
            const newVersion = updateVersion(command);
            if (newVersion) {
                createRelease(newVersion);
            }
            break;
            
        case 'build':
            showStatus();
            buildApp();
            packElectron(false);
            break;
            
        case 'test':
            testUpdate();
            break;
            
        case 'help':
        default:
            showHelp();
            break;
    }
}

// 确保scripts目录存在
const scriptsDir = path.dirname(__filename);
if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
}

main();