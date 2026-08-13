import { apiPrefix, fetchData } from '@/utils'

export const commonApi = {
  /** 清除所有代理 Cookie */
  clearProxyCookies: () => fetchData<void>(`${apiPrefix}/clear-proxy-cookie`),
}
