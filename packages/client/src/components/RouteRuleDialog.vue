<script lang="ts" setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { routeRuleApi } from '@/api'
import type { RouteRuleModel } from '@envm/schemas'
import { Delete, Edit } from '@element-plus/icons-vue'
import RouteRuleEdit from './RouteRuleEdit.vue'

const props = defineProps<{
  envId: string
  envName?: string
}>()

// 使用 ref 来存储运行时值
const currentEnvId = ref(props.envId)
const currentEnvName = ref(props.envName)

const visible = ref(false)
const loading = ref(false)
const tableData = ref<RouteRuleModel[]>([])
const switchLoading = ref<Record<string, boolean>>({})

const routeRuleEditRef = ref()

// 显示对话框
const showDialog = (id?: string, name?: string) => {
  if (id) {
    currentEnvId.value = id
  }
  if (name) {
    currentEnvName.value = name
  }
  visible.value = true
  loadRouteRules()
}

// 公开方法供外部调用
defineExpose({
  showDialog,
})

// 获取路由规则列表
const loadRouteRules = () => {
  loading.value = true
  routeRuleApi.list(currentEnvId.value)
    .then((data) => {
      tableData.value = data?.list ?? []
    })
    .catch(() => {
      // 错误提示已由 fetchData 统一处理
    })
    .finally(() => {
      loading.value = false
    })
}

// 打开新增弹窗
const handleAdd = () => {
  routeRuleEditRef.value?.showDialog(currentEnvId.value)
}

// 打开编辑弹窗
const handleEdit = (row: RouteRuleModel) => {
  routeRuleEditRef.value?.showDialog(currentEnvId.value, row)
}

// 删除路由规则
const handleDelete = (row: RouteRuleModel) => {
  ElMessageBox.confirm(`确定删除路由规则【${row.pathPrefix}】吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      return routeRuleApi.delete(row.id).then(() => {
        ElMessage.success('删除成功')
        loadRouteRules()
      })
    })
    .catch(() => {
      ElMessage.info('已取消删除')
    })
}

// 切换规则启用状态
const handleToggleEnabled = async (row: RouteRuleModel) => {
  switchLoading.value[row.id!] = true
  try {
    await routeRuleApi.update({ id: row.id, enabled: row.enabled })
    ElMessage.success(row.enabled ? '已启用' : '已禁用')
  } catch {
    // 回滚状态
    row.enabled = !row.enabled
  } finally {
    switchLoading.value[row.id!] = false
  }
}

// 关闭对话框
const handleClose = () => {
  visible.value = false
}
</script>
<template>
  <el-dialog
    v-model="visible"
    :title="`路由规则配置 - ${currentEnvName || currentEnvId}`"
    width="800px"
    :before-close="handleClose"
  >
    <div class="toolbar">
      <el-button
        type="primary"
        @click="handleAdd"
      >
        新增规则
      </el-button>
      <el-button @click="loadRouteRules">刷新</el-button>
    </div>

    <el-table
      :data="tableData"
      v-loading="loading"
      style="width: 100%"
      stripe
    >
      <template #empty>
        <el-empty description="暂无路由规则">
          <el-button
            type="primary"
            @click="handleAdd"
          >
            新增规则
          </el-button>
        </el-empty>
      </template>
      <el-table-column
        prop="enabled"
        label="状态"
        width="80"
        align="center"
      >
        <template #default="scope">
          <el-switch
            v-model="scope.row.enabled"
            :loading="switchLoading[scope.row.id]"
            @change="handleToggleEnabled(scope.row)"
          />
        </template>
      </el-table-column>
      <el-table-column
        prop="pathPrefix"
        label="路径前缀"
        min-width="150"
      >
        <template #default="scope">
          <el-tag type="info">{{ scope.row.pathPrefix }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="targetEnvName"
        label="目标环境"
        min-width="150"
      >
        <template #default="scope">
          {{ scope.row.targetEnvName || scope.row.targetEnvId }}
        </template>
      </el-table-column>
      <el-table-column
        prop="description"
        label="描述"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column
        label="操作"
        width="120"
        fixed="right"
      >
        <template #default="scope">
          <el-button
            type="primary"
            :icon="Edit"
            circle
            title="编辑"
            @click="handleEdit(scope.row)"
          />
          <el-button
            type="danger"
            :icon="Delete"
            circle
            title="删除"
            @click="handleDelete(scope.row)"
          />
        </template>
      </el-table-column>
    </el-table>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>

  <route-rule-edit
    ref="routeRuleEditRef"
    @refreshList="loadRouteRules"
  ></route-rule-edit>
</template>

<style scoped>
.toolbar {
  margin-bottom: 16px;
  display: flex;
  gap: 8px;
}

.empty-tip {
  padding: 20px 0;
}
</style>
