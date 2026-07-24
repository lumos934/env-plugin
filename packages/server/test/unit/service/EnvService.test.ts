import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EnvService } from '../../../src/service/EnvService.js'
import {
  createMockEnvRepo,
  createMockDevServerRepo,
  createMockRouteRuleRepo,
} from '../../helpers/mockRepos.js'
import { createEnvFixture, createEnvCreateFixture } from '../../helpers/fixtures.js'

// Mock PreProxyServer 避免创建真实 HTTP 服务
vi.mock('../../../src/service/PreProxyServer.js', () => ({
  default: {
    create: vi.fn().mockResolvedValue({}),
    stopServer: vi.fn().mockResolvedValue(undefined),
    getAppInsByPort: vi.fn(),
    appMap: {},
    configCookieSuffix: 'envm',
  },
}))

describe('EnvService', () => {
  let service: EnvService
  let mockEnvRepo: ReturnType<typeof createMockEnvRepo>
  let mockDevServerRepo: ReturnType<typeof createMockDevServerRepo>
  let mockRouteRuleRepo: ReturnType<typeof createMockRouteRuleRepo>

  beforeEach(() => {
    mockEnvRepo = createMockEnvRepo()
    mockDevServerRepo = createMockDevServerRepo()
    mockRouteRuleRepo = createMockRouteRuleRepo()
    service = new EnvService(mockEnvRepo, mockDevServerRepo, mockRouteRuleRepo)
  })

  describe('handleAddEnv', () => {
    it('应成功添加新环境', () => {
      const create = createEnvCreateFixture({ apiBaseUrl: 'http://new.example.com' })
      mockEnvRepo.findOneByApiBaseUrl.mockReturnValue(undefined)

      service.handleAddEnv(create)

      expect(mockEnvRepo.addEnv).toHaveBeenCalledTimes(1)
      const addedEnv = mockEnvRepo.addEnv.mock.calls[0][0]
      expect(addedEnv.apiBaseUrl).toBe('http://new.example.com')
      expect(addedEnv.id).toBeDefined()
      expect(addedEnv.status).toBe('stopped')
    })

    it('apiBaseUrl 重复应抛出 AppError', () => {
      const create = createEnvCreateFixture({ apiBaseUrl: 'http://dup.example.com' })
      const existing = createEnvFixture({ apiBaseUrl: 'http://dup.example.com' })
      mockEnvRepo.findOneByApiBaseUrl.mockReturnValue(existing)

      expect(() => service.handleAddEnv(create)).toThrow('已存在')
    })
  })

  describe('handleGetList', () => {
    it('应返回带 routeRuleCount 和 serverIp 的列表', () => {
      const env = createEnvFixture()
      mockEnvRepo.getAll.mockReturnValue([env])
      mockRouteRuleRepo.countByEnvId.mockReturnValue(3)

      const result = service.handleGetList()

      expect(result).toHaveLength(1)
      expect(result[0].routeRuleCount).toBe(3)
      expect(result[0].serverIp).toBeDefined()
    })

    it('无 routeRuleRepo 时应返回原始列表', () => {
      const serviceWithoutRules = new EnvService(mockEnvRepo, mockDevServerRepo)
      const env = createEnvFixture()
      mockEnvRepo.getAll.mockReturnValue([env])

      const result = serviceWithoutRules.handleGetList()

      expect(result).toHaveLength(1)
      expect(result[0].routeRuleCount).toBeUndefined()
    })
  })

  describe('handleUpdateEnv', () => {
    it('应成功更新已有环境', () => {
      const existing = createEnvFixture({ id: 'test-id', name: 'Old' })
      mockEnvRepo.findOneById.mockReturnValue(existing)

      service.handleUpdateEnv({ id: 'test-id', name: 'New' })

      expect(mockEnvRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'test-id', name: 'New' })
      )
    })

    it('环境不存在应抛出 AppError', () => {
      mockEnvRepo.findOneById.mockReturnValue(null)

      expect(() => service.handleUpdateEnv({ id: 'nonexistent', name: 'New' })).toThrow(
        '不存在'
      )
    })
  })

  describe('handleDeleteEnv', () => {
    it('应删除已停止的环境', async () => {
      const env = createEnvFixture({ id: 'delete-me', status: 'stopped' })
      mockEnvRepo.findOneById.mockReturnValue(env)

      await service.handleDeleteEnv({ id: 'delete-me' })

      expect(mockEnvRepo.deleteEnv).toHaveBeenCalledWith({ id: 'delete-me' })
    })

    it('环境不存在应抛出 AppError', async () => {
      mockEnvRepo.findOneById.mockReturnValue(null)

      await expect(service.handleDeleteEnv({ id: 'nonexistent' })).rejects.toThrow('不存在')
    })

    it('删除 running 环境应先停止再删除', async () => {
      const env = createEnvFixture({ id: 'running-env', status: 'running' })
      mockEnvRepo.findOneById
        .mockReturnValueOnce(env) // 第一次：检查存在
        .mockReturnValue(env) // 后续：handleStopServer 查询

      await service.handleDeleteEnv({ id: 'running-env' })

      // handleStopServer 会调用 PreProxyServer.stopServer 和 update
      expect(mockEnvRepo.deleteEnv).toHaveBeenCalled()
    })
  })

  describe('handleUpdateSortOrder', () => {
    it('应成功批量更新排序', () => {
      mockEnvRepo.findOneById.mockReturnValue({ id: 'a', sortOrder: 0 })

      service.handleUpdateSortOrder({
        orders: [
          { id: 'a', sortOrder: 1 },
          { id: 'b', sortOrder: 2 },
        ],
      })

      expect(mockEnvRepo.findOneById).toHaveBeenCalledWith('a')
      expect(mockEnvRepo.findOneById).toHaveBeenCalledWith('b')
    })

    it('某个环境不存在应抛出 AppError', () => {
      mockEnvRepo.findOneById
        .mockReturnValueOnce({ id: 'a', sortOrder: 0 })
        .mockReturnValueOnce(null)

      expect(() =>
        service.handleUpdateSortOrder({
          orders: [{ id: 'a', sortOrder: 1 }, { id: 'b', sortOrder: 2 }],
        })
      ).toThrow('不存在')
    })
  })

  describe('getLocalIp', () => {
    it('应返回字符串类型的 IP 地址', () => {
      const ip = service.getLocalIp()
      expect(typeof ip).toBe('string')
      expect(ip.length).toBeGreaterThan(0)
    })
  })
})
