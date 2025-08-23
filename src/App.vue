<template>
  <a-app>
    <a-layout class="app-layout">
    <!-- Header -->
    <a-layout-header class="header">
      <div class="header-content">
        <h1 class="title">
          <DesktopOutlined />
          投影设备管理器
        </h1>
        <a-space>
          <a-button type="primary" @click="showAddDeviceModal = true" data-tour="add-device">
            <PlusOutlined />
            添加设备
          </a-button>
          <a-badge :count="onlineDevices" status="success">
            <a-button @click="refreshAllStatus">
              <SyncOutlined />
              刷新状态
            </a-button>
          </a-badge>
          <a-button @click="showDeviceGroupModal = true">
            <BuildOutlined />
            设备组管理
          </a-button>
          <a-button 
            @click="toggleMonitoring" 
            :type="monitoringEnabled ? 'primary' : 'default'"
            :loading="false"
          >
            <SyncOutlined :spin="monitoringEnabled" />
            实时监控
          </a-button>
          <a-dropdown>
            <template #overlay>
              <a-menu @click="handleConfigMenu">
                <a-menu-item key="export">
                  <DownloadOutlined />
                  导出配置
                </a-menu-item>
                <a-menu-item key="import">
                  <UploadOutlined />
                  导入配置
                </a-menu-item>
              </a-menu>
            </template>
            <a-button>
              <SettingOutlined />
              配置管理
              <DownOutlined />
            </a-button>
          </a-dropdown>
          <a-button @click="toggleLogs" :type="showLogs ? 'primary' : 'default'" data-tour="logs">
            <FileTextOutlined />
            操作日志
            <a-badge v-if="logs.length > 0" :count="logs.length" :offset="[8, -2]" />
          </a-button>
        </a-space>
      </div>
    </a-layout-header>

    <a-layout>
      <!-- Sidebar -->
      <a-layout-sider width="250" theme="light" class="sidebar">
        <div class="sidebar-content">
          <div class="room-header">
            <h3>房间管理</h3>
            <a-button 
              type="primary" 
              size="small" 
              @click="showAddRoomModal = true"
              :icon="h(PlusOutlined)"
            >
              添加房间
            </a-button>
          </div>
          <a-menu
            v-model:selectedKeys="selectedRoom"
            mode="inline"
            @click="handleRoomSelect"
            class="room-menu"
          >
            <a-menu-item key="all" class="room-menu-item">
              <div class="room-item-content">
                <div class="room-icon-name">
                  <HomeOutlined />
                  <span class="room-name">所有设备</span>
                </div>
                <div class="room-actions">
                  <a-badge :count="devices.length" :numberStyle="{ fontSize: '10px' }" />
                </div>
              </div>
            </a-menu-item>
            <a-menu-item v-for="room in rooms" :key="room.name" class="room-menu-item">
              <div class="room-item-content">
                <div class="room-icon-name">
                  <BuildOutlined />
                  <span class="room-name" :title="room.name">{{ room.name }}</span>
                </div>
                <div class="room-actions">
                  <a-dropdown :trigger="['click']" v-if="room.name !== '未分类'" @click.stop>
                    <template #overlay>
                      <a-menu @click="handleRoomMenuClick($event, room)">
                        <a-menu-item key="edit">
                          <EditOutlined />
                          编辑房
                        </a-menu-item>
                        <a-menu-item key="delete" :disabled="room.deviceCount > 0">
                          <DeleteOutlined />
                          删除房间
                        </a-menu-item>
                      </a-menu>
                    </template>
                    <a-button type="text" size="small" class="room-more-btn">
                      <MoreOutlined />
                    </a-button>
                  </a-dropdown>
                  <a-badge :count="room.deviceCount" :numberStyle="{ fontSize: '10px' }" />
                </div>
              </div>
            </a-menu-item>
          </a-menu>
        </div>
      </a-layout-sider>

      <!-- Main Content -->
      <a-layout-content class="content">
        <!-- Room Control Panel -->
        <div class="control-panel">
          <div class="control-panel-left">
            <h3>{{ selectedRoom[0] === 'all' ? '所有设备' : selectedRoom[0] }}</h3>
            <span class="device-count">{{ filteredDevices.length }} 台设备</span>
          </div>
          <div class="control-panel-right">
            <a-space>
              <a-button 
                v-if="filteredDevices.length > 0"
                @click="selectAllCurrentRoom"
                :disabled="selectedDevices.length === filteredDevices.length"
              >
                全选当前房间 ({{ filteredDevices.length }})
              </a-button>
              <a-button 
                v-if="selectedDevices.length > 0"
                @click="selectedDevices = []"
              >
                <CloseOutlined />
                取消选择 ({{ selectedDevices.length }})
              </a-button>
            </a-space>
          </div>
        </div>

        <!-- Enhanced Batch Control Panel -->
        <div v-if="selectedDevices.length > 0" class="batch-panel">
          <a-card title="批量控制" size="small">
            <template #extra>
              <a-space>
                <a-button size="small" @click="saveSelectedAsGroup">
                  <BuildOutlined />
                  保存为设备组
                </a-button>
                <a-button size="small" @click="selectedDevices = []">
                  <CloseOutlined />
                  取消 ({{ selectedDevices.length }})
                </a-button>
              </a-space>
            </template>
            
            <a-row :gutter="16">
              <a-col :span="12">
                <a-space direction="vertical" style="width: 100%">
                  <a-button 
                    type="primary" 
                    block
                    :loading="batchLoading"
                    @click="batchPowerControl('powerOn')"
                  >
                    <PoweroffOutlined />
                    批量开机 ({{ selectedDevices.length }})
                  </a-button>
                  <a-button 
                    danger 
                    block
                    :loading="batchLoading"
                    @click="batchPowerControl('powerOff')"
                  >
                    <PoweroffOutlined />
                    批量关机 ({{ selectedDevices.length }})
                  </a-button>
                </a-space>
              </a-col>
              <a-col :span="12">
                <a-space direction="vertical" style="width: 100%">
                  <a-button 
                    block
                    :loading="batchLoading"
                    @click="batchPowerControl('status')"
                  >
                    <SyncOutlined />
                    批量状态查询
                  </a-button>
                  <a-button 
                    block
                    :loading="batchLoading"
                    @click="batchTestConnection"
                  >
                    <ExperimentOutlined />
                    批量连接测试
                  </a-button>
                </a-space>
              </a-col>
            </a-row>
            
            <!-- Quick Group Actions -->
            <a-divider orientation="left" plain v-if="deviceGroups.length > 0">快捷设备组</a-divider>
            <a-space wrap v-if="deviceGroups.length > 0">
              <a-dropdown v-for="group in deviceGroups" :key="group.id">
                <template #overlay>
                  <a-menu @click="({ key }) => handleGroupAction(group, key)">
                    <a-menu-item key="powerOn">
                      <PoweroffOutlined />
                      批量开机
                    </a-menu-item>
                    <a-menu-item key="powerOff">
                      <PoweroffOutlined />
                      批量关机
                    </a-menu-item>
                    <a-menu-item key="status">
                      <SyncOutlined />
                      状态查询
                    </a-menu-item>
                    <a-menu-divider />
                    <a-menu-item key="select">
                      <BuildOutlined />
                      选择设备
                    </a-menu-item>
                    <a-menu-item key="edit">
                      <EditOutlined />
                      编辑设备组
                    </a-menu-item>
                  </a-menu>
                </template>
                <a-tag 
                  color="processing" 
                  style="cursor: pointer; margin-bottom: 8px"
                  :title="`${group.deviceIds.length} 个设备`"
                >
                  {{ group.name }} ({{ group.deviceIds.length }})
                  <DownOutlined />
                </a-tag>
              </a-dropdown>
            </a-space>
          </a-card>
        </div>

        <!-- Device Grid -->
        <div class="device-grid">
          <div 
            v-for="device in filteredDevices" 
            :key="device.id"
            class="device-card-wrapper"
          >
            <DeviceCard 
              :device="device"
              :selected="selectedDevices.includes(device.id)"
              @select="toggleDeviceSelection"
              @power-control="handleDevicePowerControl"
              @edit="editDevice"
              @delete="deleteDevice"
            />
          </div>
        </div>

        <!-- Operation Logs -->
        <div v-if="showLogs" class="logs-panel">
          <a-card title="操作日志" size="small">
            <template #extra>
              <a-space>
                <a-button size="small" @click="clearLogs">清空日志</a-button>
                <a-button size="small" @click="showLogs = false">关闭</a-button>
              </a-space>
            </template>
            <div class="logs-content">
              <div 
                v-for="log in logs" 
                :key="log.id"
                class="log-entry"
                :class="`log-${log.level}`"
              >
                <div>
                  <span class="log-time">{{ formatTime(log.timestamp) }}</span>
                  <span class="log-level">{{ log.level.toUpperCase() }}</span>
                  <span class="log-message">{{ log.message }}</span>
                </div>
                <div v-if="log.details" class="log-details">
                  <pre>{{ JSON.stringify(log.details, null, 2) }}</pre>
                </div>
              </div>
              <div v-if="logs.length === 0" class="no-logs">暂无日志记录</div>
            </div>
          </a-card>
        </div>

        <!-- Empty State -->
        <div v-if="filteredDevices.length === 0" class="empty-state">
          <a-empty description="暂无设备">
            <a-button type="primary" @click="showAddDeviceModal = true">
              添加第一个设备
            </a-button>
          </a-empty>
        </div>
      </a-layout-content>
    </a-layout>

    <!-- Add/Edit Device Modal -->
    <AddDeviceModal 
      v-model:visible="showAddDeviceModal"
      :device="editingDevice"
      :rooms="rooms"
      @save="handleSaveDevice"
    />

    <!-- Add/Edit Room Modal -->
    <a-modal
      v-model:open="showAddRoomModal"
      :title="editingRoom ? '编辑房间' : '添加房间'"
      @ok="handleSaveRoom"
      @cancel="handleCancelRoom"
      :confirmLoading="roomLoading"
    >
      <a-form
        ref="roomFormRef"
        :model="roomForm"
        :rules="roomRules"
        layout="vertical"
      >
        <a-form-item
          label="房间名称"
          name="name"
        >
          <a-input
            v-model:value="roomForm.name"
            placeholder="请输入房间名称"
            :maxlength="20"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- Delete Room Confirmation -->
    <a-modal
      v-model:open="showDeleteRoomModal"
      title="确认删除房间"
      @ok="confirmDeleteRoom"
      @cancel="showDeleteRoomModal = false"
      :confirmLoading="roomLoading"
      okType="danger"
    >
      <p>确定要删除房间 "{{ deletingRoom?.name }}" 吗？</p>
      <p style="color: #ff4d4f; font-size: 12px;">注意：只有空房间才能被删除。如果房间内有设备，请先将设备移动到其他房间。</p>
    </a-modal>

    <!-- Device Group Management Modal -->
    <DeviceGroup
      v-model:open="showDeviceGroupModal"
      :devices="devices"
      :group="editingGroup"
      :editing="!!editingGroup"
      @save="handleSaveGroup"
      @delete="handleDeleteGroup"
    />

    <!-- Float Button for Scroll to Top -->
    <a-float-button
      type="default"
      :style="{ right: '24px', bottom: '24px' }"
      @click="scrollToTop"
      v-if="showScrollTop"
    >
      <template #icon>
        <UpOutlined />
      </template>
    </a-float-button>

    <!-- Tour Component for User Guidance -->
    <a-tour
      v-model:current="tourCurrent"
      :open="tourOpen"
      :steps="tourSteps"
      @close="closeTour"
      @finish="finishTour"
      type="primary"
    />

    <!-- Tour Trigger Button -->
    <a-float-button
      :style="{ right: '24px', bottom: '80px' }"
      @click="startTour"
      type="primary"
      tooltip="用户指南"
    >
      <template #icon>
        <QuestionCircleOutlined />
      </template>
    </a-float-button>
  </a-layout>
  </a-app>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive, h } from 'vue';
