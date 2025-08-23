# 如何使用自动更新功能

## 🎯 用户操作指南

### 1. 查看当前版本
- 应用右下角显示版本按钮（如 `v1.0.0`）
- 点击版本按钮展开更新面板

### 2. 更新面板功能
- **当前版本信息** - 显示应用版本号
- **更新状态** - 显示自动更新是否启用
- **检查更新按钮** - 手动检查更新
- **状态指示器** - 显示更新进度

### 3. 自动更新流程

```
🚀 应用启动
    ↓
🔍 自动检查更新 (每小时一次)
    ↓
📥 发现更新 → 后台下载
    ↓  
🔔 下载完成 → 用户确认重启
    ↓
✅ 自动安装新版本
```

## 🛠️ 开发者操作指南

### 1. 检查配置状态
```bash
node scripts/update-manager.js check
```

### 2. 发布新版本
```bash
# 修复版本 (1.0.0 → 1.0.1)
node scripts/update-manager.js patch

# 功能版本 (1.0.0 → 1.1.0) 
node scripts/update-manager.js minor

# 主版本 (1.0.0 → 2.0.0)
node scripts/update-manager.js major
```

### 3. 仅构建测试
```bash
node scripts/update-manager.js build
```

### 4. 测试更新功能
```bash
node scripts/update-manager.js test
```

## 🧪 实际测试步骤

### 步骤 1: 配置GitHub仓库
1. 在GitHub创建仓库 `your-username/projector-manager`
2. 更新 `package.json` 中的仓库URL
3. 设置 GitHub Token：
   ```bash
   # Windows
   set GITHUB_TOKEN=your_token_here
   
   # macOS/Linux  
   export GITHUB_TOKEN=your_token_here
   ```

### 步骤 2: 创建首个发布
```bash
# 检查配置
node scripts/update-manager.js check

# 发布补丁版本
node scripts/update-manager.js patch
```

### 步骤 3: 测试更新体验
1. 安装打包后的应用
2. 发布新版本到GitHub
3. 等待1小时或重启应用触发更新检查
4. 验证自动下载和安装流程

## 📱 用户体验演示

### 开发模式
- 右下角显示 `v1.0.0`
- 点击后显示"开发模式下不会检查更新"
- 更新按钮为禁用状态

### 生产模式
- 右下角显示 `v1.0.0` 
- 点击后显示完整更新面板
- 可手动点击"检查更新"
- 自动更新状态显示"已启用"

## 🔧 调试和监控

### 查看更新日志
1. 打开开发者工具 (F12)
2. 查看Console标签页
3. 搜索 "update" 或 "Auto-updater" 相关日志

### 日志文件位置
- **Windows**: `%USERPROFILE%\AppData\Roaming\projector-manager\logs\`
- **macOS**: `~/Library/Logs/projector-manager/`
- **Linux**: `~/.config/projector-manager/logs/`

### 常见日志信息
```
[INFO] Auto-updater initialized
[INFO] Checking for updates...
[INFO] Update available: 1.0.1
[INFO] Update downloaded
[INFO] Update will be installed on restart
```

## 🚨 故障排除

### 问题1: 无法检查更新
**症状**: 点击"检查更新"无响应
**解决**: 
- 确认网络连接正常
- 检查GitHub仓库URL配置
- 查看控制台错误日志

### 问题2: 更新下载失败  
**症状**: 提示"更新检查失败"
**解决**:
- 检查GitHub Releases是否正确发布
- 确认版本号格式正确 (v1.0.0)
- 验证发布资源文件完整

### 问题3: 开发模式显示问题
**症状**: 生产环境显示"开发模式"
**解决**:
- 使用 `npm run electron:build` 正确打包
- 确保从打包后的文件启动应用
- 检查 `app.isPackaged` 状态

## 🎨 UI界面说明

### 版本按钮样式
- **位置**: 右下角固定
- **样式**: 半透明，悬停时高亮
- **内容**: "v" + 版本号

### 更新面板布局
```
┌─────────────────────────────┐
│ 🔄 应用更新            ✖️  │
├─────────────────────────────┤
│ 当前版本: v1.0.0           │
│ [自动更新已启用]           │
├─────────────────────────────┤
│    [🔄 检查更新]           │
│                             │
│ ℹ️ 开发模式下无法检查更新    │
└─────────────────────────────┘
```

## 📊 更新统计

应用会自动记录：
- 更新检查频率
- 下载成功率  
- 安装完成率
- 用户交互数据

这些数据有助于优化更新体验和排查问题。

---

💡 **提示**: 建议在发布重要更新前，先在测试环境验证整个更新流程！