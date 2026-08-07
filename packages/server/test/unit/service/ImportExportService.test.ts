import { describe, it, expect, beforeEach } from 'vitest'
import { ImportExportService } from '../../../src/service/ImportExportService.js'
import {
  createMockEnvRepo,
  createMockDevServerRepo,
  createMockRouteRuleRepo,
  createMockPasswordRepo,
} from '../../helpers/mockRepos.js'
import {
  createEnvFixture,
  createDevServerFixture,
  createRouteRuleFixture,
  createPasswordFixture,
} from '../../helpers/fixtures.js'
import type { ExportData, ImportRequest } from '../../../src/types/index.js'

function makeExportData(overrides?: Partial<ExportData>): ExportData {
  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    encrypted: false,
    devServers: [],
    envs: [],
    ...overrides,
  }
}

function makeImportRequest(
  data: ExportData,
  overrides?: Partial<ImportRequest>,
): ImportRequest {
  return {
    data,
    conflictStrategy: 'skip',
    ...overrides,
  }
}

describe('ImportExportService', () => {
  let service: ImportExportService
  let mockEnvRepo: ReturnType<typeof createMockEnvRepo>
  let mockDevServerRepo: ReturnType<typeof createMockDevServerRepo>
  let mockRouteRuleRepo: ReturnType<typeof createMockRouteRuleRepo>
  let mockPasswordRepo: ReturnType<typeof createMockPasswordRepo>

  beforeEach(() => {
    mockEnvRepo = createMockEnvRepo()
    mockDevServerRepo = createMockDevServerRepo()
    mockRouteRuleRepo = createMockRouteRuleRepo()
    mockPasswordRepo = createMockPasswordRepo()
    service = new ImportExportService(
      mockEnvRepo,
      mockDevServerRepo,
      mockRouteRuleRepo,
      mockPasswordRepo,
    )
  })

  // ==================== 导出 ====================

  describe('exportEnvs', () => {
    it('应导出指定环境的完整数据包括 routeRules 和 passwords', () => {
      const devServer = createDevServerFixture({ devServerUrl: 'http://localhost:5173' })
      const env = createEnvFixture({
        devServerId: devServer.id,
        apiBaseUrl: 'http://api.example.com',
        port: 4099,
      })
      const rule = createRouteRuleFixture({
        envId: env.id,
        pathPrefix: '/api/user',
        targetEnvId: undefined,
      })
      const pwd = createPasswordFixture({
        envId: env.id,
        name: 'DB',
        username: 'admin',
        password: 'secret',
      })

      mockEnvRepo.getAll.mockReturnValue([env])
      mockDevServerRepo.findOneById.mockReturnValue(devServer)
      mockRouteRuleRepo.getByEnvId.mockReturnValue([rule])
      mockPasswordRepo.getByEnvId.mockReturnValue([pwd])

      const result = service.exportEnvs({ envIds: [env.id] })

      expect(result.envs).toHaveLength(1)
      expect(result.envs[0].apiBaseUrl).toBe('http://api.example.com')
      expect(result.envs[0].devServerUrl).toBe('http://localhost:5173')
      expect(result.envs[0].routeRules).toHaveLength(1)
      expect(result.envs[0].routeRules[0].pathPrefix).toBe('/api/user')
      expect(result.envs[0].passwords).toHaveLength(1)
      expect(result.envs[0].passwords[0].password).toBe('secret')
      expect(result.devServers).toHaveLength(1)
      expect(result.devServers[0].devServerUrl).toBe('http://localhost:5173')
    })

    it('未指定 envIds 时应导出所有环境', () => {
      const env1 = createEnvFixture()
      const env2 = createEnvFixture()
      mockEnvRepo.getAll.mockReturnValue([env1, env2])
      mockDevServerRepo.findOneById.mockReturnValue(null)

      const result = service.exportEnvs({})

      expect(result.envs).toHaveLength(2)
    })

    it('空环境列表应返回空 envs 数组', () => {
      mockEnvRepo.getAll.mockReturnValue([])

      const result = service.exportEnvs({})

      expect(result.envs).toHaveLength(0)
      expect(result.devServers).toHaveLength(0)
    })

    it('导出时 routeRule 的 targetEnvId 应转换为 apiBaseUrl', () => {
      const targetEnv = createEnvFixture({
        id: 'target-id',
        apiBaseUrl: 'http://target.example.com',
      })
      const env = createEnvFixture({ devServerId: undefined })
      const rule = createRouteRuleFixture({
        envId: env.id,
        pathPrefix: '/api/proxy',
        targetEnvId: 'target-id',
      })

      mockEnvRepo.getAll.mockReturnValue([env])
      mockDevServerRepo.findOneById.mockReturnValue(null)
      mockRouteRuleRepo.getByEnvId.mockReturnValue([rule])
      mockPasswordRepo.getByEnvId.mockReturnValue([])
      mockEnvRepo.findOneById.mockReturnValueOnce(targetEnv) // 用于解析 targetEnvId

      const result = service.exportEnvs({ envIds: [env.id] })

      expect(result.envs[0].routeRules[0].targetEnvApiBaseUrl).toBe(
        'http://target.example.com',
      )
    })

    it('应收集关联的 devServers（去重）', () => {
      const ds = createDevServerFixture({ devServerUrl: 'http://localhost:3000' })
      const env1 = createEnvFixture({ devServerId: ds.id })
      const env2 = createEnvFixture({ devServerId: ds.id })

      mockEnvRepo.getAll.mockReturnValue([env1, env2])
      mockDevServerRepo.findOneById.mockReturnValue(ds)

      const result = service.exportEnvs({})

      // 同样的 devServer 只应出现一次
      expect(result.devServers).toHaveLength(1)
      expect(result.devServers[0].devServerUrl).toBe('http://localhost:3000')
    })

    it('env 无 devServerId 时不应包含 devServerUrl', () => {
      const env = createEnvFixture({ devServerId: undefined })
      mockEnvRepo.getAll.mockReturnValue([env])

      const result = service.exportEnvs({})

      expect(result.envs[0].devServerUrl).toBeUndefined()
    })

    it('启用加密时应将所有 password 字段加密为 hex 字符串', () => {
      const env = createEnvFixture({ devServerId: undefined })
      const pwd = createPasswordFixture({ envId: env.id, password: 'my-secret' })

      mockEnvRepo.getAll.mockReturnValue([env])
      mockPasswordRepo.getByEnvId.mockReturnValue([pwd])

      const result = service.exportEnvs({
        envIds: [env.id],
        encryptPassword: 'test-passphrase',
      })

      expect(result.encrypted).toBe(true)
      // 加密后应为 hex 字符串（不同于原始明文的 "my-secret"）
      expect(result.envs[0].passwords[0].password).not.toBe('my-secret')
      expect(typeof result.envs[0].passwords[0].password).toBe('string')
      // hex 字符串应该匹配 [0-9a-f]+ 格式
      expect(result.envs[0].passwords[0].password).toMatch(/^[0-9a-f]+$/)
    })

    it('启用加密但无密码时应保持 encrypted = false', () => {
      const env = createEnvFixture({ devServerId: undefined })
      mockEnvRepo.getAll.mockReturnValue([env])
      mockPasswordRepo.getByEnvId.mockReturnValue([])

      const result = service.exportEnvs({
        envIds: [env.id],
        encryptPassword: 'test-passphrase',
      })

      expect(result.encrypted).toBe(false)
    })
  })

  // ==================== 导入 ====================

  describe('importEnvs', () => {
    it('应成功创建 devServer、env、routeRules 和 passwords', () => {
      const data = makeExportData({
        devServers: [
          {
            name: 'Local',
            devServerUrl: 'http://localhost:5173',
            description: 'Vite dev server',
          },
        ],
        envs: [
          {
            apiBaseUrl: 'http://api.example.com',
            port: 4099,
            name: 'Dev',
            devServerUrl: 'http://localhost:5173',
            routeRules: [
              {
                pathPrefix: '/api/user',
                description: 'User API',
                enabled: true,
              },
            ],
            passwords: [
              {
                name: 'DB',
                username: 'admin',
                password: 'secret',
              },
            ],
          },
        ],
      })

      mockDevServerRepo.findOneByUrl.mockReturnValue(null)
      mockEnvRepo.findOne.mockReturnValue(null)

      const result = service.importEnvs(makeImportRequest(data))

      expect(mockDevServerRepo.addDevServer).toHaveBeenCalledTimes(1)
      expect(mockEnvRepo.addEnv).toHaveBeenCalledTimes(1)
      expect(mockRouteRuleRepo.create).toHaveBeenCalledTimes(1)
      expect(mockPasswordRepo.create).toHaveBeenCalledTimes(1)

      expect(result.created.devServers).toBe(1)
      expect(result.created.envs).toBe(1)
      expect(result.created.routeRules).toBe(1)
      expect(result.created.passwords).toBe(1)
      expect(result.skipped.envs).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('创建的 env 应引用正确的 devServerId', () => {
      const data = makeExportData({
        devServers: [
          { name: 'Local', devServerUrl: 'http://localhost:5173' },
        ],
        envs: [
          {
            apiBaseUrl: 'http://api.example.com',
            port: 4099,
            devServerUrl: 'http://localhost:5173',
          },
        ],
      })

      mockDevServerRepo.findOneByUrl.mockReturnValue(null)
      mockEnvRepo.findOne.mockReturnValue(null)

      service.importEnvs(makeImportRequest(data))

      // 获取 addDevServer 调用时的参数
      const addedDs = mockDevServerRepo.addDevServer.mock.calls[0][0]
      // 获取 addEnv 调用时的参数，devServerId 应该引用新建的 DevServer
      const addedEnv = mockEnvRepo.addEnv.mock.calls[0][0]
      expect(addedEnv.devServerId).toBe(addedDs.id)
    })

    it('routeRule 的 targetEnvApiBaseUrl 应正确解析为本地 envId', () => {
      const data = makeExportData({
        devServers: [],
        envs: [
          {
            apiBaseUrl: 'http://api.example.com',
            port: 4099,
            routeRules: [
              {
                pathPrefix: '/api/proxy',
                targetEnvApiBaseUrl: 'http://target.example.com',
              },
            ],
            passwords: [],
          },
        ],
      })

      mockEnvRepo.findOne.mockReturnValue(null)
      // 第二次 findOne 用于解析 targetEnvApiBaseUrl
      mockEnvRepo.findOne.mockReturnValueOnce(null) // env 本身不存在
      mockEnvRepo.findOne.mockReturnValueOnce({
        id: 'target-env-id',
        apiBaseUrl: 'http://target.example.com',
      } as never)

      service.importEnvs(makeImportRequest(data))

      const createdRule = mockRouteRuleRepo.create.mock.calls[0][0]
      expect(createdRule.targetEnvId).toBe('target-env-id')
    })

    it('targetEnvApiBaseUrl 对应的 env 不存在时应将 targetEnvId 设为 undefined', () => {
      const data = makeExportData({
        devServers: [],
        envs: [
          {
            apiBaseUrl: 'http://api.example.com',
            port: 4099,
            routeRules: [
              {
                pathPrefix: '/api/missing',
                targetEnvApiBaseUrl: 'http://nonexistent.example.com',
              },
            ],
            passwords: [],
          },
        ],
      })

      mockEnvRepo.findOne.mockReturnValueOnce(null) // env 本身不存在
      mockEnvRepo.findOne.mockReturnValueOnce(null) // targetEnvApiBaseUrl 找不到

      service.importEnvs(makeImportRequest(data))

      const createdRule = mockRouteRuleRepo.create.mock.calls[0][0]
      expect(createdRule.targetEnvId).toBeUndefined()
    })

    describe('冲突 - skip 策略', () => {
      it('devServer 已存在时应跳过该 devServer', () => {
        const existingDs = createDevServerFixture({
          id: 'existing-ds-id',
          devServerUrl: 'http://localhost:5173',
        })

        const data = makeExportData({
          devServers: [
            { name: 'New Name', devServerUrl: 'http://localhost:5173' },
          ],
          envs: [],
        })

        mockDevServerRepo.findOneByUrl.mockReturnValue(existingDs)

        const result = service.importEnvs(makeImportRequest(data, { conflictStrategy: 'skip' }))

        expect(mockDevServerRepo.addDevServer).not.toHaveBeenCalled()
        expect(mockDevServerRepo.update).not.toHaveBeenCalled()
        expect(result.skipped.devServers).toBe(1)
      })

      it('env 已存在时应跳过该 env 及其 routeRules 和 passwords', () => {
        const existingEnv = createEnvFixture({
          id: 'existing-env-id',
          apiBaseUrl: 'http://api.example.com',
        })

        const data = makeExportData({
          devServers: [],
          envs: [
            {
              apiBaseUrl: 'http://api.example.com',
              port: 4099,
              routeRules: [{ pathPrefix: '/api/test' }],
              passwords: [{ name: 'pwd', username: 'u', password: 'p' }],
            },
          ],
        })

        mockEnvRepo.findOne.mockReturnValue(existingEnv)

        const result = service.importEnvs(makeImportRequest(data, { conflictStrategy: 'skip' }))

        expect(mockEnvRepo.addEnv).not.toHaveBeenCalled()
        expect(mockRouteRuleRepo.create).not.toHaveBeenCalled()
        expect(mockPasswordRepo.create).not.toHaveBeenCalled()
        expect(result.skipped.envs).toBe(1)
      })
    })

    describe('冲突 - overwrite 策略', () => {
      it('devServer 已存在时应更新其 name 和 description', () => {
        const existingDs = createDevServerFixture({
          id: 'existing-ds-id',
          devServerUrl: 'http://localhost:5173',
          name: 'Old Name',
        })

        const data = makeExportData({
          devServers: [
            { name: 'Updated Name', devServerUrl: 'http://localhost:5173', description: 'Updated desc' },
          ],
          envs: [],
        })

        mockDevServerRepo.findOneByUrl.mockReturnValue(existingDs)

        const result = service.importEnvs(makeImportRequest(data, { conflictStrategy: 'overwrite' }))

        expect(mockDevServerRepo.update).toHaveBeenCalledWith({
          id: 'existing-ds-id',
          name: 'Updated Name',
          description: 'Updated desc',
        })
        expect(result.overwritten.devServers).toBe(1)
      })

      it('env 已存在时应更新 env 字段并替换所有 routeRules 和 passwords', () => {
        const existingEnv = createEnvFixture({
          id: 'existing-env-id',
          apiBaseUrl: 'http://api.example.com',
          port: 3000,
        })

        const data = makeExportData({
          devServers: [],
          envs: [
            {
              apiBaseUrl: 'http://api.example.com',
              port: 4099,
              name: 'Updated Env',
              routeRules: [
                { pathPrefix: '/api/v2' },
              ],
              passwords: [
                { name: 'new-pwd', username: 'user', password: 'pass' },
              ],
            },
          ],
        })

        mockEnvRepo.findOne.mockReturnValue(existingEnv)

        const result = service.importEnvs(makeImportRequest(data, { conflictStrategy: 'overwrite' }))

        // 应更新环境字段
        expect(mockEnvRepo.update).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'existing-env-id', port: 4099, name: 'Updated Env' }),
        )
        // 应先删除旧的 routeRules 和 passwords
        expect(mockRouteRuleRepo.deleteByEnvId).toHaveBeenCalledWith('existing-env-id')
        expect(mockPasswordRepo.deleteByEnvId).toHaveBeenCalledWith('existing-env-id')
        // 再创建新的
        expect(mockRouteRuleRepo.create).toHaveBeenCalledTimes(1)
        expect(mockPasswordRepo.create).toHaveBeenCalledTimes(1)
        expect(result.overwritten.envs).toBe(1)
      })
    })

    describe('加密/解密', () => {
      it('round-trip: 加密导出后解密导入应该恢复原始密码', () => {
        const env = createEnvFixture({ devServerId: undefined })
        const pwd = createPasswordFixture({ envId: env.id, password: 'super-secret-123' })
        mockEnvRepo.getAll.mockReturnValue([env])
        mockPasswordRepo.getByEnvId.mockReturnValue([pwd])

        // Step 1: 加密导出
        const exported = service.exportEnvs({
          envIds: [env.id],
          encryptPassword: 'my-key',
        })
        expect(exported.encrypted).toBe(true)
        const encryptedPassword = exported.envs[0].passwords[0].password
        expect(encryptedPassword).not.toBe('super-secret-123')

        // Step 2: 模拟导入解密
        mockEnvRepo.findOne.mockReturnValue(null)
        const importData: ExportData = {
          ...exported,
          devServers: [],
          envs: exported.envs.map((e) => ({
            ...e,
            routeRules: e.routeRules ?? [],
          })),
        }

        service.importEnvs({
          data: importData,
          conflictStrategy: 'skip',
          decryptPassword: 'my-key',
        })

        // 创建的密码应该是解密后的原始密码
        const createdPwd = mockPasswordRepo.create.mock.calls[0][0]
        expect(createdPwd.password).toBe('super-secret-123')
      })

      it('错误密码导入加密数据应抛出 AppError', () => {
        const env = createEnvFixture({ devServerId: undefined })
        const pwd = createPasswordFixture({ envId: env.id, password: 'secret' })
        mockEnvRepo.getAll.mockReturnValue([env])
        mockPasswordRepo.getByEnvId.mockReturnValue([pwd])

        const exported = service.exportEnvs({
          envIds: [env.id],
          encryptPassword: 'correct-key',
        })

        const importData: ExportData = {
          ...exported,
          devServers: [],
          envs: exported.envs.map((e) => ({
            ...e,
            routeRules: e.routeRules ?? [],
          })),
        }

        expect(() =>
          service.importEnvs({
            data: importData,
            conflictStrategy: 'skip',
            decryptPassword: 'wrong-key',
          }),
        ).toThrow('密码解密失败')
      })
    })

    describe('边界情况', () => {
      it('导入空 envs 数组应返回全 0 结果', () => {
        const result = service.importEnvs(
          makeImportRequest(makeExportData({ envs: [], devServers: [] })),
        )

        expect(result.created.envs).toBe(0)
        expect(result.created.devServers).toBe(0)
        expect(result.created.routeRules).toBe(0)
        expect(result.created.passwords).toBe(0)
        expect(result.errors).toHaveLength(0)
      })

      it('env 无 routeRules 时应正常导入', () => {
        const data = makeExportData({
          envs: [
            {
              apiBaseUrl: 'http://api.example.com',
              port: 4099,
              routeRules: [],
              passwords: [],
            },
          ],
        })

        mockEnvRepo.findOne.mockReturnValue(null)

        service.importEnvs(makeImportRequest(data))

        expect(mockEnvRepo.addEnv).toHaveBeenCalledTimes(1)
        expect(mockRouteRuleRepo.create).not.toHaveBeenCalled()
        expect(mockPasswordRepo.create).not.toHaveBeenCalled()
      })

      it('env 无 passwords 时应正常导入', () => {
        const data = makeExportData({
          envs: [
            {
              apiBaseUrl: 'http://api.example.com',
              port: 4099,
              routeRules: [],
              passwords: [],
            },
          ],
        })

        mockEnvRepo.findOne.mockReturnValue(null)

        service.importEnvs(makeImportRequest(data))

        expect(mockEnvRepo.addEnv).toHaveBeenCalledTimes(1)
        expect(mockPasswordRepo.create).not.toHaveBeenCalled()
      })

      it('无 devServerUrl 的 env 应该正常创建', () => {
        const data = makeExportData({
          envs: [
            {
              apiBaseUrl: 'http://api.example.com',
              port: 4099,
              routeRules: [],
              passwords: [],
            },
          ],
        })

        mockEnvRepo.findOne.mockReturnValue(null)

        service.importEnvs(makeImportRequest(data))

        const addedEnv = mockEnvRepo.addEnv.mock.calls[0][0]
        expect(addedEnv.devServerId).toBeUndefined()
      })
    })
  })
})
