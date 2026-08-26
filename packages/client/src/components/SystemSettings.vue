<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { systemSettingApi } from '@/api'

const injectEnabled = ref(true)

const loadSettings = async () => {
  try {
    const data = await systemSettingApi.get()
    injectEnabled.value = data.injectEnabled
  } catch {
    // 获取失败保持默认值，错误已由 fetchData 统一提示
  }
}

const handleToggle = async (value: string | number | boolean) => {
  const next = Boolean(value)
  try {
    const data = await systemSettingApi.update(next)
    injectEnabled.value = data.injectEnabled
    ElMessage.success('设置已保存')
  } catch {
    // 更新失败时回滚开关
    injectEnabled.value = !next
  }
}

onMounted(loadSettings)
</script>

<template>
  <div class="system-settings-container">
    <el-card shadow="never">
      <el-form label-width="160px">
        <el-form-item label="注入资源功能">
          <el-switch
            v-model="injectEnabled"
            @change="handleToggle"
          />
          <div class="setting-tip">
            开启后，被代理页面将注入环境切换悬浮面板与自定义脚本；关闭后不再注入。
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.system-settings-container {
  padding: 4px 0;
}

.setting-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
</style>
