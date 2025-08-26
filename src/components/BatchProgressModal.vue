<template>
  <a-modal
    :open="visible"
    :title="modalTitle"
    :width="600"
    :closable="!isRunning"
    :maskClosable="!isRunning"
    @cancel="handleCancel"
    :footer="null"
  >
    <div class="batch-progress-container">
      <!-- 总体进度 -->
      <div class="overall-progress">
        <div class="progress-header">
          <h4>总体进度</h4>
          <span class="progress-text">{{ completedCount }}/{{ totalCount }}</span>
        </div>
        <a-progress 
          :percent="overallPercent" 
          :status="progressStatus"
          :stroke-color="{
            '0%': '#108ee9',
            '100%': '#87d068',
          }"
        />
        <div class="progress-stats">
          <a-space>
            <a-tag color="success">成功: {{ successCount }}</a-tag>
            <a-tag color="error" v-if="failedCount > 0">失败: {{ failedCount }}</a-tag>
            <a-tag color="default" v-if="cancelledCount > 0">取消: {{ cancelledCount }}</a-tag>
            <a-tag color="processing" v-if="runningCount > 0">执行中: {{ runningCount }}</a-tag>
          </a-space>
        </div>
      </div>

      <!-- 设备详细状态列表 -->
      <div class="device-list">
        <div class="device-list-header">
          <h4>设备执行状态</h4>
          <a-switch 
            v-model:checked="showOnlyActive" 
            size="small"
            :disabled="isRunning"
          >
            <template #checkedChildren>仅显示活动</template>
            <template #unCheckedChildren>显示全部</template>
          </a-switch>
        </div>
        
        <div class="device-items" ref="deviceListRef">
          <div 
            v-for="item in filteredDeviceItems" 
            :key="item.deviceId"
            class="device-item"
            :class="`status-${item.status}`"
          >
            <div class="device-info">
              <div class="device-header">
                <span class="device-name">{{ item.deviceName }}</span>
                <span class="device-ip">{{ item.deviceIp }}</span>
              </div>
              <div class="device-type">
                <a-tag :color="getTypeColor(item.deviceType)" size="small">
                  {{ getTypeText(item.deviceType) }}
                </a-tag>
              </div>
            </div>
            
            <div class="device-status">
              <div class="status-content">
                <div class="status-icon">
                  <a-spin v-if="item.status === 'running'" size="small" />
                  <CheckCircleOutlined 
                    v-else-if="item.status === 'success'" 
                    style="color: #52c41a" 
                  />
                  <CloseCircleOutlined 
                    v-else-if="item.status === 'failed'" 
                    style="color: #ff4d4f" 
                  />
                  <ClockCircleOutlined 
                    v-else-if="item.status === 'pending'" 
                    style="color: #d9d9d9" 
                  />
                  <SyncOutlined 
                    v-else-if="item.status === 'retrying'" 
                    spin 
                    style="color: #faad14" 
                  />
                  <MinusCircleOutlined 
                    v-else-if="item.status === 'cancelled'" 
                    style="color: #8c8c8c" 
                  />
                </div>
                
                <div class="status-text">
                  <div class="status-main">{{ getStatusText(item.status) }}</div>
                  <div class="status-detail" v-if="item.message">{{ item.message }}</div>
                  <div class="retry-info" v-if="item.attempts > 1">
                    重试第 {{ item.attempts - 1 }} 次
                  </div>
                </div>
              </div>
              
              <div class="status-time" v-if="item.finishedAt">
                {{ formatDuration(item.startedAt, item.finishedAt) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <a-space>
          <a-button 
            v-if="isRunning" 
            type="primary" 
            danger
            @click="handleCancel"
            :loading="cancelling"
          >
            <StopOutlined />
            取消操作
          </a-button>
          <a-button 
            v-else-if="isCompleted"
            type="primary"
            @click="handleClose"
          >
            关闭
          </a-button>
          <a-button 
            v-if="isCompleted && failedCount > 0"
            @click="retryFailedDevices"
            :loading="retrying"
          >
            <RedoOutlined />
            重试失败设备
          </a-button>
          <a-button 
            v-if="isCompleted"
            @click="exportResults"
            type="dashed"
          >
            <DownloadOutlined />
            导出结果
          </a-button>
        </a-space>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { message } from 'ant-design-vue';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined,
  MinusCircleOutlined,
  SyncOutlined,
  StopOutlined,
  RedoOutlined,
  DownloadOutlined
} from '@ant-design/icons-vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  action: {
    type: String,
    default: 'powerOn' // powerOn, powerOff, status
  },
  devices: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits([
  'update:visible', 
  'cancel', 
  'complete', 
  'retry-failed'
]);

