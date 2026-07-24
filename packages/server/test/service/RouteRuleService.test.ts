import { describe, it, expect, beforeEach } from 'vitest'
import { RouteRuleService } from '../../src/service/RouteRuleService.js'
import {
  createMockRouteRuleRepo,
  createMockEnvRepo,
} from '../helpers/mockRepos.js'
import {
  createRouteRuleFixture,
  createRouteRuleCreateFixture,
  createEnvFixture,
} from '../helpers/fixtures.js'

describe('RouteRuleService', () => {
  let service: RouteRuleService
  let mockRouteRuleRepo: ReturnType<typeof createMockRouteRuleRepo>
  let mockEnvRepo: ReturnType<typeof createMockEnvRepo>

  beforeEach(() => {
    mockRouteRuleRepo = createMockRouteRuleRepo()
    mockEnvRepo = createMockEnvRepo()
    service = new RouteRuleService(mockRouteRuleRepo, mockEnvRepo)
  })

  describe('handleGetByEnvId', () => {
    it('应返回规则列表（含 targetEnvName）', () => {
      const targetEnv = createEnvFixture({ id: 'target-id', name: 'Target', apiBaseUrl: 'http://t.example.com' })
      const rule = createRouteRuleFixture({ envId: 'env-a', targetEnvId: 'target-id' })
      mockRouteRuleRepo.getByEnvId.mockReturnValue([rule])
      mockEnvRepo.findOneById.mockReturnValue(targetEnv)

      const result = service.handleGetByEnvId('env-a')
      expect(result).toHaveLength(1)
      expect(result[0].targetEnvName).toBe('Targethttp://t.example.com')
    })

    it('无 targetEnvId 时 targetEnvName 为空字符串', () => {
      const rule = createRouteRuleFixture({ envId: 'env-a', targetEnvId: undefined })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (rule as any).targetEnvId
      mockRouteRuleRepo.getByEnvId.mockReturnValue([rule])

      const result = service.handleGetByEnvId('env-a')
      expect(result[0].targetEnvName).toBe('')
    })
  })

  describe('handleAdd', () => {
    it('应成功添加路由规则', () => {
      const targetEnv = createEnvFixture({ id: 'target-id' })
      mockEnvRepo.findOneById.mockReturnValue(targetEnv)
      mockRouteRuleRepo.existsByEnvIdAndPathPrefix.mockReturnValue(false)

      const create = createRouteRuleCreateFixture({
        envId: 'env-a',
        pathPrefix: '/api/new',
        targetEnvId: 'target-id',
      })
      const result = service.handleAdd(create)

      expect(mockRouteRuleRepo.create).toHaveBeenCalledTimes(1)
      expect(result.id).toBeDefined()
      expect(result.createdAt).toBeDefined()
    })

    it('目标环境不存在应抛出 Error', () => {
      mockEnvRepo.findOneById.mockReturnValue(null)

      const create = createRouteRuleCreateFixture({ targetEnvId: 'nonexistent' })

      expect(() => service.handleAdd(create)).toThrow('不存在')
    })

    it('空 targetEnvId 应抛出 Error', () => {
      const create = createRouteRuleCreateFixture({ targetEnvId: undefined })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (create as any).targetEnvId

      expect(() => service.handleAdd(create)).toThrow('不能为空')
    })

    it('路径前缀重复应抛出 Error', () => {
      const targetEnv = createEnvFixture({ id: 'target-id' })
      mockEnvRepo.findOneById.mockReturnValue(targetEnv)
      mockRouteRuleRepo.existsByEnvIdAndPathPrefix.mockReturnValue(true)

      const create = createRouteRuleCreateFixture({
        envId: 'env-a',
        pathPrefix: '/api/dup',
        targetEnvId: 'target-id',
      })

      expect(() => service.handleAdd(create)).toThrow('已存在路径前缀')
    })
  })

  describe('handleUpdate', () => {
    it('应成功更新已有规则', () => {
      const existing = createRouteRuleFixture({
        id: 'update-rule',
        envId: 'env-a',
        pathPrefix: '/old',
        targetEnvId: 'target-id',
      })
      mockRouteRuleRepo.findOneById.mockReturnValue(existing)
      mockRouteRuleRepo.existsByEnvIdAndPathPrefix.mockReturnValue(false)
      // handleUpdate 返回 findOneById 的结果
      mockRouteRuleRepo.findOneById.mockReturnValue({ ...existing, pathPrefix: '/new' })

      const result = service.handleUpdate({ id: 'update-rule', pathPrefix: '/new' })

      expect(mockRouteRuleRepo.update).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('规则不存在应抛出 Error', () => {
      mockRouteRuleRepo.findOneById.mockReturnValue(null)

      expect(() => service.handleUpdate({ id: 'nonexistent' })).toThrow('不存在')
    })

    it('targetEnvId 为空字符串时应清空', () => {
      const existing = createRouteRuleFixture({
        id: 'update-rule',
        targetEnvId: 'old-target',
      })
      mockRouteRuleRepo.findOneById.mockReturnValue(existing)
      mockRouteRuleRepo.findOneById.mockReturnValue({ ...existing, targetEnvId: '' })

      service.handleUpdate({ id: 'update-rule', targetEnvId: '' })

      const updateCall = mockRouteRuleRepo.update.mock.calls[0][0]
      expect(updateCall.targetEnvId).toBe('')
    })

    it('更新路径前缀冲突应抛出 Error', () => {
      const existing = createRouteRuleFixture({
        id: 'update-rule',
        envId: 'env-a',
        pathPrefix: '/old',
      })
      mockRouteRuleRepo.findOneById.mockReturnValue(existing)
      mockRouteRuleRepo.existsByEnvIdAndPathPrefix.mockReturnValue(true)

      expect(() =>
        service.handleUpdate({ id: 'update-rule', pathPrefix: '/conflict' })
      ).toThrow('已存在路径前缀')
    })

    it('应自动设置 updatedAt', () => {
      const existing = createRouteRuleFixture({ id: 'update-rule' })
      mockRouteRuleRepo.findOneById.mockReturnValue(existing)
      mockRouteRuleRepo.findOneById.mockReturnValue({ ...existing })

      service.handleUpdate({ id: 'update-rule' })

      const updateCall = mockRouteRuleRepo.update.mock.calls[0][0]
      expect(updateCall.updatedAt).toBeDefined()
    })
  })

  describe('handleDelete', () => {
    it('应成功删除已存在的规则', () => {
      mockRouteRuleRepo.findOneById.mockReturnValue(createRouteRuleFixture({ id: 'del-rule' }))

      service.handleDelete({ id: 'del-rule' })

      expect(mockRouteRuleRepo.delete).toHaveBeenCalledWith({ id: 'del-rule' })
    })

    it('规则不存在应抛出 Error', () => {
      mockRouteRuleRepo.findOneById.mockReturnValue(null)

      expect(() => service.handleDelete({ id: 'nonexistent' })).toThrow('不存在')
    })
  })
})
