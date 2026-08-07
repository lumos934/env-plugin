<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Upload } from '@element-plus/icons-vue'
import { apiPrefix, fetchData } from '@/utils'
import { useEnvList } from '@/composables/useEnvList'
import { useDevServerList } from '@/composables/useDevServerList'
import type { EnvModel, ExportData, ImportResult } from '@envm/schemas'

const props = defineProps<{
  mode: 'export' | 'import'
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'refreshList'): void
}>()

const visible = ref(props.modelValue)
watch(
  () => props.modelValue,
  (v) => {
    visible.value = v
    if (v) {
      resetState()
    }
  },
)
watch(visible, (v) => emit('update:modelValue', v))

const title = computed(() => (props.mode === 'export' ? '导出环境配置' : '导入环境配置'))

// ==================== 共享数据 ====================

const { list: envList, refresh: refreshEnvList } = useEnvList()
const { list: devServerList } = useDevServerList()

function resetState() {
  selectedEnvIds.value = []
  encryptPassword.value = ''
  encryptPasswordConfirm.value = ''
  enableEncryption.value = false
  uploadedData.value = null
  conflictStrategy.value = 'skip'
  importPassword.value = ''
  importLoading.value = false
  importResult.value = null
  exportLoading.value = false
  fileName.value = ''
}

// ==================== 导出状态 ====================

const selectedEnvIds = ref<string[]>([])
const enableEncryption = ref(false)
const encryptPassword = ref('')
const encryptPasswordConfirm = ref('')
const exportLoading = ref(false)

const allEnvSelected = computed({
  get: () => envList.value.length > 0 && selectedEnvIds.value.length === envList.value.length,
  set: (val: boolean) => {
    selectedEnvIds.value = val ? envList.value.map((e) => e.id) : []
  },
})

function isSelected(envId: string): boolean {
  return selectedEnvIds.value.includes(envId)
}

function toggleEnv(envId: string) {
  const idx = selectedEnvIds.value.indexOf(envId)
  if (idx >= 0) {
    selectedEnvIds.value.splice(idx, 1)
  } else {
    selectedEnvIds.value.push(envId)
  }
}

function getEnvLabel(env: EnvModel): string {
  return env.name || env.apiBaseUrl
}

