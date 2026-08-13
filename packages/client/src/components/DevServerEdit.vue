<script lang="ts" setup>
import { reactive } from 'vue'
import { type FormItemRule, ElMessage } from 'element-plus'
import { devServerApi } from '@/api'
import { useFormDialog } from '@/composables/useFormDialog'

const emit = defineEmits<{
  (e: 'refreshList'): void
}>()

const defaultFormData = {
  name: '',
  description: '',
  devServerUrl: 'http://127.0.0.1:5173',
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
    // name 为空时回退到 devServerUrl
    const submitData = { ...data, name: data.name || data.devServerUrl }
    if (mode === 'edit' && id) {
      await devServerApi.update({ id, ...submitData })
    } else {
      await devServerApi.add(submitData)
    }
    ElMessage.success(mode === 'edit' ? '更新成功' : '新增成功')
    closeDialog()
    emit('refreshList')
  },
})

defineExpose({ showDialog, closeDialog })

const rules = reactive<Partial<Record<string, FormItemRule[]>>>({
  name: [{ min: 2, max: 30, message: '名称长度需在2-30个字符之间', trigger: 'blur' }],
  devServerUrl: [
    { required: true, message: '请输入开发服务地址', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        const regex =
          /^(http|https):\/\/(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):(3000|[3-9]\d{3}|[1-5]\d{4}|6[0-5]{2}[0-3][0-5])$/
        if (regex.test(value as string)) {
          callback()
        } else {
          callback(new Error('请输入正确的地址（格式：http/https://IP:端口，端口范围3000-65535）'))
        }
      },
      trigger: 'blur',
    },
  ],
  description: [{ max: 200, message: '描述最多200个字符', trigger: 'blur' }],
})
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEditMode ? '编辑 Dev Server' : '新增 Dev Server'"
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
        label="服务地址"
        prop="devServerUrl"
      >
        <el-input
          v-model="formData.devServerUrl"
          placeholder="webpack/vite等启动地址，例如：http://127.0.0.1:3000"
        />
      </el-form-item>

      <el-form-item
        label="服务名称"
        prop="name"
      >
        <el-input
          v-model="formData.name"
          placeholder="请输入开发服务名称"
        />
      </el-form-item>

      <el-form-item
        label="服务描述"
        prop="description"
      >
        <el-input
          type="textarea"
          v-model="formData.description"
          :rows="3"
          placeholder="请输入开发服务描述信息"
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
