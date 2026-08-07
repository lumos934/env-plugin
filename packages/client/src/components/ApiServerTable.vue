<script lang="ts" setup>
import { ElMessage, ElMessageBox, ElBadge } from 'element-plus'
import { ref, watch } from 'vue'
import type { EnvModel } from '@envm/schemas'
import { apiPrefix, fetchData } from '@/utils'
import { useEnvList } from '@/composables/useEnvList'
import { useDevServerList } from '@/composables/useDevServerList'
import ApiServerEdit from './ApiServerEdit.vue'
import RouteRuleDialog from './RouteRuleDialog.vue'
import PasswordDialog from './PasswordDialog.vue'
import { VueDraggable } from 'vue-draggable-plus'
import {
  DocumentCopy,
  Delete,
  Edit,
  VideoPlay,
  VideoPause,
  List,
  Key,
  CopyDocument,
} from '@element-plus/icons-vue'

// 扩展 EnvModel 类型以包含路由规则数量
interface EnvModelWithRouteCount extends EnvModel {
  routeRuleCount?: number
}

// 共享数据源
const { list: _envList, loading: envLoading, refresh: refreshEnvList } = useEnvList()
const { list: devServerList } = useDevServerList()

// 本地可变副本（用于拖拽排序）+ 展示字段 index
const tableData = ref<EnvModelWithRouteCount[]>([])

watch(
  _envList,
  (newList) => {
    tableData.value = newList.map((item) => ({
      ...item,
      index: `${location.protocol}//${location.hostname}:${item.port}${item.homePage}`,
    }))
  },
  { immediate: true },
)

/**
 * 刷新数据
 */
const refresh = () => {
  return refreshEnvList()
}

defineExpose({
  refresh,
})

const handleStart = (rowData: EnvModel) => {
  updateStatus('start', rowData)
}
const handleStop = (rowData: EnvModel) => {
  updateStatus('stop', rowData)
}

const editEnvRef = ref()
const handleModify = (rowData: EnvModel) => {
  if (rowData.status === 'running') {
    ElMessage.error('环境运行中，请停止后调整！')
    return
  }
  editEnvRef.value.showDialog(rowData)
}

const handleCopy = (rowData: EnvModel) => {
  const newEnv = { ...rowData }
  newEnv.name = `${newEnv.name}-副本`
  editEnvRef.value.showDialog(newEnv, true)
}

/**
 * 删除环境
 * @param rowData
 */
