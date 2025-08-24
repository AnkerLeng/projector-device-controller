# 私有仓库自动更新设置指南

## 📋 私有仓库配置要求

使用私有仓库进行自动更新需要额外的配置步骤：

### 1. GitHub Token 设置

**发布时需要的Token（开发环境）：**
```bash
# Windows
set GH_TOKEN=your_github_token_here

# 或者永久设置
setx GH_TOKEN "your_github_token_here"
```

**Token权限要求：**
- `repo` - 完整的仓库权限
- `workflow` - 工作流权限（如果使用GitHub Actions）

### 2. 客户端访问配置

私有仓库的自动更新需要客户端能够访问GitHub API。有几种方式：

**方案A：公开Releases（推荐）**
- 仓库设为私有，但Releases设为公开
- 在GitHub仓库设置中启用 "Make releases public"
- 这样代码私有，但更新包可以公开下载

**方案B：Token认证**
- 在应用中嵌入只读token（风险较高）
- 需要修改更新器配置添加认证

**方案C：自托管更新服务器**
- 使用自己的服务器托管更新文件
- 修改更新配置指向自定义服务器

## 🚀 发布流程

### 首次发布（v1.0.1）
```bash
# 设置token
set GH_TOKEN=your_token

# 构建并发布
npm run build
npx electron-builder --publish=always
```

### 测试更新（v1.0.2）
```bash
# 更新版本
npm version patch

# 添加测试标记
# 修改 App.vue 标题添加 [测试版 v1.0.2]

# 构建并发布
npm run build
git add . && git commit -m "test: v1.0.2测试版本"
git push && git push --tags
npx electron-builder --publish=always
```

## ⚠️ 注意事项

1. **Token安全**：不要将token提交到代码库
2. **权限控制**：确保token权限最小化
3. **网络访问**：客户端需要能访问GitHub API
4. **下载权限**：私有仓库的assets需要认证才能下载

## 🔍 故障排除

**如果更新检查失败：**
1. 检查GitHub API访问权限
2. 确认Releases是否可访问
3. 查看应用日志：`%USERPROFILE%\AppData\Roaming\projector-manager\logs\`
4. 验证token权限和有效性

**推荐设置：**
- 使用私有仓库 + 公开Releases
- 这样既保护源代码，又允许用户正常更新