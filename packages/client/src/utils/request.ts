import { ElMessage } from 'element-plus'
import type { BaseResponse } from '@envm/schemas'

// 定义参数类型：字符串（仅URL）或完整参数对象
type FetchDataInput =
  | string
  | {
      url: string
      method?: string
      data?: object
    }
const fetchData = <R = unknown>(input: FetchDataInput) => {
  // 统一处理参数格式
  const options =
    typeof input === 'string' ? { url: input, method: 'GET' } : { method: 'POST', ...input }

  return fetch(options.url, {
    method: options.method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: options.method !== 'GET' ? JSON.stringify(options.data) : undefined,
  })
    .then((res) => {
      // 第一步：先判断HTTP状态码是否成功（2xx）
      if (!res.ok) {
        // 非成功状态：尝试解析响应体（可能是JSON或文本）
        return Promise.all([
          Promise.resolve(res.status), // 保存状态码
          // 尝试解析JSON，失败则返回文本
          res.text().then((text) => {
            try {
              return JSON.parse(text) // 若后端返回JSON格式错误信息
            } catch {
              return false // 若后端返回纯文本（如404页面），其他情况直接返回请求失败
            }
          }),
        ]).then(([status, data]) => {
          // 抛出包含状态码和错误信息的异常
          throw new Error(
            `[${status}] ${typeof data === 'string' ? data : data.message || '请求数据失败，请稍后重试!'}`,
          )
        })
      }

      // 第二步：成功状态（2xx），正常解析JSON
      return res.json() as Promise<BaseResponse<R>>
    })
    .then((res) => {
      // 处理业务状态码（如code !== 200）
      if (res.code !== 200) {
        throw new Error(res.message)
      }
      return res.data
    })
    .catch((error) => {
      console.error('Error fetching data:', error)
      ElMessage.error(error.message || '请求数据失败，请稍后重试')
      return Promise.reject(error)
    })
}

export { fetchData }
