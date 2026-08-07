import { ref } from 'vue'
import { fetchData, apiPrefix } from '@/utils'
import type { EnvModel, ListResponse } from '@envm/schemas'

// 模块级缓存 —— 所有组件共享同一个响应式引用
const list = ref<EnvModel[]>([])
const loading = ref(false)
let fetched = false

export function useEnvList() {
  const refresh = async () => {
    loading.value = true
    try {
      const data = await fetchData<ListResponse<EnvModel>>(`${apiPrefix}/env/getlist`)
      list.value = data?.list ?? []
      fetched = true
    } finally {
      loading.value = false
    }
    return list.value
  }

  // 首次调用时自动拉取，后续复用缓存
  if (!fetched) {
    refresh()
  }

  return { list, loading, refresh }
}
