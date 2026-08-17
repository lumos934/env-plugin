<script lang="ts" setup>
import { computed, ref, watch, nextTick } from 'vue'
import { VideoPause, VideoPlay, Delete } from '@element-plus/icons-vue'
import type { RequestLogEntry, ResourceType } from '@envm/schemas'
import type { TableInstance } from 'element-plus'

const props = defineProps<{
  logs: RequestLogEntry[]
}>()

const emit = defineEmits<{
  (e: 'clear'): void
}>()

const filterUrl = ref('')
const filterStatusCode = ref<number | undefined>()
type ResourceTypeFilter = 'all' | ResourceType
const filterResourceType = ref<ResourceTypeFilter>('all')

const resourceTypeOptions: { label: string; value: ResourceTypeFilter }[] = [
  { label: '全部', value: 'all' },
  { label: 'Fetch/XHR', value: 'fetch' },
  { label: '文档', value: 'document' },
  { label: 'CSS', value: 'stylesheet' },
  { label: 'JS', value: 'script' },
  { label: '字体', value: 'font' },
  { label: '图片', value: 'image' },
  { label: '媒体', value: 'media' },
  { label: '清单', value: 'manifest' },
  { label: '套接字', value: 'websocket' },
  { label: 'Wasm', value: 'wasm' },
  { label: '其他', value: 'other' },
]
const isPaused = ref(false)
const tableRef = ref<TableInstance>()

// 暂停时的日志快照（冻结视图，避免继续累积新条目）
const frozenLogs = ref<RequestLogEntry[]>([])

// 暂停时显示快照，否则实时显示
const displayedLogs = computed(() => (isPaused.value ? frozenLogs.value : props.logs))

const filteredLogs = computed(() => {
  let result = [...displayedLogs.value]
  if (filterUrl.value) {
    const lower = filterUrl.value.toLowerCase()
    result = result.filter((e) => e.url.toLowerCase().includes(lower))
  }
  if (
    filterStatusCode.value !== undefined &&
    filterStatusCode.value !== null
  ) {
    result = result.filter((e) => e.statusCode === filterStatusCode.value)
  }
  if (filterResourceType.value !== 'all') {
    result = result.filter((e) => e.resourceType === filterResourceType.value)
  }
  return result
})

const togglePause = () => {
  if (isPaused.value) {
    // 继续：恢复实时显示，滚动到底部
    isPaused.value = false
    nextTick(() => {
      tableRef.value?.setScrollTop(Number.MAX_SAFE_INTEGER)
    })
  } else {
    // 暂停：快照当前日志，冻结显示
    frozenLogs.value = [...props.logs]
    isPaused.value = true
  }
}

// 自动滚动到最新条目
watch(
  () => props.logs.length,
  () => {
    if (!isPaused.value) {
      nextTick(() => {
        // 使用 el-table 官方 API 滚动到底部，避免依赖内部 .el-scrollbar__wrap 结构
        tableRef.value?.setScrollTop(Number.MAX_SAFE_INTEGER)
      })
    }
  }
)

const methodTagType = (method: string) => {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'success'
    case 'POST':
      return 'primary'
    case 'PUT':
      return 'warning'
    case 'DELETE':
      return 'danger'
    default:
      return 'info'
  }
}

const statusTagType = (code: number) => {
  if (code >= 200 && code < 300) return 'success'
  if (code >= 300 && code < 400) return 'warning'
  if (code >= 400) return 'danger'
  return 'info'
}

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

const handleClear = () => {
  // 清空实时日志的同时也要清空暂停快照，否则暂停状态下清空无效
  frozenLogs.value = []
  emit('clear')
}
</script>

<template>
  <div class="request-log-container">
    <el-space style="margin-bottom: 12px" wrap>
      <el-input
        v-model="filterUrl"
        placeholder="过滤 URL..."
        clearable
        style="width: 240px"
        size="small"
      />
      <el-select
        v-model="filterResourceType"
        size="small"
        style="width: 120px"
      >
        <el-option
          v-for="opt in resourceTypeOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <el-input-number
        v-model="filterStatusCode"
        placeholder="状态码"
        :min="100"
        :max="599"
        controls-position="right"
        style="width: 140px"
        size="small"
      />
      <el-button
        :type="isPaused ? 'warning' : 'info'"
        :icon="isPaused ? VideoPlay : VideoPause"
        size="small"
        @click="togglePause"
      >
        {{ isPaused ? '继续' : '暂停' }}
      </el-button>
      <el-button
        type="danger"
        :icon="Delete"
        size="small"
        @click="handleClear"
      >
        清空
      </el-button>
      <el-text type="info" size="small">
        {{
          isPaused
            ? `已暂停 — ${filteredLogs.length} 条记录`
            : `实时推送中 (${filteredLogs.length} 条记录)`
        }}
      </el-text>
    </el-space>

    <el-table
      ref="tableRef"
      :data="filteredLogs"
      style="width: 100%"
      height="calc(100vh - 260px)"
      stripe
      size="small"
      border
    >
      <el-table-column
        prop="timestamp"
        label="时间"
        width="100"
        align="center"
      >
        <template #default="scope">
          <el-text size="small">{{ formatTime(scope.row.timestamp) }}</el-text>
        </template>
      </el-table-column>
      <el-table-column
        prop="method"
        label="方法"
        width="80"
        align="center"
      >
        <template #default="scope">
          <el-tag
            :type="methodTagType(scope.row.method)"
            size="small"
            effect="dark"
          >
            {{ scope.row.method }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="url"
        label="URL"
        min-width="240"
        show-overflow-tooltip
      />
      <el-table-column
        prop="statusCode"
        label="状态码"
        width="80"
        align="center"
      >
        <template #default="scope">
          <el-tag
            :type="statusTagType(scope.row.statusCode)"
            size="small"
          >
            {{ scope.row.statusCode || '-' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="duration"
        label="耗时"
        width="80"
        align="center"
        sortable
      >
        <template #default="scope">
          <el-text size="small">{{ scope.row.duration }}ms</el-text>
        </template>
      </el-table-column>
      <el-table-column
        prop="matchedRule"
        label="命中规则"
        width="140"
        align="center"
        show-overflow-tooltip
      >
        <template #default="scope">
          <el-tag
            v-if="scope.row.matchedRule !== 'default'"
            type="success"
            size="small"
            effect="plain"
          >
            {{ scope.row.matchedRule }}
          </el-tag>
          <el-text
            v-else
            size="small"
            type="info"
          >默认</el-text>
        </template>
      </el-table-column>
      <el-table-column
        prop="envName"
        label="环境"
        width="160"
        show-overflow-tooltip
      />
    </el-table>
  </div>
</template>

<style scoped>
.request-log-container {
  padding: 4px 0;
}
</style>
