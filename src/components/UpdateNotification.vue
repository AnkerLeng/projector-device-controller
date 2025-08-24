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
          v-if="!updateDownloaded"
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
        
        <!-- 重启安装按钮 -->
        <a-button 
          v-if="updateDownloaded"
          type="primary" 
          danger
          block 
          @click="restartAndInstall"
        >
          <template #icon>
            <SyncOutlined />
          </template>
          重启并安装更新
        </a-button>
        
        <!-- 显示更新信息 -->
        <div v-if="updateDownloaded && updateInfo" class="update-info">
          <a-alert
            :message="`新版本 v${updateInfo.version} 已下载完成`"
            type="success"
            size="small"
            show-icon
          />
        </div>
        
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
const updateDownloaded = ref(false);
const updateInfo = ref(null);

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
      if (result.isUpToDate) {
        message.info('当前版本已是最新版本');
      } else if (result.hasUpdate) {
        message.success(`${result.message}，您可以前往GitHub下载`);
        // 显示下载链接或直接打开下载页面
        console.log('Download URL:', result.downloadUrl);
      } else {
        message.success('更新检查已启动，如有可用更新将自动下载');
      }
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

// 处理重启安装更新
const restartAndInstall = async () => {
  try {
    await window.electronAPI.restartAndInstallUpdate();
  } catch (error) {
    console.error('Failed to restart and install:', error);
    message.error('重启安装失败');
  }
};

// 组件挂载时加载状态
onMounted(() => {
  loadUpdateStatus();
  
  // 监听更新事件
  window.electronAPI.onUpdateAvailable((event, info) => {
    console.log('Update available:', info);
    message.info(`发现新版本 v${info.version}，正在下载...`);
    showUpdateInfo.value = true;
  });
  
  window.electronAPI.onUpdateNotAvailable((event, info) => {
    console.log('No updates available:', info);
    message.info('当前版本已是最新版本');
  });
  
  window.electronAPI.onUpdateDownloaded((event, info) => {
    updateDownloaded.value = true;
    updateInfo.value = info;
    message.success(`v${info.version} 下载完成，可以重启安装`, 0); // 持续显示
    showUpdateInfo.value = true; // 显示更新面板
  });
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