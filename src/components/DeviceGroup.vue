<template>
  <a-modal
    :open="open"
    :title="editing ? '编辑设备组' : '创建设备组'"
    @ok="handleSave"
    @cancel="handleCancel"
    :confirmLoading="loading"
    width="600px"
  >
    <a-form
      ref="formRef"
      :model="form"
      :rules="rules"
      layout="vertical"
    >
      <a-form-item
        label="组名称"
        name="name"
      >
        <a-input
          v-model:value="form.name"
          placeholder="请输入设备组名称"
          :maxlength="50"
        />
      </a-form-item>

      <a-form-item
        label="描述"
        name="description"
      >
        <a-textarea
          v-model:value="form.description"
          placeholder="请输入设备组描述（可选）"
          :rows="3"
          :maxlength="200"
        />
      </a-form-item>

      <a-form-item
        label="选择设备"
        name="deviceIds"
      >
        <div style="border: 1px solid #d9d9d9; border-radius: 6px; padding: 16px; max-height: 300px; overflow-y: auto;">
          <a-checkbox-group
            v-model:value="form.deviceIds"
            style="width: 100%"
          >
            <div v-for="room in roomGroups" :key="room.name" style="margin-bottom: 16px;">
              <div style="font-weight: 600; color: #1890ff; margin-bottom: 8px;">
                📁 {{ room.name }} ({{ room.devices.length }} 个设备)
              </div>
              <a-row :gutter="[8, 8]">
                <a-col :span="24" v-for="device in room.devices" :key="device.id">
                  <a-checkbox :value="device.id">
                    <span>{{ device.name }}</span>
                    <a-tag size="small" :color="device.type === 'tcp' ? 'blue' : 'green'" style="margin-left: 8px;">
                      {{ device.type.toUpperCase() }}
                    </a-tag>
                    <span style="color: #666; font-size: 12px; margin-left: 4px;">({{ device.ip }})</span>
                  </a-checkbox>
                </a-col>
              </a-row>
            </div>
          </a-checkbox-group>
        </div>
      </a-form-item>

      <a-form-item
        label="默认操作"
      >
        <a-space direction="vertical" style="width: 100%">
          <a-card size="small" title="快捷操作配置">
            <a-space wrap>
              <a-tag 
                v-for="action in quickActions" 
                :key="action.key"
                :color="action.color"
                style="margin-bottom: 8px"
              >
                {{ action.label }}
              </a-tag>
            </a-space>
          </a-card>
        </a-space>
      </a-form-item>
    </a-form>

    <template #footer>
      <a-space>
        <a-button @click="handleCancel">取消</a-button>
        <a-button type="primary" @click="handleSave" :loading="loading">
          {{ editing ? '更新' : '创建' }}
        </a-button>
        <a-button v-if="editing" type="primary" danger @click="handleDelete" :loading="loading">
          删除组
        </a-button>
      </a-space>
    </template>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { message } from 'ant-design-vue';

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  devices: {
    type: Array,
    default: () => []
  },
  group: {
    type: Object,
    default: null
  },
  editing: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:open', 'save', 'delete']);

const formRef = ref();
const loading = ref(false);

const form = ref({
  name: '',
  description: '',
  deviceIds: []
});

const rules = {
  name: [
    { required: true, message: '请输入设备组名称', trigger: 'blur' },
    { min: 2, max: 50, message: '组名称长度应为2-50个字符', trigger: 'blur' }
  ]
};

const quickActions = [
  { key: 'powerOn', label: '批量开机', color: 'green' },
  { key: 'powerOff', label: '批量关机', color: 'red' },
  { key: 'status', label: '批量状态查询', color: 'blue' },
  { key: 'test', label: '批量连接测试', color: 'orange' }
];

// Define resetForm function first
const resetForm = () => {
  form.value = {
    name: '',
    description: '',
    deviceIds: []
  };
  formRef.value?.resetFields();
};

// Room-based device grouping
const roomGroups = computed(() => {
  const roomMap = {};
  
  props.devices.forEach(device => {
    const roomName = device.room || '未分类';
    if (!roomMap[roomName]) {
      roomMap[roomName] = {
        name: roomName,
        devices: []
      };
    }
    roomMap[roomName].devices.push(device);
  });
  
  return Object.values(roomMap);
});

// Watch for changes in the group prop
watch(() => props.group, (newGroup) => {
  if (newGroup) {
    form.value = {
      name: newGroup.name || '',
      description: newGroup.description || '',
      deviceIds: newGroup.deviceIds || []
    };
  } else {
    resetForm();
  }
}, { immediate: true });

// Watch for open changes
watch(() => props.open, (newOpen) => {
  if (!newOpen) {
    resetForm();
  }
});

const handleSave = async () => {
  try {
    await formRef.value.validate();
    
    if (form.value.deviceIds.length === 0) {
      message.warning('请至少选择一个设备');
      return;
    }
    
    loading.value = true;
    
    const groupData = {
      ...form.value,
      id: props.editing ? props.group.id : Date.now().toString(),
      createdAt: props.editing ? props.group.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    emit('save', groupData);
    
  } catch (error) {
    console.error('Form validation failed:', error);
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  emit('update:open', false);
  resetForm();
};

const handleDelete = () => {
  if (props.group && props.group.id) {
    emit('delete', props.group.id);
  }
};
</script>

<style scoped>
/* Device group modal styles */
.ant-checkbox-group {
  width: 100%;
}

.ant-checkbox-wrapper {
  margin-bottom: 8px;
}
</style>