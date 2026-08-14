import { ElMessage } from 'element-plus'
import type { Ref } from 'vue'

/** 排序项：id + 排序序号 */
interface SortOrder {
  id: string
  sortOrder: number
}

/**
 * 拖拽排序 composable：封装 VueDraggable 的 @end 回调与排序持久化逻辑。
 *
 * @param options.list - 当前列表（ref 或 computed，拖拽后顺序以它为准）
 * @param options.sort - 排序 API（提交 orders 持久化）
 * @param options.onRefresh - 排序失败时回滚刷新的回调
 */
export function useDragSort<T extends { id: string }>(options: {
  list: Ref<T[]>
  sort: (orders: SortOrder[]) => Promise<unknown>
  onRefresh?: () => void
}) {
  const onEnd = () => {
    const orders: SortOrder[] = options.list.value.map((item, index) => ({
      id: item.id,
      sortOrder: index,
    }))
    options
      .sort(orders)
      .then(() => ElMessage.success('排序保存成功'))
      .catch(() => {
        ElMessage.error('排序保存失败')
        options.onRefresh?.()
      })
  }

  return { onEnd }
}
