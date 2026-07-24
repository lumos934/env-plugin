import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMemoryDb, setCurrentDb, getCurrentDb } from '../../helpers/db.js'
import { createRouteRuleFixture } from '../../helpers/fixtures.js'
import { RouteRuleRepo } from '../../../src/repositories/RouteRuleRepo.js'

vi.mock('../../../src/repositories/database.js', () => ({
  getDatabase: () => getCurrentDb(),
  startDatabase: () => Promise.resolve(getCurrentDb()),
}))

describe('RouteRuleRepo', () => {
  let repo: RouteRuleRepo

  beforeEach(() => {
    setCurrentDb(createMemoryDb())
    repo = new RouteRuleRepo()
  })

  describe('initCollection', () => {
    it('应不抛错正常执行', () => {
      expect(() => repo.initCollection()).not.toThrow()
    })
  })

  describe('getByEnvId', () => {
    it('应返回指定环境的路由规则', () => {
      const envId = 'env-001'
      const rule1 = createRouteRuleFixture({ envId, pathPrefix: '/api/one' })
      const rule2 = createRouteRuleFixture({ envId, pathPrefix: '/api/two' })
      const rule3 = createRouteRuleFixture({ envId: 'env-002', pathPrefix: '/api/other' })
      repo.create(rule1)
      repo.create(rule2)
      repo.create(rule3)

      const result = repo.getByEnvId(envId)
      expect(result).toHaveLength(2)
      expect(result.map((r) => r.pathPrefix)).toContain('/api/one')
    })

    it('无匹配规则应返回空数组', () => {
      expect(repo.getByEnvId('empty-env')).toEqual([])
    })
  })

  describe('countByEnvId', () => {
    it('应返回正确数量', () => {
      const envId = 'count-env'
      repo.create(createRouteRuleFixture({ envId }))
      repo.create(createRouteRuleFixture({ envId }))

      expect(repo.countByEnvId(envId)).toBe(2)
    })

    it('无记录时应返回 0', () => {
      expect(repo.countByEnvId('empty')).toBe(0)
    })
  })

  describe('findOneById', () => {
    it('应通过 id 查询', () => {
      const rule = createRouteRuleFixture({ id: 'rule-id' })
      repo.create(rule)
      expect(repo.findOneById('rule-id')).toEqual(rule)
    })

    it('不存在的 id 应返回 null', () => {
      expect(repo.findOneById('nonexistent')).toBeNull()
    })
  })

  describe('create', () => {
    it('应成功添加路由规则', () => {
      const rule = createRouteRuleFixture()
      repo.create(rule)
      expect(repo.findOneById(rule.id)).toEqual(rule)
    })
  })

  describe('delete', () => {
    it('应成功删除已存在的规则', () => {
      const rule = createRouteRuleFixture()
      repo.create(rule)
      repo.delete({ id: rule.id })
      expect(repo.findOneById(rule.id)).toBeNull()
    })

    it('Zod 校验失败应抛出 Error', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => repo.delete({} as any)).toThrow('删除路由规则验证失败')
    })

    it('删除不存在的规则不抛错', () => {
      expect(() => repo.delete({ id: 'nonexistent' })).not.toThrow()
    })
  })

  describe('deleteByEnvId', () => {
    it('应删除指定环境所有规则', () => {
      const envId = 'delete-env'
      repo.create(createRouteRuleFixture({ envId }))
      repo.create(createRouteRuleFixture({ envId }))

      repo.deleteByEnvId(envId)
      expect(repo.countByEnvId(envId)).toBe(0)
    })

    it('不影响其他环境的规则', () => {
      const envA = 'env-a'
      const envB = 'env-b'
      repo.create(createRouteRuleFixture({ envId: envA }))
      repo.create(createRouteRuleFixture({ envId: envB }))

      repo.deleteByEnvId(envA)
      expect(repo.countByEnvId(envA)).toBe(0)
      expect(repo.countByEnvId(envB)).toBe(1)
    })
  })

  describe('update', () => {
    it('应成功更新已有规则', () => {
      const rule = createRouteRuleFixture({ id: 'update-rule', pathPrefix: '/old' })
      repo.create(rule)

      repo.update({ id: 'update-rule', pathPrefix: '/new' })
      const updated = repo.findOneById('update-rule')
      expect(updated!.pathPrefix).toBe('/new')
    })

    it('更新不存在的规则应抛出 Error', () => {
      expect(() => repo.update({ id: 'nonexistent', pathPrefix: '/new' })).toThrow(
        '未找到对应的路由规则'
      )
    })
  })

  describe('existsByEnvIdAndPathPrefix', () => {
    it('重复组合应返回 true', () => {
      const envId = 'dup-env'
      repo.create(createRouteRuleFixture({ envId, pathPrefix: '/api/users' }))

      expect(repo.existsByEnvIdAndPathPrefix(envId, '/api/users')).toBe(true)
    })

    it('不存在组合应返回 false', () => {
      expect(repo.existsByEnvIdAndPathPrefix('env', '/nonexistent')).toBe(false)
    })

    it('不同环境同路径前缀不算重复', () => {
      repo.create(createRouteRuleFixture({ envId: 'env-a', pathPrefix: '/api/test' }))

      expect(repo.existsByEnvIdAndPathPrefix('env-b', '/api/test')).toBe(false)
    })
  })
})
