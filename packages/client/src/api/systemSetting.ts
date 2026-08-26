import { apiPrefix, fetchData } from '@/utils'
import type { SystemSettingResponse, SystemSettingUpdate } from '@envm/schemas'

const BASE = `${apiPrefix}/system-setting`

export const systemSettingApi = {
  /** 获取系统设置 */
  get: () => fetchData<SystemSettingResponse>(`${BASE}`),
  /** 更新系统设置（全量更新注入资源开关 + 请求日志记录开关） */
  update: (data: SystemSettingUpdate) =>
    fetchData<SystemSettingResponse>({ url: `${BASE}`, data }),
}
