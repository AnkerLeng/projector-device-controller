@echo off
echo 🚀 发布第一个版本 (v1.0.1)
echo ============================

echo.
echo 📊 当前状态检查...
node -e "const pkg=require('./package.json'); console.log('当前版本:', pkg.version); console.log('仓库:', pkg.repository.url); console.log('发布到:', pkg.build.publish.owner + '/' + pkg.build.publish.repo);"

echo.
echo 🔧 检查GitHub Token...
if "%GH_TOKEN%"=="" (
    echo ❌ 未设置 GH_TOKEN 环境变量
    echo.
    echo 请设置GitHub Token:
    echo 1. 访问: https://github.com/settings/tokens
    echo 2. 创建新token，勾选 'repo' 和 'workflow' 权限
    echo 3. 设置环境变量: set GH_TOKEN=your_token_here
    echo.
    pause
    exit /b 1
)

echo ✅ GitHub Token 已设置

echo.
echo 📦 构建应用程序...
npm run build
if errorlevel 1 (
    echo ❌ 前端构建失败
    pause
    exit /b 1
)

echo ✅ 前端构建成功

echo.
echo 🏗️ 构建并发布Electron应用...
echo 这将会:
echo - 构建Windows, macOS, Linux版本
echo - 创建安装包
echo - 发布到GitHub Releases

npx electron-builder --publish=always
if errorlevel 1 (
    echo ❌ 发布失败
    echo.
    echo 常见问题:
    echo - 检查GitHub Token是否正确
    echo - 确认仓库存在且可访问
    echo - 检查网络连接
    pause
    exit /b 1
)

echo.
echo ✅ 发布成功!
echo 🔗 查看发布: https://github.com/%GITHUB_OWNER%/%GITHUB_REPO%/releases

echo.
echo 📱 现在可以安装v1.0.1版本进行测试:
echo 1. 从GitHub Releases下载安装包
echo 2. 安装应用
echo 3. 运行 scripts\release-test-version.bat 发布v1.0.2
echo 4. 在已安装的v1.0.1应用中测试更新

pause