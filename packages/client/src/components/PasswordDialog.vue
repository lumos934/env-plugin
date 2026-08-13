<script lang="ts" setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { passwordApi } from '@/api'
import type { PasswordModel } from '@envm/schemas'
import { Delete, Edit } from '@element-plus/icons-vue'
import PasswordEdit from './PasswordEdit.vue'

const props = defineProps<{
  envId: string
  envName?: string
}>()

// 使用 ref 来存储运行时值
const currentEnvId = ref(props.envId)
const currentEnvName = ref(props.envName)

const visible = ref(false)
const loading = ref(false)
const tableData = ref<PasswordModel[]>([])

const passwordEditRef = ref()

// 显示对话框
const showDialog = (id?: string, name?: string) => {
  if (id) {
    currentEnvId.value = id
  }
  if (name) {
    currentEnvName.value = name
  }
  visible.value = true
  loadPasswords()
}

// 公开方法供外部调用
defineExpose({
  showDialog,
})

// 获取密码列表
const loadPasswords = () => {
  loading.value = true
  passwordApi.list(currentEnvId.value)
    .then((data) => {
      tableData.value = data?.list ?? []
    })
    .catch(() => {
      ElMessage.error('获取密码列表失败')
    })
    .finally(() => {
      loading.value = false
    })
}

// 打开新增弹窗
const handleAdd = () => {
  passwordEditRef.value?.showDialog(currentEnvId.value)
}

// 打开编辑弹窗
const handleEdit = (row: PasswordModel) => {
  passwordEditRef.value?.showDialog(currentEnvId.value, row)
}

// 删除密码
const handleDelete = (row: PasswordModel) => {
  ElMessageBox.confirm(`确定删除密码【${row.name}】吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      return passwordApi.delete(row.id).then(() => {
        ElMessage.success('删除成功')
        loadPasswords()
      })
    })
    .catch(() => {
      ElMessage.info('已取消删除')
    })
}

// 设置默认密码
const handleSetDefault = async (row: PasswordModel) => {
  try {
    await passwordApi.update({ id: row.id, isDefault: true })
    ElMessage.success('已设为默认密码')
    loadPasswords()
  } catch (error) {
    console.log('设置默认密码失败:', error)
    ElMessage.error('设置默认密码失败')
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
    :title="`密码管理 - ${currentEnvName || currentEnvId}`"
    width="800px"
    :before-close="handleClose"
  >
    <div class="toolbar">
      <el-button
        type="primary"
        @click="handleAdd"
      >
        新增密码
      </el-button>
      <el-button @click="loadPasswords">刷新</el-button>
    </div>

    <el-table
      :data="tableData"
      v-loading="loading"
      style="width: 100%"
      stripe
    >
      <template #empty>
        <el-empty description="暂无密码">
          <el-button
            type="primary"
            @click="handleAdd"
          >
            新增密码
          </el-button>
        </el-empty>
      </template>
      <el-table-column
        prop="isDefault"
        label="默认"
        width="80"
        align="center"
      >
        <template #default="scope">
          <el-tag
            v-if="scope.row.isDefault"
            type="success"
          >
            默认
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="name"
        label="名称"
        min-width="120"
      ></el-table-column>
      <el-table-column
        prop="username"
        label="用户名"
        min-width="120"
      />
      <el-table-column
        prop="password"
        label="密码"
        min-width="120"
      >
        <template #default>********</template>
      </el-table-column>
      <el-table-column
        prop="description"
        label="描述"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column
        label="操作"
        width="200"
        fixed="right"
      >
        <template #default="scope">
          <el-button
            v-if="!scope.row.isDefault"
            type="success"
            size="small"
            title="设为默认"
            @click="handleSetDefault(scope.row)"
          >
            设为默认
          </el-button>
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

  <password-edit
    ref="passwordEditRef"
    @refreshList="loadPasswords"
  ></password-edit>
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
