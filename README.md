# Projector Manager - 投影设备管理器

一个基于 Electron + Vue 3 + Ant Design Vue 的投影设备管理系统，支持 TCP 和 HTTP 协议的设备控制。

## 🚀 功能特性

### 核心功能
- **多协议支持**: 同时支持 TCP 和 HTTP GET 协议
- **房间分类管理**: 按房间组织和管理投影设备
- **批量控制**: 支持选择多台设备进行批量开关机
- **实时状态**: 设备在线/离线状态实时显示
- **连接测试**: 设备配置时可进行连接测试

### 协议支持

#### TCP 协议
- 默认端口: 9763 (可配置)
- 支持自定义命令格式
- 内置常用命令模板:
  - 简单文本命令 (`PWR ON\r\n`)
  - PJLink 协议 (`%1POWR 1\r`)

#### HTTP 协议  
- 默认端口: 80 (可配置)
- 支持 GET 请求控制
- 支持 Basic Auth 认证
- 内置常用接口模板:
  - RESTful API (`/api/power/on`)
  - 查询参数 (`/control?cmd=power&action=on`)
  - CGI 风格 (`/cgi-bin/proj_control.cgi?power=on`)

## 🛠️ 技术栈

- **前端**: Vue 3 + Ant Design Vue 4.0
- **构建工具**: Vite 4.x
- **桌面框架**: Electron 25.x
- **网络请求**: Axios (HTTP), Node.js Net (TCP)
- **数据存储**: JSON 文件本地存储

## 📦 安装和运行

### 环境要求
- Node.js 16+ 
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 开发模式运行
```bash
# 启动 Vite 开发服务器和 Electron
npm run electron:dev
```

### 构建应用
```bash
# 构建前端资源
npm run build

# 打包 Electron 应用
npm run electron:build
```

## 🎯 使用指南

### 1. 添加设备

点击右上角"添加设备"按钮，填写设备信息：

**基本信息**
- 设备名称: 便于识别的设备名称
- IP 地址: 设备的网络地址  
- 协议类型: 选择 TCP 或 HTTP
- 端口: 设备监听端口 (TCP 默认 9763, HTTP 默认 80)
- 所属房间: 选择已有房间或输入新房间名

**TCP 设备配置**
- 开机命令: 发送给设备的开机指令
- 关机命令: 发送给设备的关机指令  
- 状态查询命令: 查询设备状态的指令
- 可选择预设模板快速配置

**HTTP 设备配置**
- 开机接口: GET 请求的开机路径
- 关机接口: GET 请求的关机路径
- 状态接口: 查询状态的接口路径
- 身份验证: 可选的用户名密码认证

### 2. 设备控制

**单设备控制**
- 在设备卡片上直接点击"开机"或"关机"按钮
- 点击"状态"按钮查询设备当前状态
- 点击"测试"按钮测试设备连接

**批量控制**
- 勾选多个设备复选框
- 在顶部批量控制面板中选择操作
- 系统会并行执行所有选中设备的控制命令

### 3. 房间管理

- 左侧边栏显示所有房间及设备数量
- 点击房间名筛选显示该房间的设备
- 点击"所有设备"查看全部设备
- 添加设备时可以创建新房间

## 📁 项目结构

```
projector/
├── src/                    # 前端源码
│   ├── components/         # Vue 组件
│   ├── App.vue            # 主应用组件
│   └── main.js           # 前端入口
├── src-electron/          # Electron 主进程
│   ├── main.js           # Electron 主进程文件
│   └── preload.js        # 预加载脚本
├── devices.json          # 设备配置存储
├── package.json         # 项目配置
├── vite.config.js       # Vite 配置
└── CLAUDE.md           # Claude Code 开发指南
```

## 🔧 配置说明

### 设备配置文件 (devices.json)

```json
{
  "id": "唯一设备ID",
  "name": "设备名称",
  "ip": "设备IP地址", 
  "port": 设备端口,
  "type": "tcp|http",
  "room": "房间名称",
  "tcpCommands": {
    "powerOn": "开机命令",
    "powerOff": "关机命令", 
    "status": "状态查询命令"
  },
  "httpUrls": {
    "powerOn": "开机接口路径",
    "powerOff": "关机接口路径",
    "status": "状态接口路径" 
  },
  "httpAuth": {
    "username": "用户名",
    "password": "密码"
  }
}
```

### 常用 TCP 命令示例

```bash
# 简单文本命令
PWR ON\r\n      # 开机
PWR OFF\r\n     # 关机  
PWR?\r\n        # 状态查询

# PJLink 协议
%1POWR 1\r      # 开机
%1POWR 0\r      # 关机
%1POWR ?\r      # 状态查询
```

### 常用 HTTP 接口示例

```bash
# RESTful 风格
GET /api/power/on     # 开机
GET /api/power/off    # 关机
GET /api/status       # 状态

# 查询参数风格  
GET /control?cmd=power&action=on   # 开机
GET /control?cmd=power&action=off  # 关机
GET /control?cmd=power&action=status # 状态
```

## 🐛 故障排除

### 常见问题

1. **TCP 连接超时**
   - 检查设备 IP 地址和端口是否正确
   - 确认设备支持 TCP 连接
   - 检查网络连通性

2. **HTTP 请求失败**
   - 确认设备 HTTP 服务是否启用
   - 检查接口路径是否正确
   - 验证身份验证信息

3. **设备状态显示异常**
   - 检查状态查询命令/接口配置
   - 查看 Electron 开发者控制台的错误信息

### 调试模式

开发模式下会自动打开 Electron DevTools，可以在控制台查看详细的错误信息和网络请求日志。

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！