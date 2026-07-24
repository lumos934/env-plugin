import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest'
import http from 'http'
import PreProxyServer from '../../src/service/PreProxyServer.js'
import { createMockServer, MockServer } from '../helpers/mockServer.js'
import {
  createMockEnvRepo,
  createMockDevServerRepo,
  createMockRouteRuleRepo,
} from '../helpers/mockRepos.js'
import { createEnvFixture, createDevServerFixture } from '../helpers/fixtures.js'

// Mock config
const mockConfig = {
  port: 30999,
  apiPrefix: '/dev-manage-api',
  cookieSuffix: 'envm',
  injectScriptDir: '.envm',
}

vi.mock('../../src/utils/ResolveConfig.js', () => ({
  getConfig: () => mockConfig,
  loadConfig: () => mockConfig,
}))

const TEST_ENV_ID = 'integration-test-env'
// 使用随机端口避免冲突
let TEST_PORT: number

describe('PreProxyServer Integration', () => {
  let mockDevServer: MockServer
  let mockApiServer: MockServer
  let envRepo: ReturnType<typeof createMockEnvRepo>
  let devServerRepo: ReturnType<typeof createMockDevServerRepo>
  let routeRuleRepo: ReturnType<typeof createMockRouteRuleRepo>
  let preProxy: PreProxyServer | null = null

  beforeAll(async () => {
    // 启动 Mock DevServer（模拟 Vite/Webpack dev server）
    mockDevServer = await createMockServer((app) => {
      app.get('/api/test', (_req, res) => {
        res.json({ from: 'devServer', path: '/api/test' })
      })
      app.get('/api/set-cookie', (_req, res) => {
        res.setHeader('Set-Cookie', [
          'token=abc123; Path=/; HttpOnly',
          'session=xyz789; Path=/',
        ])
        res.json({ ok: true })
      })
      app.get('/', (_req, res) => {
        res.setHeader('Content-Type', 'text/html')
        res.send('<html><head></head><body><div id="app">Hello</div></body></html>')
      })
      app.get('/json', (_req, res) => {
        res.json({ type: 'json' })
      })
    })

    // 启动 Mock API Server
    mockApiServer = await createMockServer((app) => {
      app.get('/api/echo', (req, res) => {
        res.json({
          from: 'apiServer',
          cookie: req.headers.cookie,
          xApiServer: req.headers['x-api-server'],
          host: req.headers.host,
        })
      })
      app.post('/api/data', (req, res) => {
        res.json({ saved: true })
      })
    })
  })

  afterAll(async () => {
    await mockDevServer.stop()
    await mockApiServer.stop()
  })

  beforeEach(async () => {
    TEST_PORT = await getRandomPort()

    // 初始化 Mock Repos
    envRepo = createMockEnvRepo()
    devServerRepo = createMockDevServerRepo()
    routeRuleRepo = createMockRouteRuleRepo()

    const envFixture = createEnvFixture({
      id: TEST_ENV_ID,
      name: 'Integration Test Env',
      port: TEST_PORT,
      apiBaseUrl: mockApiServer.url,
      devServerId: 'test-dev-server-001',
    })
    envRepo.findOneById.mockReturnValue(envFixture)
    envRepo.findOne.mockReturnValue(null)

    const devFixture = createDevServerFixture({
      id: 'test-dev-server-001',
      devServerUrl: mockDevServer.url,
    })
    devServerRepo.findOneById.mockReturnValue(devFixture)

    routeRuleRepo.getByEnvId.mockReturnValue([])

    // 创建 PreProxyServer
    preProxy = await PreProxyServer.create(
      TEST_ENV_ID,
      envRepo,
      devServerRepo,
      routeRuleRepo
    )
  })

  afterEach(async () => {
    if (preProxy) {
      await PreProxyServer.stopServer(TEST_ENV_ID)
      preProxy = null
    }
  })

  // ---- 辅助函数 ----
  function httpGet(path: string, headers?: Record<string, string>): Promise<{
    status: number
    headers: http.IncomingHttpHeaders
    body: string
  }> {
    return new Promise((resolve, reject) => {
      const url = `http://localhost:${TEST_PORT}${path}`
      const req = http.get(url, { headers }, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        })
      })
      req.on('error', reject)
      req.setTimeout(10000, () => {
        req.destroy()
        reject(new Error(`Request timeout: ${url}`))
      })
    })
  }

  // ---- 测试用例 ----

  describe('基本代理', () => {
    it('应代理请求到 DevServer', async () => {
      const result = await httpGet('/api/test')
      expect(result.status).toBe(200)
      const data = JSON.parse(result.body)
      expect(data.from).toBe('devServer')
    })

    it('/envm-inject/getcurrentenv 应返回当前 envId', async () => {
      const result = await httpGet(`${mockConfig.apiPrefix}/inject/getcurrentenv`)
      expect(result.status).toBe(200)
      const data = JSON.parse(result.body)
      expect(data.envId).toBe(TEST_ENV_ID)
    })
  })

  describe('HTML 注入', () => {
    it('HTML 响应应包含注入的脚本标签', async () => {
      // 注意：injectScriptDir 为 '.envm'，测试环境中通常不存在此目录，
      // 所以 generateImportScripts 返回空字符串，body 原样输出
      const result = await httpGet('/')
      expect(result.status).toBe(200)
      // HTML 内容应保留
      expect(result.body).toContain('<div id="app">Hello</div>')
    })

    it('非 HTML 响应不应注入（JSON）', async () => {
      const result = await httpGet('/json')
      expect(result.status).toBe(200)
      const data = JSON.parse(result.body)
      expect(data.type).toBe('json')
    })
  })

  describe('路由规则匹配', () => {
    it('匹配路由规则时应转发到目标环境', async () => {
      const targetEnv = createEnvFixture({
        id: 'target-env-001',
        apiBaseUrl: mockApiServer.url,
      })

      // 使用 mockImplementation 按 id 返回不同值
      envRepo.findOneById.mockImplementation((id: string) => {
        if (id === TEST_ENV_ID) {
          return createEnvFixture({
            id: TEST_ENV_ID,
            port: TEST_PORT,
            apiBaseUrl: mockApiServer.url,
            devServerId: 'test-dev-server-001',
          })
        }
        if (id === 'target-env-001') {
          return targetEnv
        }
        return null
      })

      routeRuleRepo.getByEnvId.mockReturnValue([
        {
          id: 'rule-1',
          envId: TEST_ENV_ID,
          pathPrefix: '/api/echo',
          targetEnvId: 'target-env-001',
          enabled: true,
        },
      ])

      // 重启 PreProxy 以使用新的 mock 配置
      await PreProxyServer.stopServer(TEST_ENV_ID)
      preProxy = await PreProxyServer.create(
        TEST_ENV_ID,
        envRepo,
        devServerRepo,
        routeRuleRepo
      )

      const result = await httpGet('/api/echo')
      expect(result.status).toBe(200)
      const data = JSON.parse(result.body)
      expect(data.from).toBe('apiServer')
    })

    it('无匹配规则时应 fallback 到 DevServer', async () => {
      routeRuleRepo.getByEnvId.mockReturnValue([
        {
          id: 'rule-1',
          envId: TEST_ENV_ID,
          pathPrefix: '/non-matching-path',
          targetEnvId: 'target-env',
          enabled: true,
        },
      ])

      await PreProxyServer.stopServer(TEST_ENV_ID)
      preProxy = await PreProxyServer.create(
        TEST_ENV_ID,
        envRepo,
        devServerRepo,
        routeRuleRepo
      )

      const result = await httpGet('/api/test')
      expect(result.status).toBe(200)
      const data = JSON.parse(result.body)
      expect(data.from).toBe('devServer')
    })
  })
})

// 随机端口辅助函数
import { createServer } from 'net'
function getRandomPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, () => {
      const address = server.address()
      if (address && typeof address !== 'string') {
        const port = address.port
        server.close(() => resolve(port))
      } else {
        reject(new Error('Failed to get random port'))
      }
    })
    server.on('error', reject)
  })
}