import { message, notification } from 'ant-design-vue';
import { 
  DesktopOutlined, 
  PlusOutlined, 
  SyncOutlined, 
  HomeOutlined, 
  BuildOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  PoweroffOutlined,
  CloseOutlined,
  DownloadOutlined,
  UploadOutlined,
  SettingOutlined,
  DownOutlined,
  FileTextOutlined,
  UpOutlined,
  QuestionCircleOutlined,
  ExperimentOutlined
} from '@ant-design/icons-vue';
import DeviceCard from './components/DeviceCard.vue';
import AddDeviceModal from './components/AddDeviceModal.vue';
import DeviceGroup from './components/DeviceGroup.vue';

// Reactive data
const devices = ref([]);
const selectedRoom = ref(['all']);
const selectedDevices = ref([]);
const showAddDeviceModal = ref(false);
const editingDevice = ref(null);
const batchLoading = ref(false);

// Room management state
const showAddRoomModal = ref(false);
const showDeleteRoomModal = ref(false);
const editingRoom = ref(null);
const deletingRoom = ref(null);
const roomLoading = ref(false);
const roomFormRef = ref();
const roomForm = reactive({
  name: ''
});
const roomRules = {
  name: [
    { required: true, message: '请输入房间名称', trigger: 'blur' },
    { min: 1, max: 20, message: '房间名称长度应为1-20个字符', trigger: 'blur' },
    { validator: validateRoomName, trigger: 'blur' }
  ]
};

// 独立的房间列表管理
const customRooms = ref([]);

// Device groups management
const deviceGroups = ref([]);
const showDeviceGroupModal = ref(false);
const editingGroup = ref(null);

// 日志系统
const showLogs = ref(false);
const logs = ref([]);
const logId = ref(0);

// Scroll to top functionality
const showScrollTop = ref(false);

// Tour functionality
const tourOpen = ref(false);
const tourCurrent = ref(0);

// Real-time monitoring
const monitoringEnabled = ref(false);
const monitoringInterval = ref(null);
const monitoringIntervalTime = ref(30000); // 30 seconds default

