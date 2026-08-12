import { ref } from 'vue'
import { fetchData, apiPrefix } from '@/utils'
import type { ListResponse } from '@envm/schemas'

/**
 * 创建带模块级缓存的列表 composable 工厂函数。
 *
 * 每个调用（createUseList<Type>('endpoint')）创建一个独立的闭包，
 * 其中的 list/loading/fetched 状态在模块级别共享，所有组件复用同一份数据。
 */
export function createUseList<T>(endpoint: string) {
  const list = ref<T[]>([])
  const loading = ref(false)
  let fetched = false

  return function useList() {
    const refresh = async () => {
      loading.value = true
      try {
        const data = await fetchData<ListResponse<T>>(`${apiPrefix}/${endpoint}`)
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
}
