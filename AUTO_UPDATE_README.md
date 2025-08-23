# Electron 自动更新功能说明

## 功能概览

投影设备管理器现已集成自动更新功能，使用 `update-electron-app` 和 `electron-builder` 实现。

## 主要特性

✅ **自动检查更新** - 每小时检查一次新版本
✅ **后台下载** - 静默下载更新包，不影响用户使用  
✅ **用户友好提示** - 下载完成后提示用户重启应用
✅ **多平台支持** - Windows、macOS、Linux 全平台支持
✅ **GitHub集成** - 基于 GitHub Releases 发布更新
✅ **完整日志** - 所有更新操作都有详细日志记录

## 配置要求

### 1. package.json 配置

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/your-username/projector-manager.git"
  },
  "build": {
    "publish": {
      "provider": "github",
      "owner": "your-username", 
      "repo": "projector-manager"
    }
  }
}
```

### 2. GitHub 仓库配置

1. 创建 GitHub 仓库：`your-username/projector-manager`
2. 设置 GitHub Token 环境变量：
   ```bash
   # Windows
   set GITHUB_TOKEN=your_personal_access_token
   
   # macOS/Linux
   export GITHUB_TOKEN=your_personal_access_token
   ```

## 发布新版本

### 1. 更新版本号

```bash
# 更新 package.json 中的版本号
npm version patch  # 修复版本 (1.0.0 -> 1.0.1)
npm version minor  # 功能版本 (1.0.0 -> 1.1.0) 
npm version major  # 主版本 (1.0.0 -> 2.0.0)
```

### 2. 构建和发布

```bash
# 方法 1: 使用npm脚本
npm run release

# 方法 2: 手动构建发布
npm run build
npx electron-builder --publish=always

# 方法 3: 只在git tag时发布
git tag v1.0.1
git push origin v1.0.1
npm run release  # 自动检测tag并发布
```

## GitHub Actions 自动化发布 (推荐)

创建 `.github/workflows/release.yml`：

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build and release
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      run: npm run release
```

## 更新流程

### 对用户的体验：

1. **应用启动时** - 检查更新（仅生产环境）
2. **后台运行** - 每小时自动检查一次更新
3. **发现更新** - 自动在后台下载
4. **下载完成** - 弹出通知询问是否立即重启
5. **用户确认** - 重启应用后自动安装新版本

### 对开发者：

1. 修复bugs或添加新功能
2. 更新版本号 (`npm version patch`)
3. 推送代码和标签到GitHub
4. GitHub Actions 自动构建并发布
5. 用户自动收到更新

## UI组件

应用右下角有版本显示按钮，点击可以：
- 查看当前版本信息
- 手动检查更新
- 查看自动更新状态

## 开发模式说明

- 开发模式下不会检查更新
- 使用 `NODE_ENV=development` 或未打包状态会禁用更新
- 可在开发者工具中查看更新日志

## 故障排除

### 更新检查失败
- 检查网络连接
- 确认 GitHub 仓库配置正确
- 查看控制台错误日志

### 发布失败
- 检查 GITHUB_TOKEN 权限
- 确认仓库 URL 正确
- 检查 electron-builder 配置

### 用户无法收到更新
- 确认用户使用的是正式发布版本
- 检查 GitHub Releases 是否正确发布
- 确认版本号格式正确 (v1.0.0)

## 最佳实践

1. **版本号管理** - 使用语义化版本号
2. **测试发布** - 先在测试仓库验证发布流程
3. **发布说明** - 为每个版本编写详细的更新说明
4. **渐进发布** - 重要更新可以考虑分批发布
5. **回滚准备** - 保持可以快速回滚到前一版本的能力

## 安全考虑

- 使用 HTTPS 进行所有更新通信
- 验证下载文件的完整性
- 限制自动更新的权限范围
- 定期更新 electron 和相关依赖

---

更多详细信息请参考：
- [update-electron-app 官方文档](https://github.com/electron/update-electron-app)
- [electron-builder 发布配置](https://www.electron.build/configuration/publish)