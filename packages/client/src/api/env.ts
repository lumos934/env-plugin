import { apiPrefix, fetchData } from '@/utils'
import type {
  EnvCreate,
  EnvModel,
  EnvSort,
  EnvUpdate,
  ExportData,
  ExportRequest,
  ImportRequest,
  ImportResult,
  ListResponse,
} from '@envm/schemas'

const BASE = `${apiPrefix}/env`

export const envApi = {
  /** 获取环境列表（含路由规则数量） */
  getList: () => fetchData<ListResponse<EnvModel>>(`${BASE}/getlist`),
  /** 新增环境 */
  add: (data: EnvCreate) => fetchData<void>({ url: `${BASE}/add`, data }),
  /** 删除环境（级联清理关联规则和密码） */
  delete: (id: string) => fetchData<void>({ url: `${BASE}/delete`, data: { id } }),
  /** 更新环境（含 devServerId 绑定变更） */
  update: (data: EnvUpdate) => fetchData<void>({ url: `${BASE}/update`, data }),
  /** 启动代理服务器 */
  start: (id: string) => fetchData<void>({ url: `${BASE}/start`, data: { id } }),
  /** 停止代理服务器 */
  stop: (id: string) => fetchData<void>({ url: `${BASE}/stop`, data: { id } }),
  /** 更新排序顺序 */
  sort: (orders: EnvSort['orders']) =>
    fetchData<void>({ url: `${BASE}/sort`, method: 'PUT', data: { orders } }),
  /** 导出配置 */
  export: (params: ExportRequest) =>
    fetchData<ExportData>({ url: `${BASE}/export`, data: params }),
  /** 导入配置 */
  import: (params: ImportRequest) =>
    fetchData<ImportResult>({ url: `${BASE}/import`, data: params }),
}
