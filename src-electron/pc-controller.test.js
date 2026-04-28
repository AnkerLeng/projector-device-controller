import { describe, expect, it } from 'vitest';
import PCController from './pc-controller.js';

describe('PCController validation', () => {
  const controller = new PCController({ ip: '192.168.1.10' });

  it('accepts valid IPv4 addresses and rejects invalid ranges', () => {
    expect(() => controller.validateIpAddress('192.168.1.10')).not.toThrow();
    expect(() => controller.validateIpAddress('10.20.1.255')).not.toThrow();
    expect(() => controller.validateIpAddress('10.20.1.999')).toThrow('Invalid IP address range');
    expect(() => controller.validateIpAddress('10.20.1')).toThrow('Invalid IP address format');
  });

  it('accepts normal local/domain usernames and rejects command-like input', () => {
    expect(() => controller.validateUsername('admin')).not.toThrow();
    expect(() => controller.validateUsername('DOMAIN\\admin')).not.toThrow();
    expect(() => controller.validateUsername('user.name-1')).not.toThrow();
    expect(() => controller.validateUsername('-oProxyCommand')).toThrow('用户名格式无效');
    expect(() => controller.validateUsername('bad;cmd')).toThrow('用户名包含不支持的字符');
  });
});