// Tour steps configuration
const tourSteps = computed(() => [
  {
    title: '欢迎使用投影设备管理器',
    description: '这是一个功能强大的投影设备管理系统，支持TCP和HTTP协议控制。让我们开始了解主要功能。',
    target: () => document.querySelector('.title'),
    placement: 'bottomLeft'
  },
  {
    title: '添加设备',
    description: '点击此按钮添加新的投影设备。支持TCP和HTTP两种通信协议，可配置自定义命令。',
    target: () => document.querySelector('[data-tour="add-device"]') || document.querySelector('.header-content .ant-btn-primary'),
    placement: 'bottom'
  },
  {
    title: '房间管理',
    description: '在这里管理设备房间分类。可以创建、编辑和删除房间，方便设备分组管理。',
    target: () => document.querySelector('.sidebar'),
    placement: 'rightTop'
  },
  {
    title: '设备控制区域',
    description: '设备卡片显示区域。每个设备卡片包含开机、关机、状态查询等控制功能。支持单设备操作和批量操作。',
    target: () => document.querySelector('.device-grid') || document.querySelector('.content'),
    placement: 'topLeft'
  },
  {
    title: '批量控制',
    description: '选择多个设备后，这里会显示批量控制面板，支持批量开机、关机等操作，提高效率。',
    target: () => document.querySelector('.control-panel'),
    placement: 'bottom'
  },
  {
    title: '操作日志',
    description: '点击查看详细的操作日志，包括设备控制记录、错误信息等，方便问题排查。',
    target: () => document.querySelector('[data-tour="logs"]') || document.querySelector('.header-content .ant-btn:last-child'),
    placement: 'bottomLeft'
  },
  {
    title: '配置管理',
    description: '支持导出和导入设备配置，方便备份和迁移设备数据。',
    target: () => document.querySelector('.ant-dropdown'),
    placement: 'bottomLeft'
  }
]);

// Computed properties
const rooms = computed(() => {
  const roomMap = {};
  
  // 从设备数据中统计房间
  devices.value.forEach(device => {
    const roomName = device.room || '未分类';
    if (!roomMap[roomName]) {
      roomMap[roomName] = { name: roomName, deviceCount: 0 };
    }
    roomMap[roomName].deviceCount++;
  });
  
  // 添加自定义创建的空房间
  customRooms.value.forEach(roomName => {
    if (!roomMap[roomName]) {
      roomMap[roomName] = { name: roomName, deviceCount: 0 };
    }
  });
  
  return Object.values(roomMap);
});

const filteredDevices = computed(() => {
  if (selectedRoom.value[0] === 'all') {
    return devices.value;
  }
  return devices.value.filter(device => 
    (device.room || '未分类') === selectedRoom.value[0]
  );
});

const onlineDevices = computed(() => {
  return devices.value.filter(device => device.status === 'online').length;
});

// Methods
const loadDevices = async () => {
  try {
    // Check if electronAPI is available
    if (!window.electronAPI || !window.electronAPI.getDevices) {
      throw new Error('electronAPI 未初始化，请确保在 Electron 环境中运行应用');
    }
    
    const result = await window.electronAPI.getDevices();
    devices.value = result.map(device => ({
      ...device,
      status: 'unknown',
      powering: false,
      checking: false
    }));
  } catch (error) {
    console.error('Load devices error:', error);
    message.error('加载设备失败: ' + error.message);
  }
};

const handleRoomSelect = ({ key }) => {
  selectedRoom.value = [key];
  selectedDevices.value = []; // Clear selection when switching rooms
};

const toggleDeviceSelection = (deviceId, selected) => {
  const cleanDeviceId = String(deviceId);
  if (selected) {
    if (!selectedDevices.value.includes(cleanDeviceId)) {
      selectedDevices.value.push(cleanDeviceId);
    }
  } else {
    selectedDevices.value = selectedDevices.value.filter(id => String(id) !== cleanDeviceId);
  }
};

const selectAllCurrentRoom = () => {
  const currentRoomDeviceIds = filteredDevices.value.map(device => String(device.id));
  // 创建干净的设备ID数组，避免Vue响应式代理
  const cleanSelectedDevices = [...selectedDevices.value].map(id => String(id));
  selectedDevices.value = [...new Set([...cleanSelectedDevices, ...currentRoomDeviceIds])];
  
  message.success(`已选择当前房间的 ${currentRoomDeviceIds.length} 台设备`);
  console.log('全选后的设备ID列表:', selectedDevices.value);
  
  addLog('info', `全选房间设备`, { 
    room: selectedRoom.value[0], 
    deviceCount: currentRoomDeviceIds.length 
  });
};

// 日志系统方法
const addLog = (level, message, details = null) => {
  const log = {
    id: logId.value++,
    timestamp: new Date(),
    level,
    message,
    details
  };
  logs.value.unshift(log); // 新日志在顶部
  
  // 限制日志数量，最多保留100条
  if (logs.value.length > 100) {
    logs.value = logs.value.slice(0, 100);
  }
  
  console.log(`[${level.toUpperCase()}] ${message}`, details || '');
};

const toggleLogs = () => {
  showLogs.value = !showLogs.value;
};

const clearLogs = () => {
  logs.value = [];
  addLog('info', '日志已清空');
};

const formatTime = (timestamp) => {
  return timestamp.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const handleDevicePowerControl = async (deviceId, action) => {
  const device = devices.value.find(d => d.id === deviceId);
  if (!device) {
    addLog('error', '设备控制失败：设备不存在', { deviceId });
    return;
  }

  const actionText = action === 'powerOn' ? '开机' : '关机';
  addLog('info', `开始执行设备${actionText}`, { 
    deviceName: device.name, 
    deviceId, 
    action, 
    type: device.type, 
    ip: device.ip, 
    port: device.port 
  });

  try {
    if (!window.electronAPI || !window.electronAPI.deviceControl) {
      throw new Error('electronAPI 未初始化');
    }
    
    device.powering = action === 'powerOn' ? 'on' : 'off';
    
    // 构建完整的HTTP URL用于日志
    if (device.type === 'http') {
      const httpUrl = device.httpUrls?.[action];
      const fullUrl = `http://${device.ip}:${device.port || 80}${httpUrl}`;
      addLog('info', `HTTP请求URL`, { 
        deviceName: device.name,
        url: fullUrl, 
        method: 'GET',
        auth: device.httpAuth ? '是' : '否'
      });
    } else if (device.type === 'tcp') {
      const command = device.tcpCommands?.[action];
      addLog('info', `TCP命令`, { 
        deviceName: device.name,
        host: `${device.ip}:${device.port || 9763}`,
        command: command || '默认命令'
      });
    }
    
    const result = await window.electronAPI.deviceControl(deviceId, action);
    
    if (result.success) {
      message.success(`${device.name} ${actionText}成功`);
      device.status = action === 'powerOn' ? 'online' : 'offline';
      addLog('success', `设备${actionText}成功`, { 
        deviceName: device.name, 
        response: result.response 
      });
    } else {
      message.error(`${device.name} 操作失败: ${result.error}`);
      addLog('error', `设备${actionText}失败`, { 
        deviceName: device.name, 
        error: result.error,
        status: result.status 
      });
    }
  } catch (error) {
    message.error(`设备控制失败: ${error.message}`);
    addLog('error', `设备控制异常`, { 
      deviceName: device.name, 
      error: error.message, 
      stack: error.stack 
    });
  } finally {
    device.powering = false;
    addLog('info', `设备${actionText}操作结束`, { 
      deviceName: device.name, 
      finalStatus: device.status 
    });
  }
};

const batchPowerControl = async (action) => {
  if (selectedDevices.value.length === 0) return;

  try {
    if (!window.electronAPI || !window.electronAPI.batchDeviceControl) {
      throw new Error('electronAPI 未初始化');
    }
    
    batchLoading.value = true;
    
    // 确保传递的是纯净的数组，移除Vue响应式代理
    const cleanDeviceIds = [...selectedDevices.value].map(id => String(id));
    console.log('批量操作设备ID列表:', cleanDeviceIds);
    
    const result = await window.electronAPI.batchDeviceControl(cleanDeviceIds, action);
    
    if (result.success) {
      const { successful, failed, total, totalAttempts, maxAttempts } = result.summary;
      
      if (failed === 0) {
        message.success(`批量操作完成，成功控制 ${successful} 台设备${totalAttempts > successful ? ` (总共重试 ${totalAttempts} 次)` : ''}`);
        addLog('success', `批量${action === 'powerOn' ? '开机' : action === 'powerOff' ? '关机' : '状态查询'}完成`, {
          successful,
          failed,
          total,
          totalAttempts,
          maxAttempts
        });
      } else {
        const actionText = action === 'powerOn' ? '开机' : action === 'powerOff' ? '关机' : '状态查询';
        notification.warning({
          message: `批量${actionText}完成`,
          description: `成功 ${successful} 台，失败 ${failed} 台，共 ${total} 台设备${totalAttempts > 0 ? `\n总重试次数: ${totalAttempts}，最大重试次数: ${maxAttempts}` : ''}`,
          duration: 6
        });
        
        // 记录失败的设备详情
        const failedDevices = result.results.filter(r => !r.success);
        addLog('warning', `批量${actionText}部分失败`, {
          successful,
          failed,
          totalAttempts,
          failedDevices: failedDevices.map(d => ({
            name: d.deviceName,
            error: d.error,
            attempts: d.attempts
          }))
        });
      }
      
      // Update device status
      result.results.forEach(({ deviceId, success, attempts }) => {
        const device = devices.value.find(d => d.id === deviceId);
        if (device) {
          if (success) {
            device.status = action === 'powerOn' ? 'online' : action === 'powerOff' ? 'offline' : 'online';
          }
          // 为了调试，可以临时存储重试次数信息
          if (attempts > 1) {
            console.log(`设备 ${device.name} 经过 ${attempts} 次尝试${success ? '成功' : '失败'}`);
          }
        }
      });
    } else {
      message.error('批量操作失败: ' + result.error);
      addLog('error', '批量操作失败', { error: result.error });
    }
  } catch (error) {
    message.error('批量操作失败: ' + error.message);
  } finally {
    batchLoading.value = false;
  }
};

const handleSaveDevice = async (deviceData) => {
  // 创建干净的设备数据对象（移到try外部，便于错误处理时使用）
  const cleanDeviceData = createCleanDevice(deviceData);
  
  try {
    if (!window.electronAPI || !window.electronAPI.saveDevice) {
      throw new Error('electronAPI 未初始化');
    }
    
    const result = await window.electronAPI.saveDevice(cleanDeviceData);
    
    if (editingDevice.value) {
      // Update existing device
      const index = devices.value.findIndex(d => d.id === result.id);
      if (index !== -1) {
        // 保留现有的状态信息，只更新设备配置数据
        const existingDevice = devices.value[index];
        devices.value[index] = { 
          ...result, 
          // 保留现有的运行时状态
          status: existingDevice.status || 'unknown', 
          powering: existingDevice.powering || false,
          checking: existingDevice.checking || false
        };
        
        // 记录房间变化用于日志
        const oldRoom = editingDevice.value.room || '未分类';
        const newRoom = result.room || '未分类';
        
        if (oldRoom !== newRoom) {
          addLog('info', `设备 "${result.name}" 从房间 "${oldRoom}" 移动到 "${newRoom}"`);
          
          // 如果设备房间发生变化，自动切换到新房间
          if (newRoom !== '未分类') {
            selectedRoom.value = [newRoom];
            addLog('info', `自动切换到房间: ${newRoom}`);
          }
        }
      }
      message.success('设备更新成功');
      
      // 添加详细的成功日志
      addLog('success', `设备更新成功: ${result.name}`, {
        deviceId: result.id,
        room: result.room,
        type: result.type,
        ip: result.ip,
        port: result.port
      });
    } else {
      // Add new device
      devices.value.push({ 
        ...result, 
        status: 'unknown', 
        powering: false, 
        checking: false 
      });
      message.success('设备添加成功');
      
      // 新设备添加后，如果设置了房间，自动切换到该房间
      if (result.room && result.room !== '未分类') {
        selectedRoom.value = [result.room];
        addLog('info', `设备添加到房间 "${result.room}"，自动切换到该房间`);
      }
      
      // 添加详细的成功日志
      addLog('success', `设备添加成功: ${result.name}`, {
        deviceId: result.id,
        room: result.room,
        type: result.type,
        ip: result.ip,
        port: result.port
      });
    }
    
    showAddDeviceModal.value = false;
    editingDevice.value = null;
  } catch (error) {
    message.error('保存设备失败: ' + error.message);
    addLog('error', `设备保存失败: ${error.message}`, {
      deviceData: cleanDeviceData
    });
  }
};

const editDevice = (device) => {
  editingDevice.value = { ...device };
  showAddDeviceModal.value = true;
};

const deleteDevice = async (deviceId) => {
  try {
    if (!window.electronAPI || !window.electronAPI.deleteDevice) {
      throw new Error('electronAPI 未初始化');
    }
    
    // 找到要删除的设备
    const deviceToDelete = devices.value.find(d => d.id === deviceId);
    const deviceRoom = deviceToDelete?.room;
    
    await window.electronAPI.deleteDevice(deviceId);
    devices.value = devices.value.filter(d => d.id !== deviceId);
    selectedDevices.value = selectedDevices.value.filter(id => String(id) !== String(deviceId));
    
    // 保存房间到customRooms，确保房间不会因为设备删除而消失
    if (deviceRoom && deviceRoom !== '未分类' && deviceRoom.trim() !== '') {
      // 检查该房间是否还有其他设备
      const remainingDevicesInRoom = devices.value.filter(d => d.room === deviceRoom);
      
      // 如果房间已经没有设备了，将其添加到customRooms以保持房间存在
      if (remainingDevicesInRoom.length === 0 && !customRooms.value.includes(deviceRoom)) {
        customRooms.value.push(deviceRoom);
        addLog('info', `房间"${deviceRoom}"已自动保存为空房间，不会因设备删除而丢失`, { room: deviceRoom });
        
        // 持久化保存customRooms
        try {
          await saveCustomRooms();
          addLog('success', `房间"${deviceRoom}"持久化保存成功`, { room: deviceRoom });
        } catch (saveError) {
          addLog('error', `房间保存失败: ${saveError.message}`, { room: deviceRoom, error: saveError });
        }
      } else if (remainingDevicesInRoom.length > 0) {
        addLog('info', `房间"${deviceRoom}"仍有 ${remainingDevicesInRoom.length} 个设备，无需保存为空房间`, { 
          room: deviceRoom, 
          remainingDevices: remainingDevicesInRoom.length 
        });
      }
    }
    
    message.success('设备删除成功');
    addLog('info', `设备删除成功`, { 
      deviceId, 
      deviceName: deviceToDelete?.name, 
      room: deviceRoom 
    });
  } catch (error) {
    message.error('删除设备失败: ' + error.message);
    addLog('error', `设备删除失败: ${error.message}`, { deviceId });
  }
};

const refreshAllStatus = async () => {
  if (!window.electronAPI || !window.electronAPI.deviceControl) {
    message.error('electronAPI 未初始化');
    return;
  }
  
  for (const device of devices.value) {
    try {
      device.checking = true;
      const result = await window.electronAPI.deviceControl(device.id, 'status');
      if (result.success) {
        // Simple status parsing - can be enhanced based on actual responses
        device.status = 'online'; // Assume online if we get any response
      } else {
        device.status = 'offline';
      }
    } catch (error) {
      device.status = 'offline';
    } finally {
      device.checking = false;
    }
  }
  message.info('状态刷新完成');
};

// Utility function to create a clean device object for API calls
const createCleanDevice = (device) => {
  // Remove Vue reactive proxies and only keep necessary properties
  const cleanDevice = {
    id: device.id,
    name: device.name,
    ip: device.ip,
    port: device.port,
    type: device.type,
    room: device.room,
    tcpCommands: device.tcpCommands ? { ...device.tcpCommands } : undefined,
    httpUrls: device.httpUrls ? { ...device.httpUrls } : undefined,
    httpAuth: device.httpAuth ? { ...device.httpAuth } : undefined
  };
  
  // Remove undefined properties
  Object.keys(cleanDevice).forEach(key => {
    if (cleanDevice[key] === undefined) {
      delete cleanDevice[key];
    }
  });
  
  return cleanDevice;
};

// Room management methods
function validateRoomName(rule, value) {
  if (!value) return Promise.resolve();
  
  const existingRooms = rooms.value.map(r => r.name);
  if (editingRoom.value) {
    const currentRoomIndex = existingRooms.indexOf(editingRoom.value.name);
    if (currentRoomIndex > -1) {
      existingRooms.splice(currentRoomIndex, 1);
    }
  }
  
  if (existingRooms.includes(value)) {
    return Promise.reject('房间名称已存在');
  }
  return Promise.resolve();
}

const handleRoomMenuClick = ({ key }, room) => {
  if (key === 'edit') {
    editRoom(room);
  } else if (key === 'delete') {
    deleteRoom(room);
  }
};

const editRoom = (room) => {
  editingRoom.value = { ...room };
  roomForm.name = room.name;
  showAddRoomModal.value = true;
};

const deleteRoom = (room) => {
  if (room.deviceCount > 0) {
    message.warning('该房间内还有设备，无法删除');
    return;
  }
  deletingRoom.value = room;
  showDeleteRoomModal.value = true;
};

const handleSaveRoom = async () => {
  try {
    await roomFormRef.value.validate();
    roomLoading.value = true;
    
    if (editingRoom.value) {
      // Update room name for all devices in this room
      const devicesToUpdate = devices.value.filter(d => d.room === editingRoom.value.name);
      
      // 批量更新设备房间信息
      const updatePromises = devicesToUpdate.map(async (device) => {
        // 创建纯净的设备对象，移除Vue响应式代理
        const updatedDevice = createCleanDevice({ ...device, room: roomForm.name });
        
        // 更新本地数据
        const index = devices.value.findIndex(d => d.id === device.id);
        if (index !== -1) {
          devices.value[index] = { 
            ...device, 
            room: roomForm.name,
            // 保持现有的状态属性
            status: device.status,
            powering: device.powering,
            checking: device.checking
          };
        }
        
        // 保存到后端
        if (window.electronAPI && window.electronAPI.saveDevice) {
          return await window.electronAPI.saveDevice(updatedDevice);
        }
        return updatedDevice;
      });
      
      await Promise.all(updatePromises);
      
      // 强制触发响应性更新
      devices.value = [...devices.value];
      
      // 如果当前选中的房间是被编辑的房间，更新选中状态
      if (selectedRoom.value[0] === editingRoom.value.name) {
        selectedRoom.value = [roomForm.name];
      }
      
      // 更新自定义房间列表中的房间名称
      const customRoomIndex = customRooms.value.indexOf(editingRoom.value.name);
      if (customRoomIndex > -1) {
        customRooms.value[customRoomIndex] = roomForm.name;
        await saveCustomRooms();
      }
      
      message.success(`房间 "${editingRoom.value.name}" 已更名为 "${roomForm.name}"`);
      
      console.log('Room updated successfully:', {
        oldName: editingRoom.value.name,
        newName: roomForm.name,
        updatedDevices: devicesToUpdate.length
      });
    } else {
      // 添加新房间到自定义房间列表
      if (!customRooms.value.includes(roomForm.name)) {
        customRooms.value.push(roomForm.name);
      }
      
      // 保存自定义房间列表到本地存储
      await saveCustomRooms();
      
      message.success(`房间 "${roomForm.name}" 创建成功`);
      
      console.log('Room created successfully:', {
        roomName: roomForm.name
      });
    }
    
    showAddRoomModal.value = false;
    handleCancelRoom();
  } catch (error) {
    console.error('Save room error:', error);
    if (error.errorFields) {
      // Validation error, don't show message
      return;
    }
    message.error('保存房间失败: ' + error.message);
  } finally {
    roomLoading.value = false;
  }
};

const confirmDeleteRoom = async () => {
  try {
    roomLoading.value = true;
    
    // Move all devices in this room to "未分类"
    const devicesToUpdate = devices.value.filter(d => d.room === deletingRoom.value.name);
    
    // 批量更新设备房间信息
    const updatePromises = devicesToUpdate.map(async (device) => {
      // 创建纯净的设备对象，移除Vue响应式代理
      const updatedDevice = createCleanDevice({ ...device, room: '未分类' });
      
      // 更新本地数据
      const index = devices.value.findIndex(d => d.id === device.id);
      if (index !== -1) {
        devices.value[index] = { 
          ...device, 
          room: '未分类',
          // 保持现有的状态属性
          status: device.status,
          powering: device.powering,
          checking: device.checking
        };
      }
      
      // 保存到后端
      if (window.electronAPI && window.electronAPI.saveDevice) {
        return await window.electronAPI.saveDevice(updatedDevice);
      }
      return updatedDevice;
    });
    
    await Promise.all(updatePromises);
    
    // 强制触发响应性更新
    devices.value = [...devices.value];
    
    // 如果当前选中的是被删除的房间，切换到"所有设备"
    if (selectedRoom.value[0] === deletingRoom.value.name) {
      selectedRoom.value = ['all'];
    }
    
    // 从自定义房间列表中移除
    const customRoomIndex = customRooms.value.indexOf(deletingRoom.value.name);
    if (customRoomIndex > -1) {
      customRooms.value.splice(customRoomIndex, 1);
      await saveCustomRooms();
    }
    
    message.success(`房间 "${deletingRoom.value.name}" 删除成功`);
    
    console.log('Room deleted successfully:', {
      deletedRoom: deletingRoom.value.name,
      movedDevices: devicesToUpdate.length
    });
    showDeleteRoomModal.value = false;
    deletingRoom.value = null;
  } catch (error) {
    console.error('Delete room error:', error);
    message.error('删除房间失败: ' + error.message);
  } finally {
    roomLoading.value = false;
  }
};

const handleCancelRoom = () => {
  editingRoom.value = null;
  roomForm.name = '';
  roomFormRef.value?.resetFields();
};

// Configuration import/export
const handleConfigMenu = ({ key }) => {
  if (key === 'export') {
    exportConfiguration();
  } else if (key === 'import') {
    importConfiguration();
  }
};

const exportConfiguration = () => {
  try {
    const config = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      devices: devices.value.map(device => createCleanDevice(device)),
      customRooms: customRooms.value
    };
    
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `projector-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.success('配置导出成功');
  } catch (error) {
    console.error('Export error:', error);
    message.error('导出配置失败: ' + error.message);
  }
};

const importConfiguration = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const config = JSON.parse(text);
      
      // 验证配置格式
      if (!config.devices || !Array.isArray(config.devices)) {
        throw new Error('无效的配置文件格式');
      }
      
      // 导入设备
      const importedDevices = [];
      for (const deviceData of config.devices) {
        if (window.electronAPI && window.electronAPI.saveDevice) {
          const result = await window.electronAPI.saveDevice(deviceData);
          importedDevices.push({ ...result, status: 'unknown', powering: false, checking: false });
        } else {
          importedDevices.push({ ...deviceData, status: 'unknown', powering: false, checking: false });
        }
      }
      
      // 导入自定义房间
      if (config.customRooms && Array.isArray(config.customRooms)) {
        customRooms.value = [...new Set([...customRooms.value, ...config.customRooms])];
        await saveCustomRooms();
      }
      
      // 更新设备列表
      devices.value = [...devices.value, ...importedDevices];
      
      message.success(`成功导入 ${importedDevices.length} 个设备${config.customRooms ? ` 和 ${config.customRooms.length} 个房间` : ''}`);
      
    } catch (error) {
      console.error('Import error:', error);
      message.error('导入配置失败: ' + error.message);
    }
  };
  
  input.click();
};

// 自定义房间数据持久化
const saveCustomRooms = async () => {
  try {
    if (window.electronAPI && window.electronAPI.saveCustomRooms) {
      await window.electronAPI.saveCustomRooms(customRooms.value);
    } else {
      // 如果没有Electron API，使用localStorage作为备选
      localStorage.setItem('projector-custom-rooms', JSON.stringify(customRooms.value));
    }
  } catch (error) {
    console.error('Save custom rooms error:', error);
  }
};

const loadCustomRooms = async () => {
  try {
    if (window.electronAPI && window.electronAPI.getCustomRooms) {
      const rooms = await window.electronAPI.getCustomRooms();
      customRooms.value = rooms || [];
    } else {
      // 如果没有Electron API，使用localStorage作为备选
      const savedRooms = localStorage.getItem('projector-custom-rooms');
      customRooms.value = savedRooms ? JSON.parse(savedRooms) : [];
    }
  } catch (error) {
    console.error('Load custom rooms error:', error);
    customRooms.value = [];
  }
};

// Device Groups persistence
const saveDeviceGroups = async () => {
  try {
    if (window.electronAPI && window.electronAPI.saveDeviceGroups) {
      await window.electronAPI.saveDeviceGroups(deviceGroups.value);
    } else {
      localStorage.setItem('projector-device-groups', JSON.stringify(deviceGroups.value));
    }
  } catch (error) {
    console.error('Save device groups error:', error);
  }
};

const loadDeviceGroups = async () => {
  try {
    if (window.electronAPI && window.electronAPI.getDeviceGroups) {
      const groups = await window.electronAPI.getDeviceGroups();
      deviceGroups.value = groups || [];
    } else {
      const savedGroups = localStorage.getItem('projector-device-groups');
      deviceGroups.value = savedGroups ? JSON.parse(savedGroups) : [];
    }
  } catch (error) {
    console.error('Load device groups error:', error);
    deviceGroups.value = [];
  }
};

// Scroll to top functionality
const scrollToTop = () => {
  const contentElement = document.querySelector('.content');
  if (contentElement) {
    contentElement.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

const handleScroll = () => {
  const contentElement = document.querySelector('.content');
  const scrollTop = contentElement ? contentElement.scrollTop : window.pageYOffset;
  showScrollTop.value = scrollTop > 300;
};

// Tour control functions
const startTour = () => {
  tourCurrent.value = 0;
  tourOpen.value = true;
  addLog('info', '用户指南已启动');
};

const closeTour = () => {
  tourOpen.value = false;
  addLog('info', '用户指南已关闭');
};

const finishTour = () => {
  tourOpen.value = false;
  notification.success({
    message: '用户指南完成',
    description: '恭喜！您已经了解了投影设备管理器的主要功能。如有疑问，可以随时点击右下角的指南按钮重新查看。',
    duration: 6
  });
  addLog('success', '用户指南完成');
};

// Device Group Management Functions
const handleSaveGroup = async (groupData) => {
  try {
    const existingIndex = deviceGroups.value.findIndex(g => g.id === groupData.id);
    
    if (existingIndex !== -1) {
      // Update existing group
      deviceGroups.value[existingIndex] = groupData;
      message.success(`设备组 "${groupData.name}" 已更新`);
      addLog('success', `设备组已更新: ${groupData.name}`, { 
        groupId: groupData.id, 
        deviceCount: groupData.deviceIds.length 
      });
    } else {
      // Add new group
      deviceGroups.value.push(groupData);
      message.success(`设备组 "${groupData.name}" 已创建`);
      addLog('success', `设备组已创建: ${groupData.name}`, { 
        groupId: groupData.id, 
        deviceCount: groupData.deviceIds.length 
      });
    }
    
    await saveDeviceGroups();
    showDeviceGroupModal.value = false;
    editingGroup.value = null;
  } catch (error) {
    message.error('保存设备组失败: ' + error.message);
    addLog('error', `设备组保存失败: ${error.message}`);
  }
};

const handleDeleteGroup = async (groupId) => {
  try {
    const groupIndex = deviceGroups.value.findIndex(g => g.id === groupId);
    if (groupIndex !== -1) {
      const groupName = deviceGroups.value[groupIndex].name;
      deviceGroups.value.splice(groupIndex, 1);
      await saveDeviceGroups();
      
      message.success(`设备组 "${groupName}" 已删除`);
      addLog('success', `设备组已删除: ${groupName}`, { groupId });
      showDeviceGroupModal.value = false;
      editingGroup.value = null;
    }
  } catch (error) {
    message.error('删除设备组失败: ' + error.message);
    addLog('error', `设备组删除失败: ${error.message}`);
  }
};

const saveSelectedAsGroup = () => {
  if (selectedDevices.value.length === 0) {
    message.warning('请先选择要保存的设备');
    return;
  }
  
  editingGroup.value = {
    deviceIds: [...selectedDevices.value],
    name: `设备组 ${new Date().toLocaleString()}`,
    description: `包含 ${selectedDevices.value.length} 个设备的自动创建设备组`
  };
  showDeviceGroupModal.value = true;
};

const handleGroupAction = async (group, action) => {
  switch (action) {
    case 'select':
      selectedDevices.value = [...group.deviceIds].map(id => String(id));
      message.success(`已选择设备组 "${group.name}" 中的 ${group.deviceIds.length} 个设备`);
      addLog('info', `已选择设备组: ${group.name}`, { 
        deviceCount: group.deviceIds.length 
      });
      break;
      
    case 'edit':
      editingGroup.value = { ...group };
      showDeviceGroupModal.value = true;
      break;
      
    case 'powerOn':
    case 'powerOff':
    case 'status':
      selectedDevices.value = [...group.deviceIds].map(id => String(id));
      await batchPowerControl(action);
      break;
  }
};

const batchTestConnection = async () => {
  if (selectedDevices.value.length === 0) return;

  try {
    batchLoading.value = true;
    addLog('info', `开始批量连接测试`, { deviceCount: selectedDevices.value.length });
    
    let successful = 0;
    let failed = 0;
    
    // Test connections concurrently with limited concurrency
    const batchSize = 5; // Process 5 devices at a time
    for (let i = 0; i < selectedDevices.value.length; i += batchSize) {
      const batch = selectedDevices.value.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (deviceId) => {
        const device = devices.value.find(d => d.id === deviceId);
        if (!device) return;
        
        try {
          device.checking = true;
          const result = await window.electronAPI.deviceControl(deviceId, 'status');
          
          if (result.success) {
            device.status = 'online';
            successful++;
          } else {
            device.status = 'offline';
            failed++;
          }
        } catch (error) {
          device.status = 'offline';
          failed++;
        } finally {
          device.checking = false;
        }
      }));
    }
    
    if (failed === 0) {
      message.success(`批量连接测试完成，全部 ${successful} 个设备连接正常`);
    } else {
      notification.warning({
        message: '批量连接测试完成',
        description: `成功 ${successful} 个，失败 ${failed} 个，共测试 ${successful + failed} 个设备`
      });
    }
    
    addLog('success', `批量连接测试完成`, { successful, failed, total: successful + failed });
  } catch (error) {
    message.error('批量连接测试失败: ' + error.message);
    addLog('error', `批量连接测试失败: ${error.message}`);
  } finally {
    batchLoading.value = false;
  }
};

// Real-time monitoring functions
const toggleMonitoring = () => {
  if (monitoringEnabled.value) {
    stopMonitoring();
  } else {
    startMonitoring();
  }
};

const startMonitoring = () => {
  if (devices.value.length === 0) {
    message.warning('没有设备可供监控');
    return;
  }

  monitoringEnabled.value = true;
  
  // Start immediate check
  performMonitoringCheck();
  
  // Set up interval
  monitoringInterval.value = setInterval(() => {
    performMonitoringCheck();
  }, monitoringIntervalTime.value);
  
  message.success(`已启动实时监控 (每 ${monitoringIntervalTime.value / 1000} 秒检查)`);
  addLog('info', `实时监控已启动`, { 
    interval: monitoringIntervalTime.value,
    deviceCount: devices.value.length 
  });
};

const stopMonitoring = () => {
  monitoringEnabled.value = false;
  
  if (monitoringInterval.value) {
    clearInterval(monitoringInterval.value);
    monitoringInterval.value = null;
  }
  
  message.info('已停止实时监控');
  addLog('info', '实时监控已停止');
};

const performMonitoringCheck = async () => {
  try {
    if (!window.electronAPI || !window.electronAPI.deviceControl || devices.value.length === 0) {
      return;
    }

    // Monitor devices in batches to avoid overwhelming the network
    const batchSize = 3;
    let checkedCount = 0;
    let onlineCount = 0;
    let offlineCount = 0;
    const statusChanges = [];

    for (let i = 0; i < devices.value.length; i += batchSize) {
      const batch = devices.value.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (device) => {
        try {
          const previousStatus = device.status;
          device.checking = true;
          
          const result = await Promise.race([
            window.electronAPI.deviceControl(device.id, 'status'),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('监控超时')), 8000)
            )
          ]);
          
          const newStatus = result.success ? 'online' : 'offline';
          device.status = newStatus;
          
          if (previousStatus && previousStatus !== newStatus) {
            statusChanges.push({
              device: device.name,
              from: previousStatus,
              to: newStatus
            });
          }
          
          if (newStatus === 'online') {
            onlineCount++;
          } else {
            offlineCount++;
          }
          
        } catch (error) {
          device.status = 'offline';
          offlineCount++;
        } finally {
          device.checking = false;
          checkedCount++;
        }
      }));
      
      // Small delay between batches
      if (i + batchSize < devices.value.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Log status changes
    if (statusChanges.length > 0) {
      statusChanges.forEach(change => {
        const isOnline = change.to === 'online';
        addLog(
          isOnline ? 'success' : 'warning', 
          `设备状态变化: ${change.device} ${change.from} → ${change.to}`,
          { device: change.device, from: change.from, to: change.to }
        );
        
        // Show notification for status changes
        if (isOnline) {
          message.success(`${change.device} 已上线`, 2);
        } else {
          message.warning(`${change.device} 已离线`, 2);
        }
      });
    }
    
    // Periodic summary log (every 5 minutes)
    const now = Date.now();
    const lastSummaryLog = localStorage.getItem('last-monitoring-summary') || '0';
    
    if (now - parseInt(lastSummaryLog) > 300000) { // 5 minutes
      addLog('info', `监控状态汇总`, {
        total: checkedCount,
        online: onlineCount,
        offline: offlineCount,
        statusChanges: statusChanges.length
      });
      localStorage.setItem('last-monitoring-summary', now.toString());
    }
    
  } catch (error) {
    console.error('Monitoring check error:', error);
    addLog('error', `监控检查失败: ${error.message}`);
  }
};

// Lifecycle
onMounted(async () => {
  addLog('info', '投影设备管理器启动');
  
  // 检查electronAPI状态
  if (window.electronAPI) {
    addLog('success', 'Electron API 初始化成功', {
      availableMethods: Object.keys(window.electronAPI)
    });
  } else {
    addLog('error', 'Electron API 未找到，设备控制功能将不可用', {
      environment: 'web',
      note: '请在Electron环境中运行应用'
    });
  }
  
  await loadCustomRooms();
  await loadDeviceGroups();
  loadDevices();
  
  // Add scroll event listener
  const contentElement = document.querySelector('.content');
  if (contentElement) {
    contentElement.addEventListener('scroll', handleScroll);
  } else {
    window.addEventListener('scroll', handleScroll);
  }
  
  // Check if it's first time user and show tour
  setTimeout(() => {
    const hasSeenTour = localStorage.getItem('projector-tour-seen');
    if (!hasSeenTour && devices.value.length === 0) {
      startTour();
      localStorage.setItem('projector-tour-seen', 'true');
    }
  }, 1000);
});

onUnmounted(() => {
  // Remove scroll event listener
  const contentElement = document.querySelector('.content');
  if (contentElement) {
    contentElement.removeEventListener('scroll', handleScroll);
  } else {
    window.removeEventListener('scroll', handleScroll);
  }
  
  // Stop monitoring
  stopMonitoring();
});
</script>

<style scoped>
.app-layout {
  height: 100vh;
}

.header {
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  padding: 0 24px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

.title {
  margin: 0;
  color: #1890ff;
  font-size: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sidebar {
  background: #fff;
  border-right: 1px solid #f0f0f0;
  min-width: 250px;
  width: 250px;
}

.sidebar-content {
  padding: 16px 0;
}

.room-header {
  padding: 0 16px 16px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 8px;
}

.room-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #262626;
}

.room-menu .ant-menu-item {
  padding: 0 !important;
  height: auto !important;
  line-height: 1 !important;
}

.room-menu-item {
  overflow: hidden;
}

.room-item-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 16px;
  min-height: 40px;
}

.room-icon-name {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.room-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  max-width: 120px;
}

/* 这个样式已经在下面重新定义了 */

.room-more-btn {
  opacity: 0.7;
  transition: all 0.2s;
  padding: 4px !important;
  min-width: auto !important;
  height: 22px !important;
  width: 22px !important;
  position: relative;
  z-index: 10;
  border-radius: 4px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border: 1px solid transparent !important;
}

.room-menu-item:hover .room-more-btn,
.room-item-content:hover .room-more-btn,
.room-more-btn:hover {
  opacity: 1;
  background-color: #f0f0f0 !important;
  border-color: #d9d9d9 !important;
  transform: scale(1.1);
}

/* 调整徽章样式 */
.room-actions .ant-badge {
  font-size: 10px;
  display: flex;
  align-items: center;
}

.room-actions .ant-badge .ant-badge-count {
  min-width: 20px;
  height: 18px;
  line-height: 18px;
  padding: 0 4px;
  font-size: 10px;
  text-align: center;
  border-radius: 9px;
  position: static !important;
  transform: none !important;
  margin-top: 0 !important;
  margin-right: 0 !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
}

/* 为了确保对齐，给徽章容器设置固定宽度 */
.room-actions .ant-badge:not(:last-child) {
  margin-right: 4px;
}

/* 确保徽章数字在不同长度下保持对齐 */
.room-actions .ant-badge .ant-badge-count[data-count="0"],
.room-actions .ant-badge .ant-badge-count[data-count="1"],
.room-actions .ant-badge .ant-badge-count[data-count="2"],
.room-actions .ant-badge .ant-badge-count[data-count="3"],
.room-actions .ant-badge .ant-badge-count[data-count="4"],
.room-actions .ant-badge .ant-badge-count[data-count="5"],
.room-actions .ant-badge .ant-badge-count[data-count="6"],
.room-actions .ant-badge .ant-badge-count[data-count="7"],
.room-actions .ant-badge .ant-badge-count[data-count="8"],
.room-actions .ant-badge .ant-badge-count[data-count="9"] {
  min-width: 18px;
}

/* 两位数徽章 */
.room-actions .ant-badge .ant-badge-count {
  min-width: 24px;
}

/* 确保每个房间操作区域都有相同的宽度并右对齐 */
.room-actions {
  width: 80px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  flex-shrink: 0;
  position: relative;
}

/* 操作按钮显示在左侧 */
.room-actions .ant-dropdown {
  order: 1;
  margin-right: 4px;
}

/* 徽章显示在右侧 */
.room-actions .ant-badge {
  order: 2;
  position: relative;
}

/* 为有操作按钮的房间添加小提示 */
.room-actions .ant-dropdown::before {
  content: '';
  position: absolute;
  right: -2px;
  top: -2px;
  width: 4px;
  height: 4px;
  background: #1890ff;
  border-radius: 50%;
  opacity: 0.6;
  pointer-events: none;
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .room-name {
    max-width: 100px;
  }
}

@media (max-width: 1200px) {
  .room-name {
    max-width: 80px;
  }
  
  .sidebar {
    width: 220px;
    min-width: 220px;
  }
}

.content {
  padding: 24px;
  background: #f0f2f5;
  overflow-y: auto;
}

.control-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.control-panel-left h3 {
  margin: 0;
  color: #262626;
  font-size: 18px;
  font-weight: 600;
}

.device-count {
  color: #8c8c8c;
  font-size: 14px;
  margin-left: 12px;
}

.batch-panel {
  margin-bottom: 24px;
}

.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

@media (max-width: 1200px) {
  .device-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}

.device-card-wrapper {
  display: flex;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.logs-panel {
  margin-top: 24px;
}

.logs-content {
  max-height: 400px;
  overflow-y: auto;
  background: #fafafa;
  border-radius: 6px;
  padding: 12px;
}

.log-entry {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  border-left: 3px solid #d9d9d9;
}

.log-entry.log-info {
  background: #f6ffed;
  border-left-color: #52c41a;
}

.log-entry.log-success {
  background: #f6ffed;
  border-left-color: #52c41a;
}

.log-entry.log-error {
  background: #fff2f0;
  border-left-color: #ff4d4f;
}

.log-entry.log-warning {
  background: #fffbe6;
  border-left-color: #faad14;
}

.log-entry > div:first-child {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.log-time {
  color: #8c8c8c;
  font-family: monospace;
  min-width: 70px;
}

.log-level {
  font-weight: 600;
  min-width: 60px;
}

.log-level:contains("INFO") {
  color: #1890ff;
}

.log-level:contains("SUCCESS") {
  color: #52c41a;
}

.log-level:contains("ERROR") {
  color: #ff4d4f;
}

.log-level:contains("WARNING") {
  color: #faad14;
}

.log-message {
  flex: 1;
  color: #262626;
}

.log-details {
  margin-top: 4px;
  margin-left: 80px;
}

.log-details pre {
  background: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
  margin: 0;
  overflow-x: auto;
  font-size: 11px;
  max-width: 100%;
}

.no-logs {
  text-align: center;
  color: #8c8c8c;
  padding: 20px;
  font-style: italic;
}
</style>