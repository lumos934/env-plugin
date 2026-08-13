import { apiPrefix, fetchData } from '@/utils'
import type {
  ListResponse,
  RouteRuleCreate,
  RouteRuleModel,
  RouteRuleUpdate,
} from '@envm/schemas'

const BASE = `${apiPrefix}/route-rule`

export const routeRuleApi = {
  /** 获取指定环境的路由规则列表 */
  list: (envId: string) =>
    fetchData<ListResponse<RouteRuleModel>>(`${BASE}/list/${envId}`),
  /** 新增路由规则 */
  add: (data: RouteRuleCreate) => fetchData<void>({ url: `${BASE}/add`, data }),
  /** 更新路由规则 */
  update: (data: RouteRuleUpdate) => fetchData<void>({ url: `${BASE}/update`, data }),
  /** 删除路由规则 */
  delete: (id: string) => fetchData<void>({ url: `${BASE}/delete`, data: { id } }),
}
