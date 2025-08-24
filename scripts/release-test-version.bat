@echo off
echo 🧪 发布测试版本 (v1.0.2) 用于更新测试
echo =====================================

echo.
echo 📝 添加测试标记到应用...

rem 在App.vue中添加测试标记
echo const fs = require('fs'); > temp_add_test_marker.js
echo const appVuePath = 'src/App.vue'; >> temp_add_test_marker.js
echo let content = fs.readFileSync(appVuePath, 'utf8'); >> temp_add_test_marker.js
echo. >> temp_add_test_marker.js
echo // 在标题中添加测试版本标记 >> temp_add_test_marker.js
echo if (!content.includes('[测试版]')) { >> temp_add_test_marker.js
echo   content = content.replace( >> temp_add_test_marker.js
echo     '光子运动 - 投影设备管理器', >> temp_add_test_marker.js
echo     '光子运动 - 投影设备管理器 [测试版 v1.0.2]' >> temp_add_test_marker.js
echo   ); >> temp_add_test_marker.js
echo   fs.writeFileSync(appVuePath, content); >> temp_add_test_marker.js
echo   console.log('✅ 已添加测试版本标记'); >> temp_add_test_marker.js
echo } else { >> temp_add_test_marker.js
echo   console.log('ℹ️ 测试版本标记已存在'); >> temp_add_test_marker.js
echo } >> temp_add_test_marker.js

node temp_add_test_marker.js
del temp_add_test_marker.js

echo.
echo 📈 更新版本号到 v1.0.2...
npm version patch
if errorlevel 1 (
    echo ❌ 版本更新失败
    pause
    exit /b 1
)

echo.
echo 📦 构建测试版本...
npm run build
if errorlevel 1 (
    echo ❌ 构建失败
    pause
    exit /b 1
)

echo.
echo 📤 提交更改并推送...
git add .
git commit -m "test: 发布v1.0.2测试版本用于验证自动更新功能

🧪 测试版本变更:
- 添加版本标识 [测试版 v1.0.2]
- 用于验证自动更新流程
- 测试从 v1.0.1 更新到 v1.0.2

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
git push origin --tags

echo.
echo 🚀 发布到GitHub Releases...
npx electron-builder --publish=always
if errorlevel 1 (
    echo ❌ 发布失败
    pause
    exit /b 1
)

echo.
echo ✅ v1.0.2 测试版本发布成功!
echo.
echo 🧪 现在可以测试自动更新:
echo 1. 确保v1.0.1版本的应用正在运行
echo 2. 在应用中点击右下角版本按钮
echo 3. 点击 "检查更新"
echo 4. 观察自动更新过程:
echo    - 检测到v1.0.2版本
echo    - 自动下载更新
echo    - 提示重启安装
echo    - 重启后变为v1.0.2版本

echo.
echo 🔍 监控更新过程:
echo - 打开开发者工具查看Console日志
echo - 检查应用日志: %%USERPROFILE%%\AppData\Roaming\projector-manager\logs\
echo - 查看GitHub Release: https://github.com/%GITHUB_OWNER%/%GITHUB_REPO%/releases

pause