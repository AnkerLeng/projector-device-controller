@echo off
echo 🔧 设置GitHub远程仓库
echo ========================

set /p USERNAME="请输入您的GitHub用户名: "
if "%USERNAME%"=="" (
    echo ❌ 用户名不能为空
    pause
    exit /b 1
)

echo.
echo 📝 更新package.json配置...

rem 创建临时的配置更新脚本
echo const fs = require('fs'); > temp_update.js
echo const package = JSON.parse(fs.readFileSync('package.json', 'utf8')); >> temp_update.js
echo package.repository.url = 'https://github.com/%USERNAME%/projector-device-controller.git'; >> temp_update.js
echo package.build.publish.owner = '%USERNAME%'; >> temp_update.js
echo package.homepage = 'https://github.com/%USERNAME%/projector-device-controller#readme'; >> temp_update.js
echo fs.writeFileSync('package.json', JSON.stringify(package, null, 2)); >> temp_update.js
echo console.log('✅ package.json 已更新'); >> temp_update.js

node temp_update.js
del temp_update.js

echo.
echo 🔗 设置Git远程仓库...
git remote remove origin 2>nul
git remote add origin https://github.com/%USERNAME%/projector-device-controller.git
git branch -M main

echo.
echo 📤 推送代码到GitHub...
git push -u origin main

echo.
echo ✅ 设置完成！
echo.
echo 📋 接下来的步骤:
echo 1. 设置GitHub Token (参考 SETUP_GITHUB_REPOSITORY.md)
echo 2. 运行 scripts\quick-release.bat 发布第一个版本

pause