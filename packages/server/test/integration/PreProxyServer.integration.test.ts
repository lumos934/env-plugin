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
import { createServer } from 'net'
import * as zlib from 'zlib'
import type { EnvModel } from '../../src/types/index.js'

// ---- Mock Config ----
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

// ---- Mock 注入资源开关（可控，避免触碰真实数据库）----
// 集成测试未初始化数据库，getInjectEnabled 走模块级缓存，这里用 vi.hoisted
// 提供可变状态，使测试可以开关注入行为而不触发 SystemSettingService 的 DB 访问。
const { injectEnabledMock } = vi.hoisted(() => ({
  injectEnabledMock: { value: true },
}))

vi.mock('../../src/service/SystemSettingService.js', () => ({
  getInjectEnabled: () => injectEnabledMock.value,
  SystemSettingService: class {},
}))

// ---- 常量 ----
const TEST_ENV_ID = 'integration-test-env'
const TARGET_ENV_ID = 'target-env-001'
const DEV_SERVER_ID = 'test-dev-server-001'

// ---- 随机端口工具 ----
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

// ---- HTTP 请求辅助函数 ----
function httpGet(
  port: number,
  path: string,
  headers?: Record<string, string>
): Promise<{
  status: number
  headers: http.IncomingHttpHeaders
  body: string
}> {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:${port}${path}`
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

// ---- HTTP 请求辅助函数（返回原始 Buffer，用于压缩响应验证）----
function httpGetBuffer(
  port: number,
  path: string,
  headers?: Record<string, string>
): Promise<{
  status: number
  headers: http.IncomingHttpHeaders
  body: Buffer
}> {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:${port}${path}`
    const req = http.get(url, { headers }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
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

// ---- 主测试套件 ----
describe('PreProxyServer Integration', () => {
  let mockDevServer: MockServer
  let mockApiServer: MockServer
  let envRepo: ReturnType<typeof createMockEnvRepo>
  let devServerRepo: ReturnType<typeof createMockDevServerRepo>
  let routeRuleRepo: ReturnType<typeof createMockRouteRuleRepo>
  let preProxy: PreProxyServer | null = null
  let TEST_PORT: number

  // ================================================================
  // 生命周期
  // ================================================================

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
      // 模拟开启 gzip 压缩的开发服务器（Vite/Webpack/Rspack 等）
      app.get('/gzip-html', (_req, res) => {
        const html =
          '<html><head></head><body><div id="app">Hello Gzip</div></body></html>'
        const compressed = zlib.gzipSync(Buffer.from(html, 'utf8'))
        res.setHeader('Content-Type', 'text/html')
        res.setHeader('Content-Encoding', 'gzip')
        res.setHeader('Content-Length', compressed.length)
        res.end(compressed)
      })
    })

    // 启动 Mock API Server（用于路由规则转发目标）
    mockApiServer = await createMockServer((app) => {
      app.get('/api/echo', (req, res) => {
        res.json({
          from: 'apiServer',
          cookie: req.headers.cookie || '',
          xApiServer: req.headers['x-api-server'],
          host: req.headers.host,
        })
      })
      app.post('/api/data', (_req, res) => {
        res.json({ saved: true })
      })
      // 用于路由规则 Set-Cookie 测试
      app.get('/api/set-cookie', (_req, res) => {
        res.setHeader('Set-Cookie', [
          'apiToken=from-api-server; Path=/; HttpOnly',
        ])
        res.json({ ok: true })
      })
      // 用于 glob 深度路径测试
      app.get('/api/deep/nested/path', (req, res) => {
        res.json({
          from: 'apiServer',
          path: '/api/deep/nested/path',
          cookie: req.headers.cookie || '',
        })
      })
      app.get('/api/user/123', (_req, res) => {
        res.json({ from: 'apiServer', path: '/api/user/123' })
      })
    })
  })

  afterAll(async () => {
    await mockDevServer.stop()
    await mockApiServer.stop()
  })

  // ================================================================
  // 辅助：创建/重启 PreProxy（mock 数据由调用方在调用前设置）
  // ================================================================

  async function restartPreProxy(opts?: {
    envOverrides?: Partial<EnvModel>
    routeRules?: unknown[]
  }) {
    await PreProxyServer.stopServer(TEST_ENV_ID)

    envRepo.findOneById.mockImplementation((id: string) => {
      if (id === TEST_ENV_ID) {
        return createEnvFixture({
          id: TEST_ENV_ID,
          name: 'Integration Test Env',
          port: TEST_PORT,
          apiBaseUrl: mockApiServer.url,
          devServerId: DEV_SERVER_ID,
          ...(opts?.envOverrides || {}),
        })
      }
      if (id === TARGET_ENV_ID) {
        return createEnvFixture({
          id: TARGET_ENV_ID,
          apiBaseUrl: mockApiServer.url,
        })
      }
      return null
    })

    routeRuleRepo.getByEnvId.mockReturnValue(opts?.routeRules || [])

    preProxy = await PreProxyServer.create(
      TEST_ENV_ID,
      envRepo,
      devServerRepo,
      routeRuleRepo
    )
    return preProxy
  }

  beforeEach(async () => {
    TEST_PORT = await getRandomPort()

    envRepo = createMockEnvRepo()
    devServerRepo = createMockDevServerRepo()
    routeRuleRepo = createMockRouteRuleRepo()

    // 默认 mock：无路由规则，环境指向 apiServer，devServer 指向 mockDevServer
    envRepo.findOneById.mockImplementation((id: string) => {
      if (id === TEST_ENV_ID) {
        return createEnvFixture({
          id: TEST_ENV_ID,
          name: 'Integration Test Env',
          port: TEST_PORT,
          apiBaseUrl: mockApiServer.url,
          devServerId: DEV_SERVER_ID,
        })
      }
      if (id === TARGET_ENV_ID) {
        return createEnvFixture({
          id: TARGET_ENV_ID,
          apiBaseUrl: mockApiServer.url,
        })
      }
      return null
    })
    envRepo.findOne.mockReturnValue(null)

    routeRuleRepo.getByEnvId.mockReturnValue([])

    devServerRepo.findOneById.mockReturnValue(
      createDevServerFixture({
        id: DEV_SERVER_ID,
        devServerUrl: mockDevServer.url,
      })
    )

    preProxy = await PreProxyServer.create(
      TEST_ENV_ID,
      envRepo,
      devServerRepo,
      routeRuleRepo
    )
  })

  afterEach(async () => {
    await PreProxyServer.stopServer(TEST_ENV_ID)
    preProxy = null
    // 复位注入开关，避免污染同文件其他注入断言
    injectEnabledMock.value = true
  })

  // ================================================================
  // 基本代理
  // ================================================================

  describe('基本代理', () => {
    it('应代理请求到 DevServer', async () => {
      const result = await httpGet(TEST_PORT, '/api/test')
      expect(result.status).toBe(200)
      const data = JSON.parse(result.body)
      expect(data.from).toBe('devServer')
    })

    it('/dev-manage-api/inject/getcurrentenv 应返回当前 envId', async () => {
      const result = await httpGet(TEST_PORT, `${mockConfig.apiPrefix}/inject/getcurrentenv`)
      expect(result.status).toBe(200)
      const data = JSON.parse(result.body)
      expect(data.envId).toBe(TEST_ENV_ID)
    })
  })

  // ================================================================
  // HTML 注入
  // ================================================================

  describe('HTML 注入', () => {
    it('HTML 响应应包含注入的脚本标签', async () => {
      // injectScriptDir 为 '.envm'，测试环境不存在此目录
      // generateImportScripts 返回空字符串，body 原样输出
      const result = await httpGet(TEST_PORT, '/')
      expect(result.status).toBe(200)
      expect(result.body).toContain('<div id="app">Hello</div>')
    })

    it('非 HTML 响应不应注入（JSON）', async () => {
      const result = await httpGet(TEST_PORT, '/json')
      expect(result.status).toBe(200)
      const data = JSON.parse(result.body)
      expect(data.type).toBe('json')
    })

    it('gzip 压缩的 HTML 响应应被正确解压并注入脚本', async () => {
      const result = await httpGetBuffer(TEST_PORT, '/gzip-html')
      expect(result.status).toBe(200)

      // 响应仍为 gzip 编码，且响应体可被正常解压（不会 ERR_CONTENT_DECODING_FAILED）
      expect(result.headers['content-encoding']).toBe('gzip')
      const decoded = zlib.gunzipSync(result.body).toString('utf8')

      // 解压后应包含原始页面内容
      expect(decoded).toContain('<div id="app">Hello Gzip</div>')
      // 且已注入内置的切换面板脚本
      expect(decoded).toContain('/envm-inject/envm-switcher.js')
    })

    it('关闭注入开关后不应注入脚本（gzip 原样透传）', async () => {
      injectEnabledMock.value = false

      const result = await httpGetBuffer(TEST_PORT, '/gzip-html')
      expect(result.status).toBe(200)

      // 响应仍为 gzip 编码
      expect(result.headers['content-encoding']).toBe('gzip')
      const decoded = zlib.gunzipSync(result.body).toString('utf8')

      // 原始页面内容保留
      expect(decoded).toContain('<div id="app">Hello Gzip</div>')
      // 未注入内置切换面板脚本
      expect(decoded).not.toContain('/envm-inject/envm-switcher.js')
    })
  })

  // ================================================================
  // Cookie 隔离
  // ================================================================

  describe('Cookie 隔离', () => {
    it('Set-Cookie 响应应追加带端口后缀的代理 Cookie', async () => {
      // 无路由规则匹配 → 请求到 devServer 的 /api/set-cookie
      // PreProxy 的 proxyRes 回调应追加后缀 Cookie
      const result = await httpGet(TEST_PORT, '/api/set-cookie')
      expect(result.status).toBe(200)

      const setCookie = result.headers['set-cookie']
      expect(setCookie).toBeDefined()

      // Node.js HTTP 模块在有多个 Set-Cookie 时返回 string[]
      if (Array.isArray(setCookie)) {
        const allCookies = setCookie.join('; ')
        // 原始 Cookie
        expect(allCookies).toContain('token=abc123')
        expect(allCookies).toContain('session=xyz789')
        // 追加的后缀 Cookie: token-{PORT}-envm
        expect(allCookies).toContain(`token-${TEST_PORT}-envm=abc123`)
        expect(allCookies).toContain(`session-${TEST_PORT}-envm=xyz789`)
      } else if (typeof setCookie === 'string') {
        expect(setCookie).toContain('token=abc123')
        expect(setCookie).toContain(`token-${TEST_PORT}-envm=abc123`)
      }
    })

    it('代理请求时应将后缀 Cookie 还原为原始 Cookie 名', async () => {
      // 配置路由规则：/api/echo → API Server（会回显 cookie）
      await restartPreProxy({
        routeRules: [
          {
            id: 'rule-cookie',
            envId: TEST_ENV_ID,
            pathPrefix: '/api/echo',
            targetEnvId: TARGET_ENV_ID,
            enabled: true,
          },
        ],
      })

      // 发送原始 cookie + 后缀 cookie
      // PreProxy._rewrieCookieOnProxyReq 应将 token 的值替换为 token-{PORT}-envm 的值
      const result = await httpGet(TEST_PORT, '/api/echo', {
        cookie: `token=old-value; token-${TEST_PORT}-envm=restored-value`,
      })

      expect(result.status).toBe(200)
      const data = JSON.parse(result.body)
      expect(data.from).toBe('apiServer')
      // API Server 回显的 cookie 中，token 的值应被还原为后缀 cookie 的值
      expect(data.cookie).toContain('token=restored-value')
      // 不应包含后缀 cookie 名（以 envm 结尾的会被跳过）
      expect(data.cookie).not.toContain(`token-${TEST_PORT}-envm`)
    })

    it('无后缀 Cookie 应原样传递到目标服务器', async () => {
      await restartPreProxy({
        routeRules: [
          {
            id: 'rule-cookie-2',
            envId: TEST_ENV_ID,
            pathPrefix: '/api/echo',
            targetEnvId: TARGET_ENV_ID,
            enabled: true,
          },
        ],
      })

      const result = await httpGet(TEST_PORT, '/api/echo', {
        cookie: 'simple=value; another=data',
      })

      expect(result.status).toBe(200)
      const data = JSON.parse(result.body)
      expect(data.cookie).toContain('simple=value')
      expect(data.cookie).toContain('another=data')
    })

    it('路由规则转发时 Set-Cookie 也应追加后缀', async () => {
      // 通过路由规则转发到 API Server 的 /api/set-cookie
      await restartPreProxy({
        routeRules: [
          {
            id: 'rule-set-cookie',
            envId: TEST_ENV_ID,
            pathPrefix: '/api/set-cookie',
            targetEnvId: TARGET_ENV_ID,
            enabled: true,
          },
        ],
      })

      const result = await httpGet(TEST_PORT, '/api/set-cookie')
      expect(result.status).toBe(200)

      const setCookie = result.headers['set-cookie']
      expect(setCookie).toBeDefined()

      if (Array.isArray(setCookie)) {
        const allCookies = setCookie.join('; ')
        expect(allCookies).toContain('apiToken=from-api-server')
        expect(allCookies).toContain(`apiToken-${TEST_PORT}-envm=from-api-server`)
      } else if (typeof setCookie === 'string') {
        expect(setCookie).toContain('apiToken=from-api-server')
        expect(setCookie).toContain(`apiToken-${TEST_PORT}-envm=from-api-server`)
      }
    })
  })

  // ================================================================
  // 路由规则匹配
  // ================================================================

  describe('路由规则匹配', () => {
    it('匹配路由规则时应转发到目标环境', async () => {
      await restartPreProxy({
        routeRules: [
          {
            id: 'rule-1',
            envId: TEST_ENV_ID,
            pathPrefix: '/api/echo',
            targetEnvId: TARGET_ENV_ID,
            enabled: true,
          },
        ],
      })

      const result = await httpGet(TEST_PORT, '/api/echo')
      expect(result.status).toBe(200)
      const data = JSON.parse(result.body)
      expect(data.from).toBe('apiServer')
    })

    it('无匹配规则时应 fallback 到 DevServer', async () => {
      await restartPreProxy({
        routeRules: [
          {
            id: 'rule-nomatch',
            envId: TEST_ENV_ID,
            pathPrefix: '/non-matching-path',
            targetEnvId: TARGET_ENV_ID,
            enabled: true,
          },
        ],
      })

      const result = await httpGet(TEST_PORT, '/api/test')
      expect(result.status).toBe(200)
      const data = JSON.parse(result.body)
      expect(data.from).toBe('devServer')
    })

    it('glob ** 通配符应匹配任意深度路径', async () => {
      await restartPreProxy({
        routeRules: [
          {
            id: 'rule-glob',
            envId: TEST_ENV_ID,
            pathPrefix: '/api/**',
            targetEnvId: TARGET_ENV_ID,
            enabled: true,
          },
        ],
      })

      // 深度嵌套路径
      const result = await httpGet(TEST_PORT, '/api/deep/nested/path')
      expect(result.status).toBe(200)
      const data = JSON.parse(result.body)
      expect(data.from).toBe('apiServer')
      expect(data.path).toBe('/api/deep/nested/path')
    })

    it('glob * 应匹配单层路径', async () => {
      await restartPreProxy({
        routeRules: [
          {
            id: 'rule-single-glob',
            envId: TEST_ENV_ID,
            pathPrefix: '/api/user/*',
            targetEnvId: TARGET_ENV_ID,
            enabled: true,
          },
        ],
      })

      const result = await httpGet(TEST_PORT, '/api/user/123')
      expect(result.status).toBe(200)
      const data = JSON.parse(result.body)
      expect(data.from).toBe('apiServer')
    })

    it('多个规则匹配时应优先最长路径匹配', async () => {
      await restartPreProxy({
        routeRules: [
          {
            id: 'rule-short',
            envId: TEST_ENV_ID,
            pathPrefix: '/api/**',
            targetEnvId: TARGET_ENV_ID, // → apiServer
            enabled: true,
          },
          {
            id: 'rule-long',
            envId: TEST_ENV_ID,
            pathPrefix: '/api/deep/nested/path',
            targetEnvId: '', // 空 targetEnvId → 不会匹配（targetEnvId 为空字符串）
            enabled: true,
          },
        ],
      })

      // rule-long 的 targetEnvId 为空字符串，应跳过
      // rule-short 匹配 → 转发到 apiServer
      const result = await httpGet(TEST_PORT, '/api/deep/nested/path')
      expect(result.status).toBe(200)
      const data = JSON.parse(result.body)
      expect(data.from).toBe('apiServer')
    })

    it('禁用的路由规则不应生效', async () => {
      await restartPreProxy({
        routeRules: [
          {
            id: 'rule-disabled',
            envId: TEST_ENV_ID,
            pathPrefix: '/api/echo',
            targetEnvId: TARGET_ENV_ID,
            enabled: false, // 禁用
          },
        ],
      })

      // 禁用规则不匹配 → fallback 到 DevServer
      // DevServer 没有 /api/echo，返回 404（非 200 说明未转发到 API Server）
      const result = await httpGet(TEST_PORT, '/api/echo')
      expect(result.status).not.toBe(200)
    })

    it('targetEnvId 为空字符串的规则应被忽略', async () => {
      await restartPreProxy({
        routeRules: [
          {
            id: 'rule-empty-target',
            envId: TEST_ENV_ID,
            pathPrefix: '/api/echo',
            targetEnvId: '', // 空字符串
            enabled: true,
          },
        ],
      })

      // 空 targetEnvId → matchRouteRule 返回 null → fallback 到 DevServer
      // DevServer 没有 /api/echo，返回 404（非 200 说明未转发到 API Server）
      const result = await httpGet(TEST_PORT, '/api/echo')
      expect(result.status).not.toBe(200)
    })
  })

  // ================================================================
  // 生命周期
  // ================================================================

  describe('生命周期', () => {
    it('同一环境重复 create 应返回 null（不重复启动）', async () => {
      // 环境已在 beforeEach 中启动
      expect(preProxy).not.toBeNull()

      const duplicate = await PreProxyServer.create(
        TEST_ENV_ID,
        envRepo,
        devServerRepo,
        routeRuleRepo
      )
      expect(duplicate).toBeNull()
    })

    it('stopServer 后可以重新 create', async () => {
      await PreProxyServer.stopServer(TEST_ENV_ID)
      preProxy = null

      const newInstance = await PreProxyServer.create(
        TEST_ENV_ID,
        envRepo,
        devServerRepo,
        routeRuleRepo
      )
      expect(newInstance).not.toBeNull()

      // 验证新实例可正常代理
      const result = await httpGet(TEST_PORT, '/api/test')
      expect(result.status).toBe(200)

      preProxy = newInstance
    })

    it('stopServer 不存在的环境不应报错', async () => {
      // stopServer 对不存在的 id 应安全返回
      const result = await PreProxyServer.stopServer('non-existent-id')
      expect(result).toBe(1)
    })
  })
})
