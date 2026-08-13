<script lang="ts" setup>
import { ref, reactive } from 'vue'
import { type FormItemRule, ElMessage } from 'element-plus'
import { passwordApi } from '@/api'
import type { PasswordModel } from '@envm/schemas'
import { useFormDialog } from '@/composables/useFormDialog'

const emit = defineEmits<{
  (e: 'refreshList'): void
}>()

const currentEnvId = ref('')

const defaultFormData = {
  envId: '',
  name: '',
  username: '',
  password: '',
  description: '',
  isDefault: false,
}

const { visible, isEditMode, submitting, formData, showDialog: _showDialog, closeDialog, handleClose, submitForm } =
  useFormDialog({
    defaultFormData,
    async onSubmit(data, mode, id) {
      if (mode === 'edit' && id) {
        await passwordApi.update({ id, ...data })
      } else {
        await passwordApi.add(data)
      }
      ElMessage.success(mode === 'edit' ? '更新成功' : '新增成功')
      closeDialog()
      emit('refreshList')
    },
  })

// 包装 showDialog，注入 envId
function showDialog(envId: string, passwordItem?: PasswordModel) {
  currentEnvId.value = envId
  if (passwordItem?.id) {
    _showDialog(passwordItem as unknown as Record<string, unknown>)
  } else {
    _showDialog()
    formData.envId = envId
  }
}

defineExpose({ showDialog, closeDialog })

const rules = reactive<Partial<Record<string, FormItemRule[]>>>({
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
})
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEditMode ? '编辑密码' : '新增密码'"
    width="500px"
    :before-close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="80px"
      size="default"
    >
      <el-form-item
        label="名称"
        prop="name"
      >
        <el-input
          v-model="formData.name"
          placeholder="例如：数据库密码、API密钥"
        />
      </el-form-item>

      <el-form-item
        label="用户名"
        prop="username"
      >
        <el-input
          v-model="formData.username"
          placeholder="请输入用户名"
        />
      </el-form-item>

      <el-form-item
        label="密码"
        prop="password"
      >
        <el-input
          v-model="formData.password"
          placeholder="请输入密码"
        />
      </el-form-item>

      <el-form-item
        label="设为默认"
        prop="isDefault"
      >
        <el-switch v-model="formData.isDefault" />
        <span style="margin-left: 8px; color: #909399; font-size: 12px">
          默认密码是唯一的，设为默认将清除其他默认密码
        </span>
      </el-form-item>

      <el-form-item
        label="描述"
        prop="description"
      >
        <el-input
          type="textarea"
          placeholder="请输入"
          v-model="formData.description"
          :rows="2"
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
