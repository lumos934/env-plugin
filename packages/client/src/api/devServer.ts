import { apiPrefix, fetchData } from '@/utils'
import type {
  DevServerCreate,
  DevServerModel,
  DevServerSort,
  DevServerUpdate,
  ListResponse,
} from '@envm/schemas'

const BASE = `${apiPrefix}/server`

export const devServerApi = {
  /** 获取 DevServer 列表 */
  list: () => fetchData<ListResponse<DevServerModel>>(`${BASE}/list`),
  /** 新增 DevServer */
  add: (data: DevServerCreate) => fetchData<void>({ url: `${BASE}/add`, data }),
  /** 更新 DevServer */
  update: (data: DevServerUpdate) =>
    fetchData<void>({ url: `${BASE}/update`, method: 'PUT', data }),
  /** 删除 DevServer */
  delete: (id: string) =>
    fetchData<void>({ url: `${BASE}`, method: 'DELETE', data: { id } }),
  /** 更新排序顺序 */
  sort: (orders: DevServerSort['orders']) =>
    fetchData<void>({ url: `${BASE}/sort`, method: 'PUT', data: { orders } }),
}
