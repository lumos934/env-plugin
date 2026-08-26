<script lang="ts" setup>
import ApiServerEdit from './ApiServerEdit.vue'
import DevServerEdit from './DevServerEdit.vue'
import ApiServerTable from './ApiServerTable.vue'
import { ElMessage, type TabsPaneContext } from 'element-plus'
import { ref } from 'vue'
import { apiPrefix } from '@/utils'
import { commonApi } from '@/api'
import { useEnvList } from '@/composables/useEnvList'
import { useDevServerList } from '@/composables/useDevServerList'
import { useWebSocket } from '@vueuse/core'
import DevServerTable from './DevServerTable.vue'
import RequestLogTable from './RequestLogTable.vue'
import ImportExportDialog from './ImportExportDialog.vue'
import SystemSettings from './SystemSettings.vue'
import type { RequestLogEntry } from '@envm/schemas'
import { Plus, Refresh, Delete, Download, Upload } from '@element-plus/icons-vue'

const refreshLoading = ref(false)

// 导入/导出对话框状态
const importExportVisible = ref(false)
const importExportMode = ref<'export' | 'import'>('export')

// 导入/导出功能默认禁用，仅当 localStorage 中设置标志后才启用
// 开启方式：localStorage.setItem('envm_import_export_enabled', '1') 后刷新页面
const IMPORT_EXPORT_ENABLED_KEY = 'envm_import_export_enabled'
const importExportEnabled = ref(
  localStorage.getItem(IMPORT_EXPORT_ENABLED_KEY) === '1' ||
    localStorage.getItem(IMPORT_EXPORT_ENABLED_KEY) === 'true'
)

const handleExport = () => {
  importExportMode.value = 'export'
  importExportVisible.value = true
}

const handleImport = () => {
  importExportMode.value = 'import'
  importExportVisible.value = true
}

const apiServerEditRef = ref()
const devServerEditRef = ref()

const handleAddApiServer = () => {
  // 使用 $refs 调用子组件方法
  if (apiServerEditRef.value) {
    apiServerEditRef.value.showDialog()
  }
}
const handleAddDevServer = () => {
  // 使用 $refs 调用子组件方法
  if (devServerEditRef.value) {
    devServerEditRef.value.showDialog()
  }
}

// 请求日志状态（客户端镜像 500 条上限）
const requestLogs = ref<RequestLogEntry[]>([])
const MAX_LOG_ENTRIES = 500

const clearRequestLogs = () => {
  requestLogs.value = []
}

// 共享数据源的刷新方法
const { refresh: refreshEnvList } = useEnvList()
const { refresh: refreshDevServerList } = useDevServerList()

/**
 * 刷新表格
 */
const refreshList = () => {
  refreshLoading.value = true
  Promise.all([refreshEnvList(), refreshDevServerList()]).finally(() => {
    refreshLoading.value = false
  })
}

/**
 * 刷新指定表格
 */
const refreshTable = (tab: TabsPaneContext) => {
  if (tab.paneName === 'api-server') {
    refreshEnvList()
  } else if (tab.paneName === 'dev-server') {
    refreshDevServerList()
  } else if (tab.paneName === 'request-log') {
    // 请求日志是实时推送的，无需刷新
  }
}

/**
 * 清楚代理cookie
 */
const clearProxyCookies = () => {
  commonApi.clearProxyCookies().then(() => {
    ElMessage.success('操作成功')
  })
}
// WebSocket：连接建立时刷新，实时接收 filechange / requestlog 推送
useWebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/${apiPrefix}`, {
  autoReconnect: { delay: 2000 },
  onConnected: () => {
    console.log('WebSocket 连接已建立')
    refreshList()
  },
  onMessage: (_ws, event) => {
    const data = JSON.parse(event.data)
    console.log('收到消息:', data)
    if (data.action === 'filechange') {
      refreshList()
    } else if (data.action === 'requestlog_history') {
      // 初始加载全量历史
      requestLogs.value = data.data || []
    } else if (data.action === 'requestlog') {
      // 增量追加新日志
      if (requestLogs.value.length >= MAX_LOG_ENTRIES) {
        requestLogs.value.shift()
      }
      requestLogs.value.push(data.data)
    }
  },
})
</script>
<template>
  <el-button
    type="primary"
    :icon="Plus"
    plain
    @click="handleAddApiServer"
  >
    新增API Server
  </el-button>
  <el-button
    type="primary"
    :icon="Plus"
    plain
    @click="handleAddDevServer"
  >
    新增Dev Server
  </el-button>
  <el-button
    type="success"
    :icon="Refresh"
    plain
    @click="refreshList"
    :loading="refreshLoading"
  >
    刷新
  </el-button>
  <el-button
    type="warning"
    :icon="Delete"
    plain
    @click="clearProxyCookies"
  >
    清除所有代理 Cookie
  </el-button>
  <el-button
    v-if="importExportEnabled"
    type="primary"
    :icon="Download"
    plain
    @click="handleExport"
  >
    导出配置
  </el-button>
  <el-button
    v-if="importExportEnabled"
    type="primary"
    :icon="Upload"
    plain
    @click="handleImport"
  >
    导入配置
  </el-button>
  <br />
  <br />
  <el-tabs
    type="card"
    @tab-click="refreshTable"
    default-value="api-server"
  >
    <el-tab-pane
      label="API Server"
      name="api-server"
    >
      <api-server-table></api-server-table>
    </el-tab-pane>
    <el-tab-pane
      label="Dev Server"
      name="dev-server"
    >
      <dev-server-table></dev-server-table>
    </el-tab-pane>
    <el-tab-pane
      label="请求日志"
      name="request-log"
    >
      <request-log-table :logs="requestLogs" @clear="clearRequestLogs" />
    </el-tab-pane>
    <el-tab-pane
      label="系统设置"
      name="system-setting"
    >
      <system-settings></system-settings>
    </el-tab-pane>
  </el-tabs>

  <api-server-edit
    ref="apiServerEditRef"
    @refreshList="refreshList"
  ></api-server-edit>
  <dev-server-edit
    ref="devServerEditRef"
    @refreshList="refreshList"
  ></dev-server-edit>

  <import-export-dialog
    v-model="importExportVisible"
    :mode="importExportMode"
    @refreshList="refreshList"
  />
</template>
