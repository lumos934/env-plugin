import { ref } from 'vue'
import { fetchData, apiPrefix } from '@/utils'
import type { DevServerModel, ListResponse } from '@envm/schemas'

// 模块级缓存 —— 所有组件共享同一个响应式引用
const list = ref<DevServerModel[]>([])
const loading = ref(false)
let fetched = false

export function useDevServerList() {
  const refresh = async () => {
    loading.value = true
    try {
      const data = await fetchData<ListResponse<DevServerModel>>(`${apiPrefix}/server/list`)
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
