# PC电脑远程开关机控制配置指南

## 🖥️ 功能概述

投影设备管理系统现在支持PC电脑的远程开关机控制，使用网络协议实现：

### 支持的功能
- **WOL网络唤醒开机** (Wake-on-LAN)
- **Windows远程关机** (通过WMI)
- **Linux远程关机** (通过SSH)
- **网络状态检测** (Ping + 端口检测)
- **批量操作支持**
- **重试机制** (最多10次重试)

## 🔧 PC端配置要求

### 1. WOL网络唤醒配置（开机功能）

#### 1.1 BIOS/UEFI设置
```
Power Management Setup:
  ├── Wake On LAN: Enabled
  ├── Deep Sleep Control: Disabled
  └── ErP Ready: Disabled (如果有此选项)

Advanced:
  └── APM Configuration:
      └── Restore AC Power Loss: Power On
```

#### 1.2 网卡驱动设置
```
设备管理器 → 网络适配器 → [你的网卡] → 属性 → 高级
  ├── 关机网络唤醒: 启用
  ├── 魔术数据包唤醒: 启用
  └── 唤醒魔术数据包: 启用

电源管理选项卡:
  ├── ☑ 允许计算机关闭此设备以节约电源
  ├── ☑ 允许此设备唤醒计算机
  └── ☑ 只允许魔术数据包唤醒计算机
```

#### 1.3 获取MAC地址
```bash
# Windows
ipconfig /all
# 查找 "物理地址" 字段

# Linux
ip link show
# 或
ifconfig
```

### 2. Windows远程关机配置

#### 2.1 启用WMI远程访问
```cmd
# 以管理员身份运行命令提示符
wmic /namespace:\\root\\cimv2 PATH Win32_TerminalServiceSetting WHERE (__CLASS !="") CALL SetAllowTSConnections 1

# 启用远程管理
winrm quickconfig -force
winrm set winrm/config/service/auth @{Basic="true"}
```

#### 2.2 防火墙配置
```cmd
# 允许WMI通过防火墙
netsh advfirewall firewall set rule group="windows management instrumentation (wmi)" new enable=yes

# 或者创建特定规则
netsh advfirewall firewall add rule name="WMI-In" dir=in action=allow protocol=TCP localport=135
```

#### 2.3 用户权限
确保用于远程控制的账户具有：
- 管理员权限
- "作为服务登录"权限
- "远程关机"权限

### 3. Linux远程关机配置

#### 3.1 SSH服务配置
```bash
# 安装SSH服务 (Ubuntu/Debian)
sudo apt update
sudo apt install openssh-server

# 启动SSH服务
sudo systemctl enable ssh
sudo systemctl start ssh
```

#### 3.2 sudo权限配置
```bash
# 编辑sudoers文件
sudo visudo

# 添加以下行（允许指定用户无密码执行shutdown命令）
username ALL=(ALL) NOPASSWD: /sbin/shutdown
```

#### 3.3 密钥认证设置（推荐）
```bash
# 在控制端生成密钥对
ssh-keygen -t rsa -b 2048

# 将公钥复制到目标PC
ssh-copy-id username@target_ip

# 在系统中配置私钥路径
/home/user/.ssh/id_rsa
```

## 🎛️ 控制台配置

### 1. 添加PC设备

在投影设备管理器中：
1. 点击"添加设备"
2. 选择设备类型："PC电脑"
3. 填写基本信息：
   - 设备名称：如"会议室A-PC"
   - IP地址：目标PC的IP地址

### 2. WOL开机配置
```
MAC地址: AA:BB:CC:DD:EE:FF (必填)
广播地址: 255.255.255.255 (默认)
WOL端口: 9 (默认)
```

### 3. 关机配置

#### Windows配置示例
```
操作系统: Windows
用户名: administrator
密码: [管理员密码]
关机延时: 30秒
```