const handleDelete = (rowData: EnvModel) => {
  ElMessageBox.confirm(`确定删除环境【${rowData.name || rowData.apiBaseUrl}】吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      return fetchData({
        url: `${apiPrefix}/env/delete`,
        method: 'POST',
        params: rowData,
      }).then(() => {
        ElMessage.success('删除成功')
        refreshEnvList()
      })
    })
    .catch(() => {
      ElMessage.info('已取消删除')
    })
}

/**
 * 启动或者停止服务
 * @param action
 * @param rowData
 */
const updateStatus = (action: string, rowData: EnvModel) => {
  fetchData({
    url: `${apiPrefix}/env/${action}`,
    data: rowData,
  })
    .then(() => {
      refreshEnvList()
      ElMessage.success('操作成功')
    })
}

/**
 * 更新绑定的开发服务器
 * @param devServerId
 * @param rowData
 */
const updateSelectedDevServer = (devServerId: string, rowData: EnvModel) => {
  fetchData({
    url: `${apiPrefix}/env/update`,
    data: {
      id: rowData.id,
      devServerId,
    },
  }).then(() => {
    ElMessage.success('更新成功')
    refreshEnvList()
  })
}
import { useClipboard } from '@vueuse/core'
const { copy, isSupported } = useClipboard()
/**
 * 拷贝APIurl
 */
const copyApiBaseUrl = (url: string) => {
  if (!isSupported) {
    ElMessage.warning('当前浏览器不支持剪贴板功能')
    return
  }
  const regex = /(?<=:\/\/)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?=:\d+|\/|$)/
  // 提取 IP
  const match = url.match(regex)
  const ip = match?.[1] || ''
  if (ip) {
    copy(ip)
      .then(() => {
        ElMessage.success('复制成功')
      })
      .catch(() => {
        ElMessage.error('复制失败')
      })
  }
}

// 复制替换 IP 后的地址
const copyIndexUrl = (item: EnvModelWithRouteCount & { serverIp: string }) => {
  if (!isSupported) {
    ElMessage.warning('当前浏览器不支持剪贴板功能')
    return
  }

  copy(`${location.protocol}//${item.serverIp}:${item.port}${item.homePage}`)
    .then(() => {
      ElMessage.success('复制成功')
    })
    .catch(() => {
      ElMessage.error('复制失败')
    })
}

const routeRuleDialogRef = ref<InstanceType<typeof RouteRuleDialog>>()
const handleRouterDetail = (rowData: EnvModel) => {
  routeRuleDialogRef.value?.showDialog(rowData.id, rowData.name || rowData.apiBaseUrl)
}

const passwordDialogRef = ref<InstanceType<typeof PasswordDialog>>()
const handlePasswordDetail = (rowData: EnvModel) => {
  passwordDialogRef.value?.showDialog(rowData.id, rowData.name || rowData.apiBaseUrl)
}

// ====================== 拖拽排序开始 ======================
const onEnd = () => {
  saveSortOrder(tableData.value)
}

const saveSortOrder = (list: EnvModelWithRouteCount[]) => {
  const orders = list.map((item, index) => ({
    id: item.id,
    sortOrder: index,
  }))
  fetchData({
    url: `${apiPrefix}/env/sort`,
    method: 'PUT',
    data: { orders },
  })
    .then(() => ElMessage.success('排序保存成功'))
    .catch(() => {
      ElMessage.error('排序保存失败')
      refreshEnvList()
    })
}
// ====================== 拖拽排序结束 ======================
</script>
<template>
  <VueDraggable
    v-model="tableData"
    :animation="150"
    target="tbody"
    @end="onEnd"
  >
    <el-table
      :data="tableData"
      style="width: 100%"
      v-loading="envLoading"
      stripe
      row-key="id"
    >
      <el-table-column
        prop="name"
        label="环境名称"
        width="140"
      />
      <el-table-column
        prop="apiBaseUrl"
        label="API服务地址"
        width="180"
      >
        <template #default="scope">
          <el-text @click="copyApiBaseUrl(scope.row.apiBaseUrl)">
            {{ scope.row.apiBaseUrl }}
          </el-text>
        </template>
      </el-table-column>
      <el-table-column
        prop="index"
        label="首页地址"
        show-overflow-tooltip
      >
        <template #default="scope">
          <el-link
            :disabled="scope.row.status === 'stopped'"
            type="primary"
            :href="scope.row.index"
            target="_blank"
          >
            {{ scope.row.index }}
          </el-link>
          <el-button
            :icon="CopyDocument"
            type="primary"
            link
            title="复制IP地址"
            @click="copyIndexUrl(scope.row)"
          ></el-button>
        </template>
      </el-table-column>
      <el-table-column
        prop="port"
        label="绑定端口"
        width="100"
      />
      <el-table-column
        prop="status"
        label="状态"
        width="140"
      >
        <template #default="scope">
          <el-tag
            v-if="scope.row.status === 'stopped'"
            type="danger"
          >
            未启动
          </el-tag>
          <el-tag
            v-else
            type="success"
          >
            已启动
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="devServerId"
        label="DevServer"
      >
        <template #default="scope">
          <el-radio-group
            v-model="scope.row.devServerId"
            @change="(value: string) => updateSelectedDevServer(value, scope.row)"
          >
            <el-radio
              v-for="item in devServerList"
              :key="item.id"
              :value="item.id"
              :title="item.devServerUrl"
              border
              size="small"
            >
              {{ item.name }}
            </el-radio>
          </el-radio-group>
        </template>
      </el-table-column>
      <el-table-column label="操作">
        <template #default="scope">
          <el-button
            type="success"
            circle
            :icon="VideoPlay"
            title="启动环境"
            v-if="scope.row.status === 'stopped'"
            @click="handleStart(scope.row)"
          ></el-button>
          <el-button
            type="info"
            circle
            :icon="VideoPause"
            title="停止环境"
            v-else
            @click="handleStop(scope.row)"
          ></el-button>
          <el-button
            type="primary"
            plain
            circle
            :icon="Edit"
            title="修改环境"
            @click="handleModify(scope.row)"
          ></el-button>
          <el-button
            type="danger"
            :icon="Delete"
            title="删除环境"
            circle
            @click="handleDelete(scope.row)"
          ></el-button>
          <el-button
            type="primary"
            :icon="DocumentCopy"
            title="复制环境"
            circle
            @click="handleCopy(scope.row)"
          ></el-button>
          &nbsp;
          <el-badge
            type="warning"
            :value="scope.row.routeRuleCount"
            :hidden="!scope.row.routeRuleCount"
            :offset="[3, 10]"
            :max="99"
          >
            <el-button
              type="warning"
              :icon="List"
              title="路由表"
              circle
              @click="handleRouterDetail(scope.row)"
            ></el-button>
          </el-badge>
          &nbsp;
          <el-button
            type="success"
            :icon="Key"
            title="密码管理"
            circle
            @click="handlePasswordDetail(scope.row)"
          ></el-button>
        </template>
      </el-table-column>
    </el-table>
  </VueDraggable>
  <api-server-edit
    ref="editEnvRef"
    @refreshList="refresh"
  ></api-server-edit>
  <route-rule-dialog
    ref="routeRuleDialogRef"
    :env-id="''"
  ></route-rule-dialog>
  <password-dialog
    ref="passwordDialogRef"
    :env-id="''"
  ></password-dialog>
</template>
