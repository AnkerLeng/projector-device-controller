<template>
  <a-card 
    :title="device.name"
    size="small"
    class="device-card"
    :class="{ selected: selected }"
  >
    <template #extra>
      <a-space size="small">
        <a-tag :color="device.type === 'tcp' ? 'blue' : 'green'">
          {{ device.type.toUpperCase() }}
        </a-tag>
        <a-tag v-if="device.type === 'tcp'" color="orange" size="small">
          :{{ device.port || 9763 }}
        </a-tag>
        <a-tag v-if="device.type === 'http'" color="purple" size="small">
          :{{ device.port || 80 }}
        </a-tag>
        <a-checkbox 
          :checked="selected"
          @change="onSelectionChange"
          class="select-checkbox"
        />
      </a-space>
    </template>
    
    <a-space direction="vertical" size="small" style="width: 100%">
      <!-- Device Info -->
      <div class="device-info">
        <a-tag color="default">{{ device.room || '未分类' }}</a-tag>
        <a-tag :color="getStatusColor(device.status)" v-if="device.status">
          {{ getStatusText(device.status) }}
        </a-tag>
      </div>

      <!-- IP Address -->
      <div class="device-ip">
        <GlobalOutlined />
        <span>{{ device.ip }}</span>
      </div>

      <!-- Power Control Buttons -->
      <div class="power-controls">
        <a-space>
          <a-button 
            type="primary" 
            size="small"
            :loading="device.powering === 'on'"
            :disabled="device.powering !== false"
            @click="$emit('power-control', device.id, 'powerOn')"
          >
            <PoweroffOutlined />
            开机
          </a-button>
          <a-button 
            danger 
            size="small"
            :loading="device.powering === 'off'"
            :disabled="device.powering !== false"
            @click="$emit('power-control', device.id, 'powerOff')"
          >
            <PoweroffOutlined />
            关机
          </a-button>
          <a-button 
            size="small"
            :loading="device.checking"
            @click="checkStatus"
          >
            <SyncOutlined />
            状态
          </a-button>
        </a-space>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <a-space>
          <a-button 
            size="small"
            @click="testConnection"
            :loading="testing"
          >
            <ExperimentOutlined />
            测试
          </a-button>
          <a-button 
            size="small"
            @click="$emit('edit', device)"
          >
            <EditOutlined />
            编辑
          </a-button>
          <a-popconfirm
            title="确定要删除这个设备吗？"
            @confirm="$emit('delete', device.id)"
          >
            <a-button size="small" danger>
              <DeleteOutlined />
              删除
            </a-button>
          </a-popconfirm>
        </a-space>
      </div>

      <!-- Advanced Settings (Collapsible) -->
      <a-collapse v-if="showAdvanced" size="small" ghost>
        <a-collapse-panel key="1" header="高级设置">
          <div v-if="device.type === 'tcp'">
            <h4>TCP 命令</h4>
            <div class="command-info">
              <div>开机: {{ device.tcpCommands?.powerOn || 'PWR ON\\r\\n' }}</div>
              <div>关机: {{ device.tcpCommands?.powerOff || 'PWR OFF\\r\\n' }}</div>
              <div>状态: {{ device.tcpCommands?.status || 'PWR?\\r\\n' }}</div>
            </div>
          </div>
          <div v-if="device.type === 'http'">
            <h4>HTTP 路径</h4>
            <div class="command-info">
              <div>开机: {{ device.httpUrls?.powerOn || '/api/power/on' }}</div>
              <div>关机: {{ device.httpUrls?.powerOff || '/api/power/off' }}</div>
              <div>状态: {{ device.httpUrls?.status || '/api/status' }}</div>
            </div>
          </div>
        </a-collapse-panel>
      </a-collapse>
    </a-space>
  </a-card>
</template>

<script setup>
import { ref } from 'vue';
import { message } from 'ant-design-vue';
import { 
  GlobalOutlined, 
  PoweroffOutlined, 
  SyncOutlined, 
  ExperimentOutlined, 
  EditOutlined, 
  DeleteOutlined 
} from '@ant-design/icons-vue';

const props = defineProps({
  device: {
    type: Object,
    required: true
  },
  selected: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['select', 'power-control', 'edit', 'delete']);

const showAdvanced = ref(false);
const testing = ref(false);

const onSelectionChange = (e) => {
  emit('select', props.device.id, e.target.checked);
};

const getStatusColor = (status) => {
  switch (status) {
    case 'online': return 'green';
    case 'offline': return 'red';
    case 'unknown': return 'default';
    default: return 'default';
  }
};

const getStatusText = (status) => {
  switch (status) {
    case 'online': return '在线';
    case 'offline': return '离线';
    case 'unknown': return '未知';
    default: return '未知';
  }
};

const checkStatus = async () => {
  try {
    if (!window.electronAPI || !window.electronAPI.deviceControl) {
      throw new Error('electronAPI 未初始化');
    }
    
    props.device.checking = true;
    const result = await window.electronAPI.deviceControl(props.device.id, 'status');
    
    if (result.success) {
      props.device.status = 'online';
      message.info(`${props.device.name} 状态: 在线`);
    } else {
      props.device.status = 'offline';
      message.warning(`${props.device.name} 状态: 离线`);
    }
  } catch (error) {
    props.device.status = 'offline';
    message.error(`状态查询失败: ${error.message}`);
  } finally {
    props.device.checking = false;
  }
};

const testConnection = async () => {
  const startTime = Date.now();
  
  try {
    if (!window.electronAPI || !window.electronAPI.deviceControl) {
      throw new Error('electronAPI 未初始化');
    }
    
    testing.value = true;
    
    // Enhanced connection test with multiple attempts
    let attempts = 0;
    const maxAttempts = 3;
    let lastError = null;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        const result = await Promise.race([
          window.electronAPI.deviceControl(props.device.id, 'status'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('连接超时 (5秒)')), 5000)
          )
        ]);
        
        const responseTime = Date.now() - startTime;
        
        if (result.success) {
          message.success(`连接测试成功: ${props.device.name} (${responseTime}ms, 尝试 ${attempts}/${maxAttempts})`);
          props.device.status = 'online';
          
          // Enhanced success feedback with response details
          if (result.response) {
            console.log(`设备响应详情 [${props.device.name}]:`, result.response);
          }
          
          return; // Success, exit the retry loop
        } else {
          lastError = new Error(result.error || '未知错误');
          throw lastError;
        }
      } catch (error) {
        lastError = error;
        
        if (attempts < maxAttempts) {
          console.log(`连接尝试 ${attempts} 失败，${props.device.name}: ${error.message}，将重试...`);
          // Wait 1 second before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // All attempts failed
    const responseTime = Date.now() - startTime;
    message.error(`连接测试失败: ${props.device.name} (${responseTime}ms, ${maxAttempts}次尝试) - ${lastError?.message}`);
    props.device.status = 'offline';
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    message.error(`测试异常: ${props.device.name} (${responseTime}ms) - ${error.message}`);
    props.device.status = 'offline';
  } finally {
    testing.value = false;
  }
};
</script>

<style scoped>
.device-card {
  width: 100%;
  min-width: 300px;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.device-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.device-card.selected {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

@media (max-width: 1200px) {
  .device-card {
    min-width: 280px;
  }
}

.select-checkbox {
  margin-left: 8px;
}

.device-info {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.device-ip {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-family: monospace;
}

.power-controls, .action-buttons {
  width: 100%;
}

.power-controls .ant-space,
.action-buttons .ant-space {
  width: 100%;
  justify-content: center;
}

.command-info {
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}

.command-info > div {
  margin-bottom: 4px;
  font-family: monospace;
  background: #f5f5f5;
  padding: 2px 4px;
  border-radius: 3px;
}

h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
}
</style>