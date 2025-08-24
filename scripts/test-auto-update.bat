@echo off
setlocal enabledelayedexpansion

echo 🧪 自动更新功能测试脚本
echo =============================
echo.

echo 📋 测试步骤概览:
echo    1. 构建当前版本 (v1.0.0)
echo    2. 设置GitHub仓库
echo    3. 发布新版本 (v1.0.1)  
echo    4. 测试自动更新
echo.

pause

echo 📦 步骤1: 构建当前版本...
echo --------------------------------
npm run build
if errorlevel 1 (
    echo ❌ 前端构建失败
    pause
    exit /b 1
)

echo ✅ 前端构建成功
echo.

echo 🔨 构建Electron应用...
npx electron-builder --dir
if errorlevel 1 (
    echo ❌ Electron构建失败
    pause
    exit /b 1
)

echo ✅ Electron应用构建成功
echo 📁 生产版本位置: dist-electron\win-unpacked\
echo.

echo 🔗 步骤2: 设置GitHub仓库 (可选)
echo --------------------------------
echo 如果还未设置GitHub仓库，请运行:
echo    scripts\setup-remote.bat
echo.
set /p setup="是否需要设置GitHub仓库? (y/n): "
if /i "%setup%"=="y" (
    call scripts\setup-remote.bat
    if errorlevel 1 (
        echo ❌ GitHub仓库设置失败
        pause
        exit /b 1
    )
)

echo.
echo 🚀 步骤3: 创建测试版本
echo --------------------------------
echo 当前版本: 1.0.0
echo 即将创建: v1.0.1 (用于测试更新)
echo.

echo 📝 添加一些变化到新版本...
echo 在package.json中添加测试标记...

rem 创建临时脚本来修改package.json
echo const fs = require('fs'); > temp_modify.js
echo const package = JSON.parse(fs.readFileSync('package.json', 'utf8')); >> temp_modify.js
echo package.description += ' [更新测试版本]'; >> temp_modify.js
echo fs.writeFileSync('package.json', JSON.stringify(package, null, 2)); >> temp_modify.js
echo console.log('✅ 已添加测试标记'); >> temp_modify.js

node temp_modify.js
del temp_modify.js

echo.
echo 📈 更新版本号到 v1.0.1...
npm version patch
if errorlevel 1 (
    echo ❌ 版本更新失败
    pause
    exit /b 1
)

echo.
echo 📤 推送到GitHub并触发自动构建...
git add .
git commit -m "test: 创建v1.0.1测试版本用于验证自动更新功能"
git push origin main
git push origin --tags

echo ✅ 新版本已推送到GitHub
echo 🔗 查看构建状态: https://github.com/projector-manager-system/projector-device-controller/actions
echo.

echo ⏰ 等待GitHub Actions构建完成...
echo    这通常需要5-15分钟，请等待所有平台构建完成
echo.

set /p continue="构建完成后按任意键继续测试... "

echo.
echo 🎯 步骤4: 测试自动更新
echo --------------------------------
echo.
echo 📱 现在请执行以下测试步骤:
echo.
echo    1. 运行 v1.0.0 版本:
echo       cd dist-electron\win-unpacked\
echo       "光子运动 - 投影设备管理器.exe"
echo.
echo    2. 观察自动更新行为:
echo       - 应用启动时检查更新
echo       - 发现v1.0.1版本可用
echo       - 自动在后台下载
echo       - 提示用户重启安装
echo.
echo    3. 验证更新结果:
echo       - 重启后版本变为v1.0.1
echo       - 描述中包含"[更新测试版本]"
echo       - 所有功能正常工作
echo.

echo 🔍 监控工具:
echo    - 打开开发者工具 (F12) 查看控制台日志
echo    - 点击右下角版本按钮查看更新状态
echo    - 检查应用日志文件: %USERPROFILE%\AppData\Roaming\projector-manager\logs\
echo.

echo 📊 预期的控制台日志:
echo    [INFO] Auto-updater initialized
echo    [INFO] Checking for updates...
echo    [INFO] Update available: 1.0.1
echo    [INFO] Downloading update...
echo    [INFO] Update downloaded
echo    [INFO] Update will be installed on restart
echo.

echo ✅ 测试脚本执行完成!
echo 🎉 现在您可以体验完整的自动更新流程
echo.

pause