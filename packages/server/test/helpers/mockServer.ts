import express, { Express } from 'express'
import { Server } from 'http'
import { getRandomPort } from './port.js'

export interface MockServer {
  app: Express
  port: number
  url: string
  server: Server
  stop: () => Promise<void>
}

/**
 * 创建一个 Mock HTTP 服务器，用于模拟 DevServer 或 API Server。
 * @param setupRoutes - 可选的路由配置函数，接收 Express app 实例
 */
export async function createMockServer(
  setupRoutes?: (app: Express) => void
): Promise<MockServer> {
  const port = await getRandomPort()
  const app = express()

  // 默认健康检查路由
  app.get('/health', (_req, res) => res.json({ ok: true }))

  // 注入自定义路由
  if (setupRoutes) {
    setupRoutes(app)
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      resolve({
        app,
        port,
        url: `http://localhost:${port}`,
        server,
        stop: () =>
          new Promise<void>((res) => server.close(() => res())),
      })
    })
    server.on('error', reject)
  })
}
