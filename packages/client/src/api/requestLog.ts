import { apiPrefix, fetchData } from '@/utils'
import type { LogListResponse } from '@envm/schemas'

const BASE = `${apiPrefix}/request-log`

export const requestLogApi = {
  /** 获取历史请求日志 */
  list: () => fetchData<LogListResponse>(`${BASE}/list`),
}
