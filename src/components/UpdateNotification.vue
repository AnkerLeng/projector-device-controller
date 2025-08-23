<template>
  <div class="update-notification">
    <!-- 更新状态显示 -->
    <a-card 
      v-if="showUpdateInfo" 
      class="update-card" 
      size="small"
      :style="{ 
        position: 'fixed', 
        top: '16px', 
        right: '16px', 
        zIndex: 1000,
        maxWidth: '350px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }"
    >
      <template #title>
        <div style="display: flex; align-items: center; gap: 8px;">
          <CloudDownloadOutlined :style="{ color: '#1890ff' }" />
          应用更新
        </div>
      </template>
      
      <template #extra>
        <a-button 
          type="text" 
          size="small" 
          @click="hideUpdateInfo"
        >
          <CloseOutlined />
        </a-button>
      </template>

      <!-- 当前版本信息 -->
      <div style="margin-bottom: 12px;">
        <a-tag color="blue" style="margin-right: 8px;">
          当前版本: {{ currentVersion }}
        </a-tag>
        <a-tag :color="updateStatus.autoUpdaterEnabled ? 'green' : 'orange'">
          {{ updateStatus.autoUpdaterEnabled ? '自动更新已启用' : '开发模式' }}
        </a-tag>
      </div>

      <!-- 更新检查按钮 -->
      <a-space direction="vertical" style="width: 100%;">
        <a-button 
          type="primary" 
          block 
          :loading="checking"
          :disabled="updateStatus.isDev"
          @click="checkForUpdates"
        >
          <template #icon>
            <SyncOutlined />
          </template>
          检查更新
        </a-button>
        
        <div v-if="updateStatus.isDev" class="dev-notice">
          <a-alert
            message="开发模式下不会检查更新"
            type="info"
            size="small"
            show-icon
          />
        </div>
      </a-space>
    </a-card>

    <!-- 版本信息按钮 -->
    <a-button
      v-if="!showUpdateInfo"
      type="text"
      size="small"
      class="version-button"
      @click="toggleUpdateInfo"
      :style="{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 999,
        opacity: 0.7
      }"
    >
      v{{ currentVersion }}
    </a-button>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { 
  CloudDownloadOutlined,
  CloseOutlined,
  SyncOutlined
} from '@ant-design/icons-vue';

const showUpdateInfo = ref(false);
const checking = ref(false);
const currentVersion = ref('1.0.0');

const updateStatus = reactive({
  isDev: false,
  autoUpdaterEnabled: false
});

// 获取应用版本和更新状态
const loadUpdateStatus = async () => {
  try {
    const version = await window.electronAPI.getAppVersion();
    const status = await window.electronAPI.getUpdateStatus();
    
    currentVersion.value = version;
    Object.assign(updateStatus, status);
    
    console.log('Update status loaded:', { version, status });
  } catch (error) {
    console.error('Failed to load update status:', error);
    message.error('无法获取应用版本信息');
  }
};

// 检查更新
const checkForUpdates = async () => {
  if (updateStatus.isDev) {
    message.info('开发模式下无法检查更新');
    return;
  }

  checking.value = true;
  
  try {
    const result = await window.electronAPI.checkForUpdates();
    
    if (result.success) {
      message.success('更新检查已启动，如有可用更新将自动下载');
    } else {
      message.warning(result.error || '更新检查失败');
    }
  } catch (error) {
    console.error('Update check failed:', error);
    message.error('检查更新时发生错误');
  } finally {
    checking.value = false;
  }
};

// 显示/隐藏更新信息
const toggleUpdateInfo = () => {
  showUpdateInfo.value = !showUpdateInfo.value;
};

const hideUpdateInfo = () => {
  showUpdateInfo.value = false;
};

// 组件挂载时加载状态
onMounted(() => {
  loadUpdateStatus();
});
</script>

<style scoped>
.update-notification {
  /* 确保组件不影响页面布局 */
}

.update-card {
  /* 卡片样式在模板中内联定义 */
}

.version-button {
  font-size: 12px;
  color: #999;
  transition: all 0.3s ease;
}

.version-button:hover {
  opacity: 1 !important;
  color: #1890ff;
}

.dev-notice {
  margin-top: 8px;
}

/* Ant Design 样式覆盖 */
:deep(.ant-card-head) {
  padding: 8px 12px;
  min-height: auto;
}

:deep(.ant-card-body) {
  padding: 12px;
}

:deep(.ant-card-head-title) {
  font-size: 14px;
  font-weight: 500;
}
</style>