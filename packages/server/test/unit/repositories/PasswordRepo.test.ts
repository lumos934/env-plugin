import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMemoryDb, setCurrentDb, getCurrentDb } from '../../helpers/db.js'
import { createPasswordFixture } from '../../helpers/fixtures.js'
import { PasswordRepo } from '../../../src/repositories/PasswordRepo.js'

vi.mock('../../../src/repositories/database.js', () => ({
  getDatabase: () => getCurrentDb(),
  startDatabase: () => Promise.resolve(getCurrentDb()),
}))

describe('PasswordRepo', () => {
  let repo: PasswordRepo

  beforeEach(() => {
    setCurrentDb(createMemoryDb())
    repo = new PasswordRepo()
  })

  describe('initCollection', () => {
    it('应不抛错正常执行', () => {
      expect(() => repo.initCollection()).not.toThrow()
    })
  })

  describe('getByEnvId', () => {
    it('应返回指定环境的密码', () => {
      const envId = 'pwd-env'
      const p1 = createPasswordFixture({ envId, name: 'DB' })
      const p2 = createPasswordFixture({ envId, name: 'API' })
      const p3 = createPasswordFixture({ envId: 'other-env', name: 'Other' })
      repo.create(p1)
      repo.create(p2)
      repo.create(p3)

      const result = repo.getByEnvId(envId)
      expect(result).toHaveLength(2)
    })

    it('无匹配应返回空数组', () => {
      expect(repo.getByEnvId('empty')).toEqual([])
    })
  })

  describe('countByEnvId', () => {
    it('应返回正确数量', () => {
      const envId = 'count-pwd'
      repo.create(createPasswordFixture({ envId }))
      repo.create(createPasswordFixture({ envId }))

      expect(repo.countByEnvId(envId)).toBe(2)
    })

    it('无记录时应返回 0', () => {
      expect(repo.countByEnvId('empty')).toBe(0)
    })
  })

  describe('findOneById', () => {
    it('应通过 id 查询', () => {
      const pwd = createPasswordFixture({ id: 'pwd-id' })
      repo.create(pwd)
      expect(repo.findOneById('pwd-id')).toEqual(pwd)
    })

    it('不存在的 id 应返回 null', () => {
      expect(repo.findOneById('nonexistent')).toBeNull()
    })
  })

  describe('create', () => {
    it('应成功添加密码', () => {
      const pwd = createPasswordFixture()
      repo.create(pwd)
      expect(repo.findOneById(pwd.id)).toEqual(pwd)
    })
  })

  describe('delete', () => {
    it('应成功删除已存在的密码', () => {
      const pwd = createPasswordFixture()
      repo.create(pwd)
      repo.delete({ id: pwd.id })
      expect(repo.findOneById(pwd.id)).toBeNull()
    })

    it('Zod 校验失败应抛出 Error', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => repo.delete({} as any)).toThrow('删除密码验证失败')
    })

    it('删除不存在的密码不抛错', () => {
      expect(() => repo.delete({ id: 'nonexistent' })).not.toThrow()
    })
  })

  describe('deleteByEnvId', () => {
    it('应删除指定环境所有密码', () => {
      const envId = 'del-pwd-env'
      repo.create(createPasswordFixture({ envId }))
      repo.create(createPasswordFixture({ envId }))
      repo.create(createPasswordFixture({ envId: 'other' }))

      repo.deleteByEnvId(envId)
      expect(repo.countByEnvId(envId)).toBe(0)
      expect(repo.countByEnvId('other')).toBe(1)
    })
  })

  describe('update', () => {
    it('应成功更新已有密码', () => {
      const pwd = createPasswordFixture({ id: 'update-pwd', username: 'olduser' })
      repo.create(pwd)

      repo.update({ id: 'update-pwd', username: 'newuser' })
      const updated = repo.findOneById('update-pwd')
      expect(updated!.username).toBe('newuser')
    })

    it('更新不存在的密码应抛出 Error', () => {
      expect(() => repo.update({ id: 'nonexistent', username: 'new' })).toThrow(
        '未找到对应的密码'
      )
    })
  })

  describe('existsByEnvIdAndName', () => {
    it('重复名称应返回 true', () => {
      const envId = 'name-check-env'
      repo.create(createPasswordFixture({ envId, name: 'Database' }))

      expect(repo.existsByEnvIdAndName(envId, 'Database')).toBe(true)
    })

    it('不存在名称应返回 false', () => {
      expect(repo.existsByEnvIdAndName('env', 'Missing')).toBe(false)
    })

    it('不同环境同名不算重复', () => {
      repo.create(createPasswordFixture({ envId: 'env-a', name: 'Same' }))

      expect(repo.existsByEnvIdAndName('env-b', 'Same')).toBe(false)
    })
  })

  describe('findDefaultByEnvId', () => {
    it('应返回默认密码', () => {
      const envId = 'default-check'
      const nonDefault = createPasswordFixture({ envId, isDefault: false })
      const defaultPwd = createPasswordFixture({ envId, isDefault: true, name: 'Default' })
      repo.create(nonDefault)
      repo.create(defaultPwd)

      const result = repo.findDefaultByEnvId(envId)
      expect(result).toBeTruthy()
      expect(result!.name).toBe('Default')
    })

    it('无默认密码应返回 null', () => {
      const pwd = createPasswordFixture({ envId: 'no-default', isDefault: false })
      repo.create(pwd)

      expect(repo.findDefaultByEnvId('no-default')).toBeNull()
    })
  })

  describe('clearDefaultByEnvId', () => {
    it('应将默认密码的 isDefault 设为 false', () => {
      const envId = 'clear-env'
      const defaultPwd = createPasswordFixture({ envId, isDefault: true })
      repo.create(defaultPwd)

      repo.clearDefaultByEnvId(envId)
      const updated = repo.findOneById(defaultPwd.id)
      expect(updated!.isDefault).toBe(false)
    })

    it('应排除指定 ID 的密码（excludeId）', () => {
      const envId = 'exclude-env'
      const keepDefault = createPasswordFixture({ id: 'keep', envId, isDefault: true })
      const clearDefault = createPasswordFixture({ id: 'clear', envId, isDefault: true })
      repo.create(keepDefault)
      repo.create(clearDefault)

      repo.clearDefaultByEnvId(envId, 'keep')
      expect(repo.findOneById('keep')!.isDefault).toBe(true)
      expect(repo.findOneById('clear')!.isDefault).toBe(false)
    })

    it('无默认密码时不抛错', () => {
      expect(() => repo.clearDefaultByEnvId('no-defaults')).not.toThrow()
    })
  })

  describe('hasDefaultPassword', () => {
    it('存在默认密码应返回 true', () => {
      const envId = 'has-default'
      repo.create(createPasswordFixture({ envId, isDefault: true }))

      expect(repo.hasDefaultPassword(envId)).toBe(true)
    })

    it('不存在默认密码应返回 false', () => {
      const envId = 'no-default'
      repo.create(createPasswordFixture({ envId, isDefault: false }))
      expect(repo.hasDefaultPassword(envId)).toBe(false)
    })

    it('排除指定 ID（excludeId）', () => {
      const envId = 'has-default-excl'
      repo.create(createPasswordFixture({ id: 'only', envId, isDefault: true }))

      // 排除唯一默认密码 ID
      expect(repo.hasDefaultPassword(envId, 'only')).toBe(false)
    })
  })
})
