<template>
  <a-modal
    :open="visible"
    :title="device ? '编辑设备' : '添加设备'"
    :width="600"
    @ok="handleSave"
    @cancel="handleCancel"
  >
    <a-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      layout="vertical"
      @finish="handleSave"
    >
      <!-- Basic Info -->
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="设备名称" name="name" required>
            <a-input 
              v-model:value="formData.name" 
              placeholder="请输入设备名称"
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="IP地址" name="ip" required>
            <a-input 
              v-model:value="formData.ip" 
              placeholder="192.168.1.100"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="协议类型" name="type" required>
            <a-select v-model:value="formData.type" @change="onTypeChange">
              <a-select-option value="tcp">TCP</a-select-option>
              <a-select-option value="http">HTTP</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="端口" name="port">
            <a-input-number 
              v-model:value="formData.port" 
              :min="1" 
              :max="65535"
              style="width: 100%"
              :placeholder="formData.type === 'tcp' ? '9763' : '80'"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="所属房间" name="room">
        <a-select 
          v-model:value="formData.room"
          mode="combobox"
          placeholder="选择或输入房间名称"
          :options="roomOptions"
          @search="onRoomSearch"
        />
      </a-form-item>

      <!-- TCP Configuration -->
      <div v-if="formData.type === 'tcp'">
        <a-divider orientation="left">TCP 命令配置</a-divider>
        
        <a-form-item label="开机命令" name="tcpCommands.powerOn">
          <a-input 
            v-model:value="formData.tcpCommands.powerOn" 
            placeholder="PWR ON\r\n"
          />
          <div class="form-tip">
            支持转义字符: \r (回车), \n (换行)
          </div>
        </a-form-item>

        <a-form-item label="关机命令" name="tcpCommands.powerOff">
          <a-input 
            v-model:value="formData.tcpCommands.powerOff" 
            placeholder="PWR OFF\r\n"
          />
        </a-form-item>

        <a-form-item label="状态查询命令" name="tcpCommands.status">
          <a-input 
            v-model:value="formData.tcpCommands.status" 
            placeholder="PWR?\r\n"
          />
        </a-form-item>

        <!-- Common TCP Command Presets -->
        <a-form-item label="快速配置">
          <a-select 
            placeholder="选择常用命令模板"
            @change="applyTcpPreset"
            style="width: 100%"
          >
            <a-select-option value="power">POWER命令 (开机: POWER1, 关机: POWER0)</a-select-option>
            <a-select-option value="simple">简单文本命令</a-select-option>
            <a-select-option value="pjlink">PJLink 协议</a-select-option>
          </a-select>
        </a-form-item>
      </div>

      <!-- HTTP Configuration -->
      <div v-if="formData.type === 'http'">
        <a-divider orientation="left">HTTP 接口配置</a-divider>
        
        <a-form-item label="开机接口" name="httpUrls.powerOn">
          <a-input 
            v-model:value="formData.httpUrls.powerOn" 
            placeholder="/api/power/on"
            addon-before="GET"
          />
        </a-form-item>

        <a-form-item label="关机接口" name="httpUrls.powerOff">
          <a-input 
            v-model:value="formData.httpUrls.powerOff" 
            placeholder="/api/power/off"
            addon-before="GET"
          />
        </a-form-item>

        <a-form-item label="状态查询接口" name="httpUrls.status">
          <a-input 
            v-model:value="formData.httpUrls.status" 
            placeholder="/api/status"
            addon-before="GET"
          />
        </a-form-item>

        <!-- HTTP Authentication -->
        <a-divider orientation="left" plain>身份验证 (可选)</a-divider>
        
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="用户名" name="httpAuth.username">
              <a-input 
                v-model:value="formData.httpAuth.username" 
                placeholder="admin"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="密码" name="httpAuth.password">
              <a-input-password 
                v-model:value="formData.httpAuth.password" 
                placeholder="password"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <!-- HTTP URL Presets -->
        <a-form-item label="快速配置">
          <a-select 
            placeholder="选择常用接口模板"
            @change="applyHttpPreset"
            style="width: 100%"
          >
            <a-select-option value="webctrl">WebCtrl CGI (投影仪常用)</a-select-option>
            <a-select-option value="restful">RESTful API</a-select-option>
            <a-select-option value="query">查询参数</a-select-option>
            <a-select-option value="cgi">CGI 风格</a-select-option>
          </a-select>
        </a-form-item>
      </div>

      <!-- Test Connection -->
      <a-form-item>
        <a-button 
          @click="testConnection"
          :loading="testLoading"
          :disabled="!canTest"
        >
          <ExperimentOutlined />
          测试连接
        </a-button>
        <span v-if="testResult" class="test-result" :class="testResult.success ? 'success' : 'error'">
          {{ testResult.message }}
        </span>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch, reactive } from 'vue';
import { message } from 'ant-design-vue';
import { ExperimentOutlined } from '@ant-design/icons-vue';