// 响应式数据
const deviceItems = ref([]);
const isRunning = ref(false);
const isCompleted = ref(false);
const cancelling = ref(false);
const retrying = ref(false);
const showOnlyActive = ref(true);
const deviceListRef = ref();

// 计算属性
const modalTitle = computed(() => {
  const actionText = {
    'powerOn': '批量开机',
    'powerOff': '批量关机',
    'status': '批量状态查询'
  }[props.action] || '批量操作';
  
  if (isRunning.value) {
    return `${actionText} - 执行中...`;
  } else if (isCompleted.value) {
    return `${actionText} - 已完成`;
  }
  return actionText;
});

const totalCount = computed(() => deviceItems.value.length);
const completedCount = computed(() => 
  deviceItems.value.filter(item => 
    item.status === 'success' || item.status === 'failed' || item.status === 'cancelled'
  ).length
);
const successCount = computed(() => 
  deviceItems.value.filter(item => item.status === 'success').length
);
const failedCount = computed(() => 
  deviceItems.value.filter(item => item.status === 'failed').length
);
const runningCount = computed(() => 
  deviceItems.value.filter(item => 
    item.status === 'running' || item.status === 'retrying'
  ).length
);
const cancelledCount = computed(() => 
  deviceItems.value.filter(item => item.status === 'cancelled').length
);

const overallPercent = computed(() => {
  if (totalCount.value === 0) return 0;
  return Math.round((completedCount.value / totalCount.value) * 100);
});

const progressStatus = computed(() => {
  if (isRunning.value) return 'active';
  if (failedCount.value > 0) return 'exception';
  if (isCompleted.value) return 'success';
  return 'normal';
});

const filteredDeviceItems = computed(() => {
  if (!showOnlyActive.value) return deviceItems.value;
  
  return deviceItems.value.filter(item => 
    item.status === 'running' || 
    item.status === 'retrying' || 
    item.status === 'failed' ||
    (item.status === 'success' && Date.now() - item.finishedAt < 3000) // 成功3秒内仍显示
  );
});

// 工具函数
const getTypeColor = (type) => {
  const colors = {
    'tcp': 'blue',
    'http': 'green', 
    'pc': 'purple'
  };
  return colors[type] || 'default';
};

const getTypeText = (type) => {
  const texts = {
    'tcp': 'TCP',
    'http': 'HTTP',
    'pc': 'PC'
  };
  return texts[type] || type?.toUpperCase();
};

const getStatusText = (status) => {
  const texts = {
    'pending': '等待执行',
    'running': '执行中',
    'success': '执行成功',
    'failed': '执行失败',
    'retrying': '重试中',
    'cancelled': '已取消'
  };
  return texts[status] || status;
};

const formatDuration = (start, end) => {
  const duration = end - start;
  if (duration < 1000) return `${duration}ms`;
  return `${(duration / 1000).toFixed(1)}s`;
};

// 方法
const initializeDeviceItems = () => {
  deviceItems.value = props.devices.map(device => ({
    deviceId: device.id,
    deviceName: device.name,
    deviceIp: device.ip,
    deviceType: device.type,
    status: 'pending',
    message: '',
    attempts: 0,
    startedAt: null,
    finishedAt: null
  }));
};