async function handleExport() {
  if (selectedEnvIds.value.length === 0) {
    ElMessage.warning('请至少选择一个环境')
    return
  }
  if (enableEncryption.value) {
    if (!encryptPassword.value) {
      ElMessage.warning('请输入加密密码')
      return
    }
    if (encryptPassword.value !== encryptPasswordConfirm.value) {
      ElMessage.warning('两次输入的密码不一致')
      return
    }
  }

  exportLoading.value = true
  try {
    const res = await fetchData({
      url: `${apiPrefix}/env/export`,
      method: 'POST',
      params: {
        envIds: selectedEnvIds.value,
        encryptPassword: enableEncryption.value ? encryptPassword.value : undefined,
      },
    })
    // 触发浏览器下载
    const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `envm-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
    visible.value = false
  } catch {
    // 错误由 fetchData 统一处理
  } finally {
    exportLoading.value = false
  }
}

// ==================== 导入状态 ====================

const uploadedData = ref<ExportData | null>(null)
const fileName = ref('')
const conflictStrategy = ref<'skip' | 'overwrite'>('skip')
const importPassword = ref('')
const importLoading = ref(false)
const importResult = ref<ImportResult | null>(null)

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  fileName.value = file.name
  importResult.value = null

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target?.result as string)
      if (!parsed.version || !Array.isArray(parsed.envs)) {
        ElMessage.error('文件格式不正确：缺少 version 或 envs 字段')
        uploadedData.value = null
        return
      }
      uploadedData.value = parsed
    } catch {
      ElMessage.error('文件解析失败，请确认是有效的 JSON 文件')
      uploadedData.value = null
    }
  }
  reader.readAsText(file)
  // 重置 input 以允许重新选择相同文件
  target.value = ''
}

/** 计算冲突预览 */
const conflictSummary = computed(() => {
  if (!uploadedData.value) return null

  const currentDevServerUrls = new Set(devServerList.value.map((d) => d.devServerUrl))
  const currentApiBaseUrls = new Set(envList.value.map((e) => e.apiBaseUrl))

  const dsList = (uploadedData.value.devServers || []).map(
    (ds: { name: string; devServerUrl: string }) => ({
      ...ds,
      conflict: currentDevServerUrls.has(ds.devServerUrl),
      existingName: currentDevServerUrls.has(ds.devServerUrl)
        ? devServerList.value.find((d) => d.devServerUrl === ds.devServerUrl)?.name
        : undefined,
    }),
  )

  const envList2 = (uploadedData.value.envs || []).map(
    (e: { apiBaseUrl: string; name?: string; port: number }) => ({
      ...e,
      conflict: currentApiBaseUrls.has(e.apiBaseUrl),
      existingName: currentApiBaseUrls.has(e.apiBaseUrl)
        ? envList.value.find((env) => env.apiBaseUrl === e.apiBaseUrl)?.name
        : undefined,
    }),
  )

  return {
    devServers: dsList,
    envs: envList2,
    encrypted: uploadedData.value.encrypted ?? false,
  }
})

/** 冲突的环境数 */
const conflictEnvCount = computed(
  () =>
    conflictSummary.value?.envs.filter((e: { conflict: boolean }) => e.conflict).length ?? 0,
)

/** 新建的环境数 */
const newEnvCount = computed(
  () =>
    conflictSummary.value?.envs.filter((e: { conflict: boolean }) => !e.conflict).length ?? 0,
)

/** 文件输入 ref */
const fileInput = ref<HTMLInputElement>()

function triggerFileSelect() {
  fileInput.value?.click()
}

async function handleImport() {
  if (!uploadedData.value) {
    ElMessage.warning('请先选择要导入的文件')
    return
  }
  if (conflictSummary.value?.encrypted && !importPassword.value) {
    ElMessage.warning('此文件已加密，请输入解密密码')
    return
  }

  importLoading.value = true
  try {
    const res = await fetchData({
      url: `${apiPrefix}/env/import`,
      method: 'POST',
      params: {
        data: uploadedData.value,
        conflictStrategy: conflictStrategy.value,
        decryptPassword: conflictSummary.value?.encrypted ? importPassword.value : undefined,
      },
    })
    importResult.value = res
    ElMessage.success('导入完成')
    refreshEnvList()
    emit('refreshList')
  } catch {
    // 错误由 fetchData 统一处理
  } finally {
    importLoading.value = false
  }
}

function handleClose() {
  visible.value = false
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="700px"
    :before-close="handleClose"
  >
    <!-- ===== 导出模式 ===== -->
    <template v-if="mode === 'export'">
      <p style="margin-bottom: 12px; color: #666">选择要导出的环境（可多选）：</p>

      <el-checkbox v-model="allEnvSelected" style="margin-bottom: 8px">全选 / 取消全选</el-checkbox>

      <div style="max-height: 240px; overflow-y: auto; border: 1px solid #e4e7ed; border-radius: 4px; padding: 8px">
        <el-checkbox
          v-for="env in envList"
          :key="env.id"
          :model-value="isSelected(env.id)"
          @change="toggleEnv(env.id)"
          style="display: block; margin-bottom: 6px"
        >
          {{ getEnvLabel(env) }}
          <span style="color: #909399; font-size: 12px">{{ env.apiBaseUrl }} :{{ env.port }}</span>
        </el-checkbox>
        <div v-if="envList.length === 0" style="color: #909399; text-align: center; padding: 16px">
          暂无环境数据
        </div>
      </div>

      <el-divider />

      <el-checkbox v-model="enableEncryption"> 加密敏感密码字段 </el-checkbox>

      <template v-if="enableEncryption">
        <div style="margin-top: 12px">
          <el-input
            v-model="encryptPassword"
            type="password"
            placeholder="输入加密密码"
            show-password
            style="margin-bottom: 8px"
          />
          <el-input
            v-model="encryptPasswordConfirm"
            type="password"
            placeholder="确认加密密码"
            show-password
          />
        </div>
      </template>
    </template>

    <!-- ===== 导入模式 ===== -->
    <template v-if="mode === 'import'">
      <!-- 文件选择 -->
      <div
        v-if="!uploadedData"
        style="
          border: 2px dashed #d9d9d9;
          border-radius: 8px;
          padding: 40px;
          text-align: center;
          cursor: pointer;
        "
        @click="triggerFileSelect"
        @dragover.prevent
        @drop.prevent="
          (e) => {
            const file = (e as DragEvent).dataTransfer?.files?.[0]
            if (file) handleFileSelect({ target: { files: [file] } } as any)
          }
        "
      >
        <el-icon :size="48" style="color: #c0c4cc"><Upload /></el-icon>
        <p style="color: #606266; margin-top: 12px">点击或拖拽 JSON 文件到此区域</p>
        <input
          ref="fileInput"
          type="file"
          accept=".json"
          style="display: none"
          @change="handleFileSelect"
        />
      </div>

      <!-- 文件预览 -->
      <template v-if="uploadedData && conflictSummary">
        <p style="margin-bottom: 8px">
          已选择文件：<strong>{{ fileName }}</strong>
          （版本 {{ uploadedData.version }}，导出时间 {{ uploadedData.exportedAt }}）
        </p>

        <!-- 加密提示 -->
        <el-alert
          v-if="conflictSummary.encrypted"
          title="此文件已加密，请输入解密密码"
          type="warning"
          :closable="false"
          style="margin-bottom: 12px"
        />
        <el-input
          v-if="conflictSummary.encrypted"
          v-model="importPassword"
          type="password"
          placeholder="输入解密密码"
          show-password
          style="margin-bottom: 12px"
        />

        <!-- 预览表格 -->
        <h4>开发服务器（{{ conflictSummary.devServers.length }} 个）</h4>
        <el-table
          :data="conflictSummary.devServers"
          size="small"
          max-height="150"
          style="margin-bottom: 12px"
        >
          <el-table-column prop="name" label="名称" />
          <el-table-column prop="devServerUrl" label="URL" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag
                v-if="row.conflict"
                type="warning"
                size="small"
              >冲突</el-tag>
              <el-tag
                v-else
                type="success"
                size="small"
              >新建</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <h4>环境（{{ conflictSummary.envs.length }} 个）</h4>
        <el-table
          :data="conflictSummary.envs"
          size="small"
          max-height="200"
          style="margin-bottom: 12px"
        >
          <el-table-column prop="name" label="名称" />
          <el-table-column prop="apiBaseUrl" label="API 地址" />
          <el-table-column
            prop="port"
            label="端口"
            width="70"
          />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag
                v-if="row.conflict"
                type="warning"
                size="small"
              >冲突{{ row.existingName ? ` (${row.existingName})` : '' }}</el-tag>
              <el-tag
                v-else
                type="success"
                size="small"
              >新建</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <!-- 冲突处理策略 -->
        <div v-if="conflictEnvCount > 0 || conflictSummary.devServers.some((d: any) => d.conflict)" style="margin-bottom: 12px">
          <p style="margin-bottom: 8px">
            检测到
            <strong>{{ conflictEnvCount + conflictSummary.devServers.filter((d: any) => d.conflict).length }}</strong>
            个冲突项（{{ newEnvCount }} 个新建，{{ conflictEnvCount }} 个环境冲突），请选择处理方式：
          </p>
          <el-radio-group v-model="conflictStrategy">
            <el-radio value="skip">跳过冲突项（保留已有数据）</el-radio>
            <el-radio value="overwrite">覆盖冲突项（用导入数据替换）</el-radio>
          </el-radio-group>
        </div>
      </template>

      <!-- 导入结果 -->
      <template v-if="importResult">
        <el-divider />
        <h4>导入结果</h4>
        <el-descriptions
          :column="3"
          border
          size="small"
        >
          <el-descriptions-item label="新建环境">{{ importResult.created?.envs ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="跳过环境">{{ importResult.skipped?.envs ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="覆盖环境">{{ importResult.overwritten?.envs ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="新建 DevServer">{{ importResult.created?.devServers ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="新建路由规则">{{ importResult.created?.routeRules ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="新建密码">{{ importResult.created?.passwords ?? 0 }}</el-descriptions-item>
        </el-descriptions>
        <div v-if="importResult.errors?.length > 0" style="margin-top: 8px">
          <el-alert
            v-for="(err, idx) in importResult.errors"
            :key="idx"
            :title="err"
            type="error"
            :closable="false"
            style="margin-bottom: 4px"
          />
        </div>
      </template>
    </template>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
      <el-button
        v-if="mode === 'export'"
        type="primary"
        :icon="Download"
        :loading="exportLoading"
        @click="handleExport"
      >
        导出
      </el-button>
      <el-button
        v-if="mode === 'import' && uploadedData && !importResult"
        type="primary"
        :icon="Upload"
        :loading="importLoading"
        @click="handleImport"
      >
        导入
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
h4 {
  margin: 8px 0 4px;
  font-size: 14px;
  color: #303133;
}
</style>
