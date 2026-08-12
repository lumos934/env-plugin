<script lang="ts" setup>
import { ref, reactive } from 'vue'
import { type FormItemRule, ElMessage } from 'element-plus'
import { apiPrefix, fetchData } from '@/utils'
import type { EnvModel, ListResponse } from '@envm/schemas'
import { useFormDialog } from '@/composables/useFormDialog'

interface RouteRuleModel {
  id?: string
  envId: string
  pathPrefix: string
  targetEnvId: string
  description?: string
  createdAt?: string
  updatedAt?: string
}

const emit = defineEmits<{
  (e: 'refreshList'): void
}>()

const currentEnvId = ref('')

const defaultFormData = {
  envId: '',
  pathPrefix: '',
  targetEnvId: '',
  description: '',
}

const {
  visible,
  isEditMode,
  submitting,
  formData,
  showDialog: _showDialog,
  closeDialog,
  handleClose,
  submitForm,
} = useFormDialog({
  defaultFormData,
  async onSubmit(data, mode, id) {
    if (mode === 'edit') {
      await fetchData({
        url: `${apiPrefix}/route-rule/update`,
        params: { id, ...data },
      })
    } else {
      await fetchData({
        url: `${apiPrefix}/route-rule/add`,
        method: 'POST',
        params: data,
      })
    }
    ElMessage.success(mode === 'edit' ? '更新成功' : '新增成功')
    closeDialog()
    emit('refreshList')
  },
})

// 包装 showDialog，注入 envId 并加载环境列表
function showDialog(envId: string, ruleItem?: RouteRuleModel) {
  currentEnvId.value = envId
  getEnvList()
  if (ruleItem?.id) {
    _showDialog(ruleItem)
  } else {
    _showDialog()
    formData.envId = envId
  }
}

defineExpose({ showDialog, closeDialog })

const rules = reactive<Partial<Record<string, FormItemRule[]>>>({
  pathPrefix: [
    { required: true, message: '请输入路径前缀', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if ((value as string).startsWith('/')) {
          callback()
        } else {
          callback(new Error('路径前缀必须以 / 开头'))
        }
      },
      trigger: 'blur',
    },
  ],
  targetEnvId: [{ required: true, message: '请选择目标环境', trigger: 'change' }],
})

// 环境列表（用于选择目标环境，过滤掉自身）
const envOptions = ref<EnvModel[]>([])
function getEnvList() {
  fetchData<ListResponse<EnvModel>>(`${apiPrefix}/env/getlist`)
    .then((data) => {
      const currentId = currentEnvId.value
      envOptions.value = (data?.list ?? []).filter((env) => !currentId || env.id !== currentId)
    })
    .catch(() => {
      ElMessage.error('获取环境列表失败')
    })
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEditMode ? '编辑路由规则' : '新增路由规则'"
    width="500px"
    :before-close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="120px"
      size="default"
    >
      <el-form-item
        label="路径前缀"
        prop="pathPrefix"
      >
        <el-input
          v-model="formData.pathPrefix"
          placeholder="例如：/api/user"
        />
      </el-form-item>

      <el-form-item
        label="目标环境"
        prop="targetEnvId"
      >
        <el-select
          v-model="formData.targetEnvId"
          placeholder="请选择目标环境"
        >
          <el-option
            v-for="item in envOptions"
            :key="item.id"
            :label="item.name + ' (' + item.apiBaseUrl + ')'"
            :value="item.id"
          />
        </el-select>
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