const updateDeviceStatus = (deviceId, status, message = '', attempts = 1) => {
  const item = deviceItems.value.find(item => item.deviceId === deviceId);
  if (item) {
    item.status = status;
    item.message = message;
    item.attempts = attempts;
    
    if (status === 'running' && !item.startedAt) {
      item.startedAt = Date.now();
    }
    
    if (status === 'success' || status === 'failed') {
      item.finishedAt = Date.now();
    }
    
    // 自动滚动到活动设备
    if (status === 'running' || status === 'retrying') {
      nextTick(() => {
        const element = deviceListRef.value?.querySelector(`[key="${deviceId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }
};

const handleCancel = () => {
  if (isRunning.value) {
    cancelling.value = true;
    message.warning('正在取消批量操作...');
    
    // 发送取消事件给父组件，让父组件处理实际的取消逻辑
    emit('cancel');
  } else {
    emit('update:visible', false);
    emit('cancel');
  }
};

const handleClose = () => {
  emit('update:visible', false);
  emit('complete', {
    total: totalCount.value,
    success: successCount.value,
    failed: failedCount.value,
    results: deviceItems.value
  });
};

const retryFailedDevices = () => {
  const failedDevices = deviceItems.value
    .filter(item => item.status === 'failed')
    .map(item => ({ 
      id: item.deviceId, 
      name: item.deviceName, 
      ip: item.deviceIp,
      type: item.deviceType 
    }));
  
  retrying.value = true;
  emit('retry-failed', failedDevices);
  
  setTimeout(() => {
    retrying.value = false;
  }, 1000);
};

const exportResults = () => {
  const results = {
    action: props.action,
    timestamp: new Date().toISOString(),
    summary: {
      total: totalCount.value,
      success: successCount.value,
      failed: failedCount.value
    },
    devices: deviceItems.value.map(item => ({
      deviceName: item.deviceName,
      deviceIp: item.deviceIp,
      deviceType: item.deviceType,
      status: item.status,
      message: item.message,
      attempts: item.attempts,
      duration: item.finishedAt ? formatDuration(item.startedAt, item.finishedAt) : null
    }))
  };
  
  const dataStr = JSON.stringify(results, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = `batch-${props.action}-${new Date().toISOString().slice(0, 19)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  message.success('执行结果已导出');
};

// 公共方法供父组件调用
const startBatchOperation = () => {
  initializeDeviceItems();
  isRunning.value = true;
  isCompleted.value = false;
  showOnlyActive.value = true;
};

const updateProgress = (deviceId, status, message, attempts) => {
  updateDeviceStatus(deviceId, status, message, attempts);
};

const cancelBatchOperation = () => {
  isRunning.value = false;
  isCompleted.value = true;
  cancelling.value = false;
  
  // 将未完成的设备标记为取消
  deviceItems.value.forEach(item => {
    if (item.status === 'pending' || item.status === 'running') {
      item.status = 'cancelled';
      item.statusText = '已取消';
    }
  });
  
  message.info('批量操作已取消');
};

const completeBatchOperation = () => {
  isRunning.value = false;
  isCompleted.value = true;
  cancelling.value = false;
  
  // 显示完成提示
  if (failedCount.value === 0) {
    message.success(`批量操作完成，全部 ${successCount.value} 个设备执行成功`);
  } else if (successCount.value === 0) {
    message.error(`批量操作完成，全部 ${failedCount.value} 个设备执行失败`);
  } else {
    message.warning(`批量操作完成，成功 ${successCount.value} 个，失败 ${failedCount.value} 个`);
  }
};

// 监听属性变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    initializeDeviceItems();
  }
});

// 暴露方法给父组件
defineExpose({
  startBatchOperation,
  updateProgress,
  completeBatchOperation,
  cancelBatchOperation,
  updateDeviceStatus
});
</script>

<style scoped>
.batch-progress-container {
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.overall-progress {
  margin-bottom: 24px;
  padding: 16px;
  background: #fafafa;
  border-radius: 6px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.progress-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.progress-text {
  font-size: 14px;
  color: #666;
}

.progress-stats {
  margin-top: 12px;
  display: flex;
  justify-content: center;
}

.device-list {
  flex: 1;
  min-height: 300px;
  max-height: 400px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.device-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.device-list-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.device-items {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background: #fff;
}

.device-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  transition: all 0.2s;
}

.device-item:last-child {
  border-bottom: none;
}

.device-item.status-running {
  background: #e6f7ff;
  border-left: 3px solid #1890ff;
}

.device-item.status-success {
  background: #f6ffed;
  border-left: 3px solid #52c41a;
}

.device-item.status-failed {
  background: #fff2f0;
  border-left: 3px solid #ff4d4f;
}

.device-item.status-retrying {
  background: #fffbe6;
  border-left: 3px solid #faad14;
}

.device-info {
  flex: 1;
  min-width: 0;
}

.device-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.device-name {
  font-weight: 500;
  color: #262626;
}

.device-ip {
  font-size: 12px;
  color: #8c8c8c;
  font-family: monospace;
}

.device-type {
  margin-top: 4px;
}

.device-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 120px;
}

.status-content {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.status-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-text {
  text-align: right;
}

.status-main {
  font-size: 13px;
  font-weight: 500;
  color: #262626;
}

.status-detail {
  font-size: 11px;
  color: #8c8c8c;
  margin-top: 2px;
  max-width: 200px;
  word-break: break-all;
}

.retry-info {
  font-size: 11px;
  color: #faad14;
  margin-top: 2px;
}

.status-time {
  font-size: 11px;
  color: #8c8c8c;
  font-family: monospace;
}

.action-buttons {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
}

/* 滚动条样式 */
.device-items::-webkit-scrollbar {
  width: 6px;
}

.device-items::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.device-items::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.device-items::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .device-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .device-status {
    align-items: flex-start;
    width: 100%;
    margin-top: 8px;
  }
  
  .status-content {
    justify-content: flex-start;
  }
  
  .status-text {
    text-align: left;
  }
}
</style>