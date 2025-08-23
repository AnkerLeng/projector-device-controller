@echo off
echo 🚀 快速发布脚本
echo ================

echo.
echo 📊 当前状态:
node scripts/update-manager.js status

echo.
echo 🔍 检查配置...
node scripts/update-manager.js check
if errorlevel 1 (
    echo.
    echo ❌ 配置检查未通过，请先完成GitHub仓库设置
    echo 📖 参考: SETUP_GITHUB_REPOSITORY.md
    pause
    exit /b 1
)

echo.
echo 📝 更新版本号到 1.0.1...
npm version patch

echo.
echo 📤 推送到GitHub...
git push origin main
git push origin --tags

echo.
echo ✅ 发布完成！
echo 🔗 查看GitHub Actions: https://github.com/projector-manager-system/projector-device-controller/actions
echo 📱 用户将在1小时内收到更新通知

pause