#### Linux配置示例  
```
操作系统: Linux
用户名: root
密码: [root密码] 或 /home/user/.ssh/id_rsa
关机延时: 30秒
```

### 4. 状态检测配置
```
检测端口 (可选):
  - Windows RDP: 3389
  - Linux SSH: 22
  - HTTP服务: 80
  - 自定义服务端口
```

## 📋 预设模板

系统提供以下预设配置模板：

### Windows工作站
- OS: Windows
- 用户名: administrator
- 关机延时: 30秒
- 检测端口: 3389 (RDP)

### Windows服务器
- OS: Windows  
- 用户名: administrator
- 关机延时: 60秒
- 检测端口: 3389 (RDP)

### Linux桌面
- OS: Linux
- 用户名: user
- 关机延时: 30秒
- 检测端口: 22 (SSH)

### Linux服务器
- OS: Linux
- 用户名: root
- 关机延时: 60秒
- 检测端口: 22 (SSH)

## 🚀 使用方法

### 1. 单设备控制
- **开机**: 点击设备卡片上的"开机"按钮，系统发送WOL魔术包
- **关机**: 点击"关机"按钮，系统通过WMI/SSH发送关机命令
- **状态查询**: 点击"状态"按钮，检查网络连通性和服务状态

### 2. 批量操作
- 选择多个PC设备
- 点击"批量开机"或"批量关机"
- 系统自动对所有选中的PC执行相同操作
- 支持重试机制，最多重试10次直到成功

### 3. 设备组管理
- 将经常一起操作的PC添加到设备组
- 可以快速对整个设备组执行批量操作

## 🔍 故障排查

### WOL开机问题
1. **PC不响应WOL**:
   - 检查BIOS中WOL设置是否启用
   - 确认网卡驱动支持WOL
   - 验证MAC地址是否正确

2. **网络问题**:
   - 确保PC和控制端在同一网段
   - 检查交换机是否支持WOL数据包转发
   - 尝试使用局域网广播地址

### 远程关机问题  
1. **Windows WMI失败**:
   - 检查防火墙设置
   - 确认用户权限
   - 验证WMI服务运行状态

2. **Linux SSH失败**:
   - 检查SSH服务状态
   - 确认用户名密码或密钥
   - 验证sudo权限配置

### 网络连接问题
1. **Ping不通**:
   - 检查IP地址配置
   - 确认网络连接
   - 检查防火墙设置

2. **端口不通**:
   - 确认服务正在运行
   - 检查防火墙端口规则
   - 验证服务绑定地址

## 🏗️ 技术实现

### WOL魔术包格式
```
魔术包结构 (102 bytes):
├── 同步序列: FF FF FF FF FF FF (6 bytes)
└── MAC地址: 重复16次目标MAC地址 (96 bytes)
```

### Windows关机命令
```bash
wmic /node:"IP" /user:"用户名" /password:"密码" process call create "shutdown /s /t 延时秒数 /f"
```

### Linux关机命令  
```bash
# 密码认证
sshpass -p "密码" ssh -o StrictHostKeyChecking=no 用户名@IP "sudo shutdown -h +延时分钟数"

# 密钥认证
ssh -i "私钥路径" -o StrictHostKeyChecking=no 用户名@IP "sudo shutdown -h +延时分钟数"
```

## ⚠️ 安全注意事项

1. **密码安全**:
   - 使用强密码
   - 定期更换密码
   - 考虑使用密钥认证替代密码

2. **网络安全**:
   - 确保控制端和目标PC在可信网络环境
   - 考虑VPN或网络隔离
   - 监控异常的网络活动

3. **权限管理**:
   - 最小权限原则
   - 定期审查用户权限
   - 记录所有远程操作日志

## 📞 技术支持

如遇到问题，请检查：
1. 控制台的操作日志面板
2. PC端的系统日志
3. 网络连通性测试结果

系统提供详细的重试过程和错误信息，有助于快速定位和解决问题。