const props = defineProps({
  visible: Boolean,
  device: Object,
  rooms: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:visible', 'save']);

const formRef = ref();
const testLoading = ref(false);
const testResult = ref(null);

const formData = reactive({
  name: '',
  ip: '',
  type: 'tcp',
  port: null,
  room: '',
  tcpCommands: {
    powerOn: '',
    powerOff: '',
    status: ''
  },
  httpUrls: {
    powerOn: '',
    powerOff: '',
    status: ''
  },
  httpAuth: {
    username: '',
    password: ''
  }
});

const formRules = {
  name: [
    { required: true, message: '请输入设备名称' }
  ],
  ip: [
    { required: true, message: '请输入IP地址' },
    { pattern: /^(\d{1,3}\.){3}\d{1,3}$/, message: '请输入有效的IP地址' }
  ],
  type: [
    { required: true, message: '请选择协议类型' }
  ]
};

const roomOptions = computed(() => {
  return props.rooms.map(room => ({
    label: room.name,
    value: room.name
  }));
});

const canTest = computed(() => {
  return formData.name && formData.ip && formData.type;
});

const resetForm = () => {
  Object.assign(formData, {
    name: '',
    ip: '',
    type: 'tcp',
    port: null,
    room: '',
    tcpCommands: {
      powerOn: '',
      powerOff: '',
      status: ''
    },
    httpUrls: {
      powerOn: '',
      powerOff: '',
      status: ''
    },
    httpAuth: {
      username: '',
      password: ''
    }
  });
  testResult.value = null;
};

const visible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

// Watch for device prop changes
watch(() => props.device, (newDevice) => {
  if (newDevice) {
    Object.assign(formData, {
      ...newDevice,
      tcpCommands: { ...newDevice.tcpCommands || {} },
      httpUrls: { ...newDevice.httpUrls || {} },
      httpAuth: { ...newDevice.httpAuth || {} }
    });
  } else {
    resetForm();
  }
}, { immediate: true });

const onTypeChange = (type) => {
  // Set default ports
  if (type === 'tcp' && !formData.port) {
    formData.port = 9763;
  } else if (type === 'http' && !formData.port) {
    formData.port = 80;
  }
  testResult.value = null;
};

const onRoomSearch = (value) => {
  // Allow creating new rooms by typing
};

const applyTcpPreset = (preset) => {
  const presets = {
    simple: {
      powerOn: 'PWR ON\\r\\n',
      powerOff: 'PWR OFF\\r\\n',
      status: 'PWR?\\r\\n'
    },
    pjlink: {
      powerOn: '%1POWR 1\\r',
      powerOff: '%1POWR 0\\r',
      status: '%1POWR ?\\r'
    },
    power: {
      powerOn: 'POWER1',
      powerOff: 'POWER0',
      status: 'POWER?'
    }
  };
  
  if (presets[preset]) {
    Object.assign(formData.tcpCommands, presets[preset]);
  }
};

const applyHttpPreset = (preset) => {
  const baseIP = formData.ip || '192.168.1.100';
  
  const presets = {
    restful: {
      powerOn: '/api/power/on',
      powerOff: '/api/power/off',
      status: '/api/power/status'
    },
    query: {
      powerOn: '/control?cmd=power&action=on',
      powerOff: '/control?cmd=power&action=off',
      status: '/control?cmd=power&action=status'
    },
    cgi: {
      powerOn: '/cgi-bin/proj_control.cgi?power=on',
      powerOff: '/cgi-bin/proj_control.cgi?power=off',
      status: '/cgi-bin/proj_control.cgi?power=status'
    },
    webctrl: {
      powerOn: `/cgi-bin/webctrl.cgi.elf?&t:26,c:5,p:196614,v:0`,
      powerOff: `/cgi-bin/webctrl.cgi.elf?&t:26,c:5,p:196615,v:0`,
      status: `/cgi-bin/webctrl.cgi.elf?&t:26,c:5,p:196616,v:0`
    }
  };
  
  if (presets[preset]) {
    Object.assign(formData.httpUrls, presets[preset]);
  }
};

const testConnection = async () => {
  try {
    if (!window.electronAPI || !window.electronAPI.deviceControl) {
      throw new Error('electronAPI 未初始化');
    }
    
    testLoading.value = true;
    testResult.value = null;
    
    // Create a test device object
    const testDevice = { ...formData };
    if (!testDevice.port) {
      testDevice.port = testDevice.type === 'tcp' ? 9763 : 80;
    }
    
    // Test with status command
    const result = await window.electronAPI.deviceControl(
      'test-' + Date.now(), 
      'status'
    );
    
    if (result.success) {
      testResult.value = {
        success: true,
        message: '连接测试成功！'
      };
      message.success('连接测试成功');
    } else {
      testResult.value = {
        success: false,
        message: `连接失败: ${result.error}`
      };
    }
  } catch (error) {
    testResult.value = {
      success: false,
      message: `测试失败: ${error.message}`
    };
  } finally {
    testLoading.value = false;
  }
};

const handleSave = async () => {
  try {
    await formRef.value.validate();
    
    const deviceData = { ...formData };
    
    // Set default port if not provided
    if (!deviceData.port) {
      deviceData.port = deviceData.type === 'tcp' ? 9763 : 80;
    }
    
    // Clean up empty objects
    if (deviceData.type === 'tcp') {
      delete deviceData.httpUrls;
      delete deviceData.httpAuth;
    } else if (deviceData.type === 'http') {
      delete deviceData.tcpCommands;
      // Clean up empty auth
      if (!deviceData.httpAuth.username && !deviceData.httpAuth.password) {
        delete deviceData.httpAuth;
      }
    }
    
    emit('save', deviceData);
  } catch (error) {
    console.error('Validation failed:', error);
  }
};

const handleCancel = () => {
  visible.value = false;
  resetForm();
};
</script>

<style scoped>
.form-tip {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.test-result {
  margin-left: 12px;
  font-size: 14px;
}

.test-result.success {
  color: #52c41a;
}

.test-result.error {
  color: #ff4d4f;
}

:deep(.ant-divider-horizontal.ant-divider-with-text-left) {
  margin: 16px 0;
}
</style>