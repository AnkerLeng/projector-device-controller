#!/usr/bin/env node

/**
 * GitHub仓库配置助手
 * 帮助配置GitHub仓库和自动更新设置
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const packagePath = path.join(__dirname, '..', 'package.json');

// 创建读取输入的接口
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// 异步询问函数
function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

// 检查是否安装了gh CLI
function checkGitHubCLI() {
    try {
        execSync('gh --version', { stdio: 'pipe' });
        return true;
    } catch (error) {
        return false;
    }
}

// 检查git配置
function checkGitConfig() {
    try {
        const name = execSync('git config user.name', { encoding: 'utf8' }).trim();
        const email = execSync('git config user.email', { encoding: 'utf8' }).trim();
        return { name, email };
    } catch (error) {
        return null;
    }
}

// 更新package.json
function updatePackageJson(repoOwner, repoName) {
    const package = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // 更新仓库信息
    package.repository = {
        type: 'git',
        url: `https://github.com/${repoOwner}/${repoName}.git`
    };
    
    // 更新发布配置
    package.build.publish = {
        provider: 'github',
        owner: repoOwner,
        repo: repoName
    };
    
    // 添加homepage
    package.homepage = `https://github.com/${repoOwner}/${repoName}#readme`;
    
    // 写回文件
    fs.writeFileSync(packagePath, JSON.stringify(package, null, 2));
    
    return package;
}

// 创建GitHub Actions工作流
function createGitHubActions(repoName) {
    const workflowDir = path.join(__dirname, '..', '.github', 'workflows');
    const workflowFile = path.join(workflowDir, 'release.yml');
    
    // 确保目录存在
    if (!fs.existsSync(workflowDir)) {
        fs.mkdirSync(workflowDir, { recursive: true });
    }
    
    const workflowContent = `name: Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  release:
    runs-on: \${{ matrix.os }}
    
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build and release
      env:
        GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
      run: |
        npm run build
        npx electron-builder --publish always
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      if: failure()
      with:
        name: build-artifacts-\${{ matrix.os }}
        path: dist-electron/
`;

    fs.writeFileSync(workflowFile, workflowContent);
    console.log('✅ GitHub Actions 工作流已创建: .github/workflows/release.yml');
}

// 主程序
async function main() {
    console.log('🚀 GitHub仓库配置助手');
    console.log('====================\n');
    
    // 检查git配置
    const gitConfig = checkGitConfig();
    if (!gitConfig) {
        console.log('❌ Git配置不完整，请先配置git:');
        console.log('   git config --global user.name "Your Name"');
        console.log('   git config --global user.email "your.email@example.com"');
        process.exit(1);
    }
    
    console.log(`📋 当前Git配置:`);
    console.log(`   用户名: ${gitConfig.name}`);
    console.log(`   邮箱: ${gitConfig.email}\n`);
    
    // 询问仓库信息
    console.log('📦 仓库配置:');
    const repoOwner = await askQuestion(`GitHub用户名/组织名 (${gitConfig.name}): `) || gitConfig.name;
    const defaultRepoName = 'projector-manager';
    const repoName = await askQuestion(`仓库名称 (${defaultRepoName}): `) || defaultRepoName;
    
    console.log(`\n将创建仓库: https://github.com/${repoOwner}/${repoName}\n`);
    
    // 询问是否使用GitHub CLI
    const hasGHCLI = checkGitHubCLI();
    let useGHCLI = false;
    
    if (hasGHCLI) {
        const answer = await askQuestion('检测到GitHub CLI，是否使用它创建仓库？ (y/n): ');
        useGHCLI = answer.toLowerCase().startsWith('y');
    }
    
    // 更新package.json
    console.log('📝 更新package.json...');
    updatePackageJson(repoOwner, repoName);
    console.log('✅ package.json已更新');
    
    // 创建GitHub Actions
    createGitHubActions(repoName);
    
    if (useGHCLI) {
        try {
            console.log('🔨 使用GitHub CLI创建仓库...');
            execSync(`gh repo create ${repoOwner}/${repoName} --public --description "投影设备管理器 - 支持TCP和HTTP协议的投影仪控制系统"`, { stdio: 'inherit' });
            
            console.log('📤 推送代码到GitHub...');
            execSync(`git remote add origin https://github.com/${repoOwner}/${repoName}.git`, { stdio: 'inherit' });
            execSync('git branch -M main', { stdio: 'inherit' });
            execSync('git push -u origin main', { stdio: 'inherit' });
            
            console.log('✅ 仓库创建并推送成功!');
            
        } catch (error) {
            console.error('❌ GitHub CLI操作失败:', error.message);
            console.log('\n请手动创建仓库并设置远程源:');
            printManualInstructions(repoOwner, repoName);
        }
    } else {
        printManualInstructions(repoOwner, repoName);
    }
    
    // 显示Token设置说明
    console.log('\n🔑 设置GitHub Token:');
    console.log('1. 访问 https://github.com/settings/tokens');
    console.log('2. 点击 "Generate new token (classic)"');
    console.log('3. 选择权限: repo, workflow, write:packages');
    console.log('4. 复制生成的token');
    console.log('5. 设置环境变量:');
    console.log('   Windows: set GITHUB_TOKEN=your_token_here');
    console.log('   Linux/Mac: export GITHUB_TOKEN=your_token_here');
    
    // 显示发布说明
    console.log('\n🚀 发布第一个版本:');
    console.log('   node scripts/update-manager.js patch');
    console.log('   或者:');
    console.log('   1. git tag v1.0.1');
    console.log('   2. git push origin v1.0.1'); 
    console.log('   3. GitHub Actions将自动构建和发布');
    
    console.log('\n🎉 配置完成！');
    rl.close();
}

function printManualInstructions(repoOwner, repoName) {
    console.log('\n📋 手动操作步骤:');
    console.log(`1. 在GitHub上创建新仓库: https://github.com/new`);
    console.log(`   - 仓库名: ${repoName}`);
    console.log(`   - 描述: 投影设备管理器 - 支持TCP和HTTP协议的投影仪控制系统`);
    console.log(`   - 设为公开仓库`);
    console.log('');
    console.log('2. 设置远程仓库并推送代码:');
    console.log(`   git remote add origin https://github.com/${repoOwner}/${repoName}.git`);
    console.log('   git branch -M main');
    console.log('   git push -u origin main');
}

// 处理Ctrl+C
process.on('SIGINT', () => {
    console.log('\n\n👋 配置已取消');
    rl.close();
    process.exit(0);
});

main().catch(console.error);