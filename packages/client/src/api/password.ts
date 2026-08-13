import { apiPrefix, fetchData } from '@/utils'
import type {
  ListResponse,
  PasswordCreate,
  PasswordModel,
  PasswordUpdate,
} from '@envm/schemas'

const BASE = `${apiPrefix}/password`

export const passwordApi = {
  /** 获取指定环境的密码列表 */
  list: (envId: string) =>
    fetchData<ListResponse<PasswordModel>>(`${BASE}/list/${envId}`),
  /** 新增密码 */
  add: (data: PasswordCreate) => fetchData<void>({ url: `${BASE}/add`, data }),
  /** 更新密码 */
  update: (data: PasswordUpdate) => fetchData<void>({ url: `${BASE}/update`, data }),
  /** 删除密码 */
  delete: (id: string) => fetchData<void>({ url: `${BASE}/delete`, data: { id } }),
}
