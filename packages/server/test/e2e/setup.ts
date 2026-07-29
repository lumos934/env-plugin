import { vi, expect } from 'vitest'
import express from 'express'
import { responseEnhancer } from '../../src/middleware/responseEnhancer.js'
import { globalErrorHandler } from '../../src/middleware/globalErrorHandler.js'
import { createRouter } from '../../src/routes/index.js'
import { setCurrentDb, createMemoryDb, getCurrentDb } from '../helpers/db.js'
import { EnvRepo } from '../../src/repositories/EnvRepo.js'
import { DevServerRepo } from '../../src/repositories/DevServerRepo.js'
import { RouteRuleRepo } from '../../src/repositories/RouteRuleRepo.js'
import { PasswordRepo } from '../../src/repositories/PasswordRepo.js'
import { EnvService } from '../../src/service/EnvService.js'
import { DevServerService } from '../../src/service/DevServerService.js'
import { RouteRuleService } from '../../src/service/RouteRuleService.js'
import { PasswordService } from '../../src/service/PasswordService.js'
import { EnvController } from '../../src/controllers/EnvController.js'
import { DevServerController } from '../../src/controllers/DevServerController.js'
import { RouteRuleController } from '../../src/controllers/RouteRuleController.js'
import { PasswordController } from '../../src/controllers/PasswordController.js'

// ---- Hoisted mutable state ----
// vi.mock 调用在编译时被提升到文件顶部，因此通过 vi.hoisted() 声明可变状态，
// 使 mock 工厂闭包可以访问运行时填充的测试实例。

const { testConfig, deps } = vi.hoisted(() => ({
  testConfig: {
    port: 3099,
    apiPrefix: '/dev-manage-api',
    cookieSuffix: 'envm',
    logLevel: 'silent',
    injectScriptDir: '.envm',
  } as const,
  deps: {} as Record<string, unknown>,
}))

// ---- vi.mock 调用（编译时提升到文件顶部） ----

vi.mock('../../src/utils/ResolveConfig.js', () => ({
  getConfig: () => testConfig,
  loadConfig: vi.fn(),
}))

vi.mock('../../src/repositories/database.js', () => ({
  getDatabase: () => getCurrentDb(),
  startDatabase: () => Promise.resolve(getCurrentDb()),
}))

vi.mock('../../src/service/PreProxyServer.js', () => ({
  default: {
    create: vi.fn().mockResolvedValue({}),
    stopServer: vi.fn().mockResolvedValue(undefined),
    getAppInsByPort: vi.fn(),
    appMap: {},
    configCookieSuffix: 'envm',
  },
}))

vi.mock('../../src/Container.js', () => ({
  Container: {
    getInstance: () => ({
      get: (key: string) => {
        if (!(key in deps)) {
          throw new Error(`Dependency ${key} not found in test container`)
        }
        return deps[key]
      },
    }),
  },
}))

// ---- Express 测试 App 工厂 ----

/**
 * 创建全新的 Express 测试 App。
 *
 * 每次调用会：
 * 1. 创建内存 LokiJS 数据库
 * 2. 实例化真实 Repo → Service → Controller 依赖链
 * 3. 将 Controller 注册到 mock Container 的 deps 中
 * 4. 构建 Express app（middleware 链与 PostProxyServer 一致，减去代理/静态/WebSocket）
 *
 * **必须在 beforeEach 中调用**，确保每个测试用例有完全隔离的数据库状态。
 */
export function createTestApp(): express.Express {
  // 1. 全新内存数据库
  const db = createMemoryDb()
  setCurrentDb(db)

  // 2. 真实 Repo（使用内存 LokiJS）
  const envRepo = new EnvRepo()
  const devServerRepo = new DevServerRepo()
  const routeRuleRepo = new RouteRuleRepo()
  const passwordRepo = new PasswordRepo()

  // 3. 真实 Service
  const envService = new EnvService(envRepo, devServerRepo, routeRuleRepo)
  const devServerService = new DevServerService(devServerRepo, envRepo)
  const routeRuleService = new RouteRuleService(routeRuleRepo, envRepo)
  const passwordService = new PasswordService(passwordRepo)

  // 4. 真实 Controller
  const envController = new EnvController(envService)
  const devServerController = new DevServerController(devServerService)
  const routeRuleController = new RouteRuleController(routeRuleService)
  const passwordController = new PasswordController(passwordService)

  // 5. 注册到 hoisted deps（桥接到 mock Container）
  // 清空旧值再注册新的，避免跨测试污染
  Object.keys(deps).forEach((k) => delete deps[k])
  Object.assign(deps, {
    envController,
    devServerController,
    routeRuleController,
    passwordController,
  })

  // 6. 构建 Express app（middleware 链与 PostProxyServer 一致）
  const app = express()
  app.use(responseEnhancer)
  app.use(testConfig.apiPrefix, createRouter())
  app.use(globalErrorHandler)

  return app
}

// ---- 响应格式断言辅助函数 ----

/**
 * 验证成功响应的标准格式，返回 data 字段以便后续断言。
 *
 * 预期格式：{ code: 200, message: string, data: any, timestamp: number }
 */
export function expectSuccessResponse(body: Record<string, unknown>, expectedCode = 200) {
  expect(body.code).toBe(expectedCode)
  expect(body.message).toBeDefined()
  expect(typeof body.message).toBe('string')
  expect(body.timestamp).toBeDefined()
  expect(typeof body.timestamp).toBe('number')
  return body.data
}

/**
 * 验证错误响应的标准格式。
 *
 * 预期格式：{ code: number, message: string, data?: any, timestamp: number }
 */
export function expectErrorResponse(body: Record<string, unknown>, expectedCode?: number) {
  if (expectedCode !== undefined) {
    expect(body.code).toBe(expectedCode)
  }
  expect(body.message).toBeDefined()
  expect(typeof body.message).toBe('string')
  expect(body.timestamp).toBeDefined()
  expect(typeof body.timestamp).toBe('number')
}
