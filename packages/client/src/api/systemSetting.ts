import { apiPrefix, fetchData } from '@/utils'
import type { SystemSettingResponse } from '@envm/schemas'

const BASE = `${apiPrefix}/system-setting`

export const systemSettingApi = {
  /** 获取系统设置 */
  get: () => fetchData<SystemSettingResponse>(`${BASE}`),
  /** 更新系统设置（当前仅注入资源开关） */
  update: (injectEnabled: boolean) =>
    fetchData<SystemSettingResponse>({ url: `${BASE}`, data: { injectEnabled } }),
}
