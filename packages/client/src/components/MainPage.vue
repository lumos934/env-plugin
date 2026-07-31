<script lang="ts" setup>
import ApiServerEdit from './ApiServerEdit.vue'
import DevServerEdit from './DevServerEdit.vue'
import ApiServerTable from './ApiServerTable.vue'
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'
import { apiPrefix, fetchData } from '@/utils'
import DevServerTable from './DevServerTable.vue'
import RequestLogTable from './RequestLogTable.vue'
import type { RequestLogEntry } from '@envm/schemas'
import { Plus, Refresh, Delete } from '@element-plus/icons-vue'

const refreshLoading = ref(false)

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

onMounted(() => {
  startWs()
})

const apiServerTableRef = ref()
const devServerTableRef = ref()

// 请求日志状态（客户端镜像 500 条上限）
const requestLogs = ref<RequestLogEntry[]>([])
const MAX_LOG_ENTRIES = 500
/**
 * 刷新表格
 */
const refreshList = () => {
  refreshLoading.value = true
  Promise.all([apiServerTableRef.value?.refresh(), devServerTableRef.value?.refresh()]).finally(
    () => {
      refreshLoading.value = false
    },
  )
}

/**
 * 刷新指定表格
 */
const refreshTable = (tab: { props: { name: string } }) => {
  if (tab.props.name === 'api-server') {
    apiServerTableRef.value?.refresh()
  } else if (tab.props.name === 'dev-server') {
    devServerTableRef.value?.refresh()
  } else if (tab.props.name === 'request-log') {
    // 请求日志是实时推送的，无需刷新
  }
}

/**
 * 清楚代理cookie
 */
const clearProxyCookies = () => {
  fetchData(`${apiPrefix}/clear-proxy-cookie`).then(() => {
    ElMessage.success('操作成功')
  })
}
const reconnect = () => {
  setTimeout(() => {
    console.log(`尝试重新连接ing...`)
    startWs()
  }, 2000)
}
const startWs = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host

  // 构建 WebSocket 连接的 URL
  const socketUrl = `${protocol}//${host}/${apiPrefix}`

  const socket = new WebSocket(socketUrl)

  // 连接建立时触发
  socket.addEventListener('open', () => {
    console.log('WebSocket 连接已建立')
    refreshList()

    // 当 WebSocket 连接关闭时，清除定时器
    socket.addEventListener('close', () => {
      console.log('WebSocket 连接已关闭')
      reconnect()
    })
  })

  // 接收到消息时触发
  socket.addEventListener('message', (event) => {
    console.log('收到消息:', event.data)
    const data = JSON.parse(event.data)
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
  })

  // 连接出错时触发
  socket.addEventListener('error', () => {
    // console.error('WebSocket 连接出错:', event)
    reconnect()
  })
}
</script>
<template>
  <el-button
    type="primary"
    :icon="Plus"
    plain
    @click="handleAddApiServer"
    :loading="refreshLoading"
  >
    新增API Server
  </el-button>
  <el-button
    type="primary"
    :icon="Plus"
    plain
    @click="handleAddDevServer"
    :loading="refreshLoading"
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
    :loading="refreshLoading"
  >
    清除所有代理 Cookie
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
      <api-server-table ref="apiServerTableRef"></api-server-table>
    </el-tab-pane>
    <el-tab-pane
      label="Dev Server"
      name="dev-server"
    >
      <dev-server-table ref="devServerTableRef"></dev-server-table>
    </el-tab-pane>
    <el-tab-pane
      label="请求日志"
      name="request-log"
    >
      <request-log-table :logs="requestLogs" />
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
</template>
