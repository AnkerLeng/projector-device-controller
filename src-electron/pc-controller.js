const net = require('net');
const dgram = require('dgram');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * PC电脑远程控制器
 * 支持WOL开机、WMI/SSH关机、状态查询等功能
 */
class PCController {
  constructor(device) {
    this.device = device;
    this.type = 'pc';
  }

  /**
   * WOL (Wake-on-LAN) 网络唤醒开机
   * @param {string} macAddress - MAC地址 (格式: AA:BB:CC:DD:EE:FF 或 AA-BB-CC-DD-EE-FF)
   * @param {string} broadcastAddress - 广播地址 (默认: 255.255.255.255)
   * @param {number} port - WOL端口 (默认: 9)
   * @param {number} retryCount - 重试次数
   */
  async sendWOL(macAddress, broadcastAddress = '255.255.255.255', port = 9, retryCount = 0) {
    return new Promise((resolve, reject) => {
      try {
        // 清理MAC地址格式，移除分隔符
        const cleanMac = macAddress.replace(/[:-]/g, '').toUpperCase();
        
        // 验证MAC地址格式
        if (cleanMac.length !== 12 || !/^[0-9A-F]+$/.test(cleanMac)) {
          throw new Error('Invalid MAC address format');
        }

        // 构建魔术包 (Magic Packet)
        // 魔术包格式: 6个0xFF字节 + 16次重复的目标MAC地址
        const magicPacket = Buffer.alloc(102); // 6 + 16*6 = 102 bytes
        
        // 前6个字节填充0xFF
        magicPacket.fill(0xFF, 0, 6);
        
        // 将MAC地址转换为字节数组
        const macBytes = [];
        for (let i = 0; i < cleanMac.length; i += 2) {
          macBytes.push(parseInt(cleanMac.substr(i, 2), 16));
        }
        
        // 重复16次MAC地址
        for (let i = 0; i < 16; i++) {
          for (let j = 0; j < 6; j++) {
            magicPacket[6 + i * 6 + j] = macBytes[j];
          }
        }

        // 创建UDP套接字发送魔术包
        const client = dgram.createSocket('udp4');
        
        // Enhanced logging with IP format like projector_control.js
        const retryText = retryCount > 0 ? ` (第${retryCount}次重试)` : '';
        console.log(`[${this.device.ip}] 发送WOL魔术包到 ${macAddress}${retryText}...`);
        
        client.bind(() => {
          client.setBroadcast(true);
          
          client.send(magicPacket, 0, magicPacket.length, port, broadcastAddress, (err) => {
            client.close();
            
            if (err) {
              console.log(`[${this.device.ip}] WOL发送失败: ${err.message}`);
              reject(err);
            } else {
              console.log(`[${this.device.ip}] WOL魔术包发送成功 -> ${broadcastAddress}:${port}`);
              resolve({
                success: true,
                message: `WOL魔术包已发送到 ${macAddress}`,
                details: {
                  macAddress: macAddress,
                  broadcastAddress: broadcastAddress,
                  port: port,
                  packetSize: magicPacket.length
                }
              });
            }
          });
        });

        // 设置超时
        setTimeout(() => {
          client.close();
          reject(new Error('WOL发送超时'));
        }, 5000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Windows WMI远程关机
   * @param {string} ip - 目标IP地址
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @param {number} timeout - 超时时间（秒，0为立即关机）
   * @param {number} retryCount - 重试次数
   */
  async shutdownWindows(ip, username, password, timeout = 30, retryCount = 0) {
    try {
      // 使用wmic命令进行远程关机
      const cmd = `wmic /node:"${ip}" /user:"${username}" /password:"${password}" process call create "shutdown /s /t ${timeout} /f"`;
      
      // Enhanced logging with IP format and retry count
      const retryText = retryCount > 0 ? ` (第${retryCount}次重试)` : '';
      console.log(`[${ip}] 执行Windows WMI关机命令${retryText}...`);
      
      const { stdout, stderr } = await execAsync(cmd, { timeout: 10000 });
      
      if (stderr && stderr.includes('ERROR')) {
        console.log(`[${ip}] WMI关机失败: ${stderr}`);
        throw new Error(`WMI关机失败: ${stderr}`);
      }
      
      console.log(`[${ip}] Windows关机命令执行成功 (${timeout}秒后关机)`);
      return {
        success: true,
        message: `Windows关机命令已发送 (${timeout}秒后关机)`,
        response: stdout,
        details: {
          ip: ip,
          timeout: timeout,
          method: 'WMI'
        }
      };
    } catch (error) {
      console.log(`[${ip}] Windows关机操作失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
        details: {
          ip: ip,
          method: 'WMI'
        }
      };
    }
  }

  /**
   * Linux SSH远程关机
   * @param {string} ip - 目标IP地址
   * @param {string} username - 用户名
   * @param {string} password - 密码或私钥路径
   * @param {number} timeout - 超时时间（分钟）
   * @param {number} retryCount - 重试次数
   */
  async shutdownLinux(ip, username, password, timeout = 1, retryCount = 0) {
    try {
      // 使用sshpass和ssh命令进行远程关机
      let cmd;
      if (password.startsWith('/') || password.startsWith('~')) {
        // 私钥文件路径
        cmd = `ssh -i "${password}" -o StrictHostKeyChecking=no ${username}@${ip} "sudo shutdown -h +${timeout}"`;
      } else {
        // 密码认证
        cmd = `sshpass -p "${password}" ssh -o StrictHostKeyChecking=no ${username}@${ip} "sudo shutdown -h +${timeout}"`;
      }
      
      // Enhanced logging with IP format and retry count
      const retryText = retryCount > 0 ? ` (第${retryCount}次重试)` : '';
      const authMethod = password.startsWith('/') || password.startsWith('~') ? '密钥认证' : '密码认证';
      console.log(`[${ip}] 执行Linux SSH关机命令 (${authMethod})${retryText}...`);
      
      const { stdout, stderr } = await execAsync(cmd, { timeout: 10000 });
      
      console.log(`[${ip}] Linux关机命令执行成功 (${timeout}分钟后关机)`);
      return {
        success: true,
        message: `Linux关机命令已发送 (${timeout}分钟后关机)`,
        response: stdout,
        details: {
          ip: ip,
          timeout: timeout,
          method: 'SSH'
        }
      };
    } catch (error) {
      console.log(`[${ip}] Linux关机操作失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
        details: {
          ip: ip,
          method: 'SSH'
        }
      };
    }
  }

  /**
   * 检查PC状态（Ping + 端口检测）
   * @param {string} ip - 目标IP地址
   * @param {number} port - 检测端口（可选）
   * @param {number} retryCount - 重试次数
   */
  async checkStatus(ip, port = null, retryCount = 0) {
    try {
      // Enhanced logging with IP format and retry count
      const retryText = retryCount > 0 ? ` (第${retryCount}次重试)` : '';
      console.log(`[${ip}] 检查PC状态${retryText}...`);
      
      // 首先执行ping检测
      const pingResult = await this.pingHost(ip);
      
      if (!pingResult.success) {
        console.log(`[${ip}] Ping检测失败 - PC离线`);
        return {
          success: true,
          status: 'offline',
          message: 'PC离线（Ping不通）',
          details: {
            ip: ip,
            ping: pingResult,
            port: null
          }
        };
      }
      
      console.log(`[${ip}] Ping检测成功`);

      // 如果指定了端口，则进行端口检测
      if (port) {
        console.log(`[${ip}] 检测端口 ${port}...`);
        const portResult = await this.checkPort(ip, port);
        
        if (portResult.success) {
          console.log(`[${ip}] 端口 ${port} 检测成功 - PC在线且服务正常`);
        } else {
          console.log(`[${ip}] 端口 ${port} 检测失败 - PC在线但服务不可用`);
        }
        
        return {
          success: true,
          status: portResult.success ? 'online' : 'partial',
          message: portResult.success ? 'PC在线（Ping通且端口开放）' : 'PC在线（Ping通但端口关闭）',
          details: {
            ip: ip,
            ping: pingResult,
            port: portResult
          }
        };
      }

      console.log(`[${ip}] PC状态检测完成 - 在线`);
      return {
        success: true,
        status: 'online',
        message: 'PC在线（Ping通）',
        details: {
          ip: ip,
          ping: pingResult,
          port: null
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: 'unknown'
      };
    }
  }

  /**
   * Ping主机检测
   */
  async pingHost(ip) {
    try {
      const isWindows = process.platform === 'win32';
      const cmd = isWindows ? `ping -n 1 -w 3000 ${ip}` : `ping -c 1 -W 3 ${ip}`;
      
      const { stdout, stderr } = await execAsync(cmd, { timeout: 5000 });
      
      const success = isWindows ? 
        stdout.includes('TTL=') : 
        stdout.includes('1 received');
        
      return {
        success: success,
        response: stdout,
        method: 'ping'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'ping'
      };
    }
  }

  /**
   * 检查端口连通性
   */
  async checkPort(ip, port) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 3000;

      socket.setTimeout(timeout);
      socket.on('connect', () => {
        socket.destroy();
        resolve({
          success: true,
          message: `端口 ${port} 开放`,
          port: port
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          success: false,
          error: '端口连接超时',
          port: port
        });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({
          success: false,
          error: err.message,
          port: port
        });
      });

      socket.connect(port, ip);
    });
  }

  /**
   * 执行电源操作
   */
  async powerOn(retryCount = 0) {
    try {
      const config = this.device.pcConfig || {};
      
      if (!config.macAddress) {
        throw new Error('MAC地址未配置，无法执行WOL开机');
      }

      const result = await this.sendWOL(
        config.macAddress,
        config.broadcastAddress || '255.255.255.255',
        config.wolPort || 9,
        retryCount
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async powerOff(retryCount = 0) {
    try {
      const config = this.device.pcConfig || {};
      
      if (!config.os) {
        throw new Error('操作系统类型未配置，无法执行关机操作');
      }

      if (config.os.toLowerCase() === 'windows') {
        return await this.shutdownWindows(
          this.device.ip,
          config.username,
          config.password,
          config.shutdownTimeout || 30,
          retryCount
        );
      } else if (config.os.toLowerCase() === 'linux') {
        return await this.shutdownLinux(
          this.device.ip,
          config.username,
          config.password,
          Math.ceil((config.shutdownTimeout || 30) / 60),
          retryCount
        );
      } else {
        throw new Error(`不支持的操作系统类型: ${config.os}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getStatus(retryCount = 0) {
    try {
      const config = this.device.pcConfig || {};
      const result = await this.checkStatus(
        this.device.ip,
        config.checkPort || null,
        retryCount
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 带重试机制的电源控制方法
  async powerControlWithRetry(action, maxRetries = 10, retryDelay = 5000) {
    let lastError = null;
    let actionCommand = '';
    
    // 获取实际执行的操作以便在日志中显示
    switch (action) {
      case 'powerOn':
        actionCommand = 'WOL魔术包';
        break;
      case 'powerOff':
        const config = this.device.pcConfig || {};
        actionCommand = config.os?.toLowerCase() === 'windows' ? 'WMI关机命令' : 'SSH关机命令';
        break;
      case 'status':
        actionCommand = '状态查询';
        break;
      default:
        actionCommand = action;
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let result;
        switch (action) {
          case 'powerOn':
            result = await this.powerOn(attempt > 1 ? attempt - 1 : 0);
            break;
          case 'powerOff':
            result = await this.powerOff(attempt > 1 ? attempt - 1 : 0);
            break;
          case 'status':
            result = await this.getStatus(attempt > 1 ? attempt - 1 : 0);
            break;
          default:
            throw new Error('Invalid action');
        }
        
        if (result.success) {
          // 成功日志已在各个方法中输出
          return { ...result, attempts: attempt };
        } else {
          lastError = new Error(result.error);
          console.log(`[${this.device.ip}] PC操作失败，准备重试`);
        }
      } catch (error) {
        lastError = error;
        console.log(`[${this.device.ip}] PC操作异常: ${error.message}`);
      }
      
      // 如果不是最后一次尝试，等待重试间隔
      if (attempt < maxRetries) {
        console.log(`[${this.device.ip}] 等待 ${retryDelay}ms 后进行第${attempt + 1}次重试...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    // 所有重试都失败了
    console.log(`[${this.device.ip}] 所有重试均失败`);
    return { 
      success: false, 
      error: lastError?.message || '重试次数已用完', 
      attempts: maxRetries 
    };
  }
}

module.exports = PCController;