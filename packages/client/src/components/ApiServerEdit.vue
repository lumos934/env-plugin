<script lang="ts" setup>
import { reactive } from 'vue'
import { type FormItemRule, ElMessage } from 'element-plus'
import { apiPrefix, fetchData } from '@/utils'
import type { EnvModel } from '@envm/schemas'
import { useDevServerList } from '@/composables/useDevServerList'
import { useFormDialog } from '@/composables/useFormDialog'

const emit = defineEmits<{
  (e: 'refreshList'): void
}>()

const defaultFormData = {
  apiBaseUrl: 'http://127.0.0.1:3010',
  port: 4099,
  name: '',
  devServerId: '',
  homePage: '/TestCom',
  status: 'stopped' as EnvModel['status'],
  description: '',
}

const {
  visible,
  isEditMode,
  submitting,
  formData,
  showDialog,
  closeDialog,
  handleClose,
  submitForm,
} = useFormDialog({
  defaultFormData,
  async onSubmit(data, mode, id) {
    if (mode === 'edit') {
      await fetchData({
        url: `${apiPrefix}/env/update`,
        params: { id, ...data },
      })
    } else {
      await fetchData({
        url: `${apiPrefix}/env/add`,
        method: 'POST',
        params: data,
      })
    }
    ElMessage.success(mode === 'edit' ? '更新成功' : '新增成功')
    closeDialog()
    emit('refreshList')
  },
})

defineExpose({ showDialog, closeDialog })

const rules = reactive<Partial<Record<string, FormItemRule[]>>>({
  name: [{ min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' }],
  port: [{ required: true, message: '请输入端口号', trigger: 'blur' }],
  devServerId: [{ required: true, message: '请选择开发服务器', trigger: 'blur' }],
  apiBaseUrl: [{ required: true, message: '请输入API服务器地址', trigger: 'blur' }],
})

const devServerOptions = useDevServerList().list
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEditMode ? '编辑 API Server' : '新增 API Server'"
    width="600px"
    :before-close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="130px"
      size="default"
    >
      <el-form-item
        label="API Server 地址"
        prop="apiBaseUrl"
      >
        <el-input
          v-model="formData.apiBaseUrl"
          placeholder="例如：http://127.0.0.1:3000"
        />
      </el-form-item>

      <el-form-item
        label="Dev Server 地址"
        prop="devServerId"
      >
        <el-select
          v-model="formData.devServerId"
          placeholder="请选择"
        >
          <el-option
            v-for="item in devServerOptions"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item
        label="绑定本地端口"
        prop="port"
      >
        <el-input-number
          v-model="formData.port"
          :min="3000"
          :max="65535"
          :precision="0"
          size="default"
        />
      </el-form-item>

      <el-form-item
        label="首页地址"
        prop="homePage"
      >
        <el-input v-model="formData.homePage" />
      </el-form-item>

      <el-form-item
        label="环境名称"
        prop="name"
      >
        <el-input
          v-model="formData.name"
          placeholder="请输入"
        />
      </el-form-item>

      <el-form-item
        label="环境描述"
        prop="description"
      >
        <el-input
          type="textarea"
          placeholder="请输入"
          v-model="formData.description"
          :rows="3"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        @click="submitForm"
      >
        保存
      </el-button>
    </template>
  </el-dialog>
</template>
