# 🚀 GitHub仓库设置指南

## 📋 快速设置步骤

### 步骤1：创建GitHub仓库

1. **登录GitHub** 访问 [GitHub](https://github.com)
2. **创建新仓库** 点击右上角的 "+" → "New repository"
3. **填写仓库信息**：
   - **仓库名称**: `projector-device-controller`
   - **描述**: `投影设备管理器 - 支持TCP和HTTP协议的投影仪控制系统`
   - **类型**: 公开仓库 (Public)
   - **不要**初始化README、.gitignore或license（我们已经有了）

### 步骤2：设置远程仓库

在项目目录中运行以下命令：

```bash
# 添加远程仓库 (替换YOUR_USERNAME为您的GitHub用户名)
git remote add origin https://github.com/YOUR_USERNAME/projector-device-controller.git

# 重命名主分支
git branch -M main

# 推送代码
git push -u origin main
```

### 步骤3：设置GitHub Token

1. **创建Personal Access Token**：
   - 访问 https://github.com/settings/tokens
   - 点击 "Generate new token (classic)"
   - 设置过期时间（建议90天或更长）
   - 选择权限范围：
     - ✅ `repo` (完整仓库权限)
     - ✅ `workflow` (GitHub Actions权限)
     - ✅ `write:packages` (包发布权限)

2. **复制Token** 并妥善保存

3. **设置环境变量**：
   ```bash
   # Windows Command Prompt
   set GITHUB_TOKEN=your_token_here
   
   # Windows PowerShell
   $env:GITHUB_TOKEN="your_token_here"
   
   # macOS/Linux
   export GITHUB_TOKEN=your_token_here
   ```

### 步骤4：更新package.json配置

如果您使用不同的GitHub用户名，请更新 `package.json`：

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_USERNAME/projector-device-controller.git"
  },
  "build": {
    "publish": {
      "provider": "github",
      "owner": "YOUR_USERNAME",
      "repo": "projector-device-controller"
    }
  }
}
```

## 🚀 发布第一个版本

### 方法1：使用更新管理脚本
```bash
# 检查配置
node scripts/update-manager.js check

# 发布补丁版本 (1.0.0 → 1.0.1)
node scripts/update-manager.js patch
```

### 方法2：手动发布
```bash
# 更新版本号
npm version patch

# 创建标签并推送
git push origin main
git push origin --tags

# 或者直接推送标签触发自动发布
git tag v1.0.1
git push origin v1.0.1
```

## 🤖 GitHub Actions自动发布

我们已经配置了GitHub Actions工作流 (`.github/workflows/release.yml`)，当您推送版本标签时会自动：

1. ✅ 在Windows、macOS、Linux上构建应用
2. ✅ 创建安装包 (.exe, .dmg, .AppImage)
3. ✅ 自动发布到GitHub Releases
4. ✅ 用户自动收到更新通知

### 监控构建状态
- 访问 `https://github.com/YOUR_USERNAME/projector-device-controller/actions`
- 查看构建日志和结果

## 🔧 故障排除

### 问题1：推送代码失败
```bash
# 如果遇到权限问题，检查远程URL
git remote -v

# 更新远程URL为HTTPS
git remote set-url origin https://github.com/YOUR_USERNAME/projector-device-controller.git
```

### 问题2：GitHub Actions构建失败
1. 检查 `GITHUB_TOKEN` 权限
2. 确认 `package.json` 中的仓库配置正确
3. 查看Actions日志中的具体错误信息

### 问题3：发布失败
1. 确保版本标签格式正确 (v1.0.1)
2. 检查是否已存在相同版本的Release
3. 验证GitHub Token是否有足够权限

## 📊 验证自动更新

### 测试步骤：
1. **创建第一个Release** 使用上述方法
2. **安装发布版本** 从GitHub Releases下载
3. **发布新版本** 提升版本号并发布
4. **测试更新** 运行已安装的应用，等待更新通知

### 查看更新日志：
- 打开应用开发者工具 (F12)
- 查看Console输出的更新日志
- 或查看日志文件：`%USERPROFILE%\\AppData\\Roaming\\projector-manager\\logs\\`

## 🎉 完成后的效果

✅ **用户体验**：
- 应用启动时自动检查更新
- 每小时后台检查更新
- 有更新时自动下载
- 下载完成后提示用户重启

✅ **开发体验**：
- 推送标签自动构建和发布
- 多平台同时发布
- 完整的构建日志和错误报告

---

## 🔄 下一步操作

完成设置后，您可以：
1. 运行 `node scripts/update-manager.js check` 验证配置
2. 创建第一个发布版本测试整个流程
3. 在实际设备上验证自动更新功能

需要帮助？查看其他文档：
- `AUTO_UPDATE_README.md` - 技术详细文档
- `HOW_TO_USE_UPDATES.md` - 使用指南