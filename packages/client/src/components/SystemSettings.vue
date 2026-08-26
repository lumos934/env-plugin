<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { systemSettingApi } from '@/api'

const injectEnabled = ref(false)
const logEnabled = ref(false)

const loadSettings = async () => {
  try {
    const data = await systemSettingApi.get()
    injectEnabled.value = data.injectEnabled
    logEnabled.value = data.logEnabled
  } catch {
    // 获取失败保持默认值，错误已由 fetchData 统一提示
  }
}

const handleInjectToggle = async (value: string | number | boolean) => {
  const next = Boolean(value)
  try {
    const data = await systemSettingApi.update({
      injectEnabled: next,
      logEnabled: logEnabled.value,
    })
    injectEnabled.value = data.injectEnabled
    logEnabled.value = data.logEnabled
    ElMessage.success('设置已保存')
  } catch {
    // 更新失败时回滚开关
    injectEnabled.value = !next
  }
}

const handleLogToggle = async (value: string | number | boolean) => {
  const next = Boolean(value)
  try {
    const data = await systemSettingApi.update({
      injectEnabled: injectEnabled.value,
      logEnabled: next,
    })
    injectEnabled.value = data.injectEnabled
    logEnabled.value = data.logEnabled
    ElMessage.success('设置已保存')
  } catch {
    // 更新失败时回滚开关
    logEnabled.value = !next
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
            @change="handleInjectToggle"
          />
          <div class="setting-tip">
            开启后，被代理页面将注入环境切换悬浮面板与自定义脚本；关闭后不再注入。
          </div>
        </el-form-item>
        <el-form-item label="请求日志记录">
          <el-switch
            v-model="logEnabled"
            @change="handleLogToggle"
          />
          <div class="setting-tip">
            开启后记录代理请求日志并实时推送到「请求日志」面板；默认暂停不记录。
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
