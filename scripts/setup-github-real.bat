@echo off
echo 🔧 设置真实GitHub仓库进行自动更新测试
echo ==========================================

echo.
echo 📋 测试说明:
echo 要测试真实的自动更新功能，我们需要:
echo 1. 创建GitHub仓库
echo 2. 设置GitHub Token (用于发布)
echo 3. 发布第一个版本 (v1.0.1)
echo 4. 发布测试版本 (v1.0.2)
echo 5. 测试从 v1.0.1 更新到 v1.0.2

echo.
set /p USERNAME="请输入您的GitHub用户名: "
if "%USERNAME%"=="" (
    echo ❌ 用户名不能为空
    pause
    exit /b 1
)

set /p REPO_NAME="请输入仓库名称 (默认: projector-device-controller): "
if "%REPO_NAME%"=="" set REPO_NAME=projector-device-controller

echo.
echo 📝 更新package.json配置...

rem 创建临时的配置更新脚本
echo const fs = require('fs'); > temp_update_real.js
echo const packagePath = 'package.json'; >> temp_update_real.js
echo const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8')); >> temp_update_real.js
echo. >> temp_update_real.js
echo // 更新仓库配置 >> temp_update_real.js
echo packageData.repository = { >> temp_update_real.js
echo   type: 'git', >> temp_update_real.js
echo   url: `https://github.com/%USERNAME%/%REPO_NAME%.git` >> temp_update_real.js
echo }; >> temp_update_real.js
echo. >> temp_update_real.js
echo // 更新发布配置 >> temp_update_real.js
echo packageData.build.publish = { >> temp_update_real.js
echo   provider: 'github', >> temp_update_real.js
echo   owner: '%USERNAME%', >> temp_update_real.js
echo   repo: '%REPO_NAME%' >> temp_update_real.js
echo }; >> temp_update_real.js
echo. >> temp_update_real.js
echo // 更新主页 >> temp_update_real.js
echo packageData.homepage = `https://github.com/%USERNAME%/%REPO_NAME%#readme`; >> temp_update_real.js
echo. >> temp_update_real.js
echo fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2)); >> temp_update_real.js
echo console.log('✅ package.json 已更新'); >> temp_update_real.js
echo console.log('   Repository:', packageData.repository.url); >> temp_update_real.js
echo console.log('   Publish to:', packageData.build.publish.owner + '/' + packageData.build.publish.repo); >> temp_update_real.js

node temp_update_real.js
del temp_update_real.js

echo.
echo 🔗 设置Git远程仓库...
git remote remove origin 2>nul
git remote add origin https://github.com/%USERNAME%/%REPO_NAME%.git
git branch -M main

echo.
echo 📤 推送代码到GitHub...
echo 注意: 您需要先在GitHub上创建仓库: %USERNAME%/%REPO_NAME%
echo.
set /p CONFIRM="仓库已创建？(y/n): "
if /i not "%CONFIRM%"=="y" (
    echo ❌ 请先创建GitHub仓库，然后重新运行此脚本
    pause
    exit /b 1
)

git add .
git commit -m "feat: 初始化投影设备管理系统，支持自动更新

✨ 功能特性:
- TCP/HTTP协议投影设备控制  
- 房间分组管理
- 批量操作
- 自动更新机制
- PC控制功能

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push -u origin main

echo.
echo ✅ 代码已推送到GitHub!
echo 🔗 仓库地址: https://github.com/%USERNAME%/%REPO_NAME%
echo.
echo 📋 下一步操作:
echo 1. 设置GitHub Token (Settings -> Developer settings -> Personal access tokens)
echo    - 需要 'repo' 和 'workflow' 权限
echo 2. 运行 scripts\release-first-version.bat 发布 v1.0.1
echo 3. 运行 scripts\release-test-version.bat 发布 v1.0.2  
echo 4. 测试自动更新功能

pause