import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMemoryDb, setCurrentDb, getCurrentDb } from '../helpers/db.js'
import { createDevServerFixture } from '../helpers/fixtures.js'
import { DevServerRepo } from '../../src/repositories/DevServerRepo.js'

vi.mock('../../src/repositories/database.js', () => ({
  getDatabase: () => getCurrentDb(),
  startDatabase: () => Promise.resolve(getCurrentDb()),
}))

describe('DevServerRepo', () => {
  let repo: DevServerRepo

  beforeEach(() => {
    setCurrentDb(createMemoryDb())
    repo = new DevServerRepo()
  })

  describe('getAll', () => {
    it('空集合应返回空数组', () => {
      expect(repo.getAll()).toEqual([])
    })

    it('应返回所有开发服务器', () => {
      const ds1 = createDevServerFixture({ name: 'DS1' })
      const ds2 = createDevServerFixture({ name: 'DS2' })
      repo.addDevServer(ds1)
      repo.addDevServer(ds2)

      expect(repo.getAll()).toHaveLength(2)
    })
  })

  describe('addDevServer', () => {
    it('应成功添加（Zod 校验通过）', () => {
      const ds = createDevServerFixture()
      repo.addDevServer(ds)
      expect(repo.findOneByUrl(ds.devServerUrl)).toBeTruthy()
    })

    it('重复 devServerUrl 应被 LokiJS unique 索引阻止', () => {
      const ds1 = createDevServerFixture({ devServerUrl: 'http://dup.example.com' })
      const ds2 = createDevServerFixture({ devServerUrl: 'http://dup.example.com' })
      repo.addDevServer(ds1)
      expect(() => repo.addDevServer(ds2)).toThrow()
    })
  })

  describe('deleteDevServer', () => {
    it('应成功删除存在的服务器', () => {
      const ds = createDevServerFixture()
      repo.addDevServer(ds)
      repo.deleteDevServer({ id: ds.id })
      expect(repo.findOneById({ id: ds.id })).toBeNull()
    })

    it('Zod 校验失败应抛出 AppError', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => repo.deleteDevServer({} as any)).toThrow('参数验证错误')
    })

    it('删除不存在的服务器应抛出 AppError', () => {
      expect(() => repo.deleteDevServer({ id: 'nonexistent' })).toThrow('不存在')
    })
  })

  describe('findOneById', () => {
    it('应通过 id 查询', () => {
      const ds = createDevServerFixture({ id: 'test-ds-id' })
      repo.addDevServer(ds)
      expect(repo.findOneById({ id: 'test-ds-id' })).toMatchObject(ds)
    })

    it('不存在的 id 应返回 null', () => {
      expect(repo.findOneById({ id: 'nonexistent' })).toBeNull()
    })

    it('Zod 校验失败应抛出 AppError', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => repo.findOneById({} as any)).toThrow('参数验证错误')
    })
  })

  describe('findOneByUrl', () => {
    it('应通过 URL 查询', () => {
      const ds = createDevServerFixture({ devServerUrl: 'http://special.example.com' })
      repo.addDevServer(ds)
      expect(repo.findOneByUrl('http://special.example.com')).toMatchObject(ds)
    })

    it('不存在的 URL 应返回 null', () => {
      expect(repo.findOneByUrl('http://nonexistent.example.com')).toBeNull()
    })
  })

  describe('update', () => {
    it('应成功更新已有服务器', () => {
      const ds = createDevServerFixture({ id: 'update-ds', name: 'Old' })
      repo.addDevServer(ds)

      repo.update({ id: 'update-ds', name: 'New' })
      const updated = repo.findOneById({ id: 'update-ds' })
      expect(updated!.name).toBe('New')
    })

    it('更新不存在的应抛出 AppError', () => {
      expect(() => repo.update({ id: 'nonexistent', name: 'New' })).toThrow('不存在')
    })

    it('Zod 校验失败应抛出 AppError', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => repo.update({} as any)).toThrow('参数验证错误')
    })

    it('更新 devServerUrl 为已存在的值应被 LokiJS 阻止', () => {
      const ds1 = createDevServerFixture({ id: 'ds1', devServerUrl: 'http://url1.example.com' })
      const ds2 = createDevServerFixture({ id: 'ds2', devServerUrl: 'http://url2.example.com' })
      repo.addDevServer(ds1)
      repo.addDevServer(ds2)

      // 尝试将 ds2 的 URL 改为 ds1 的 URL
      expect(() => repo.update({ id: 'ds2', devServerUrl: 'http://url1.example.com' })).toThrow()
    })
  })

  describe('updateSortOrder', () => {
    it('应成功更新排序字段', () => {
      const ds = createDevServerFixture({ id: 'sort-ds', sortOrder: 0 })
      repo.addDevServer(ds)

      repo.updateSortOrder('sort-ds', 5)
      const updated = repo.findOneById({ id: 'sort-ds' })
      expect(updated!.sortOrder).toBe(5)
    })

    it('更新不存在的记录不抛错（静默忽略）', () => {
      expect(() => repo.updateSortOrder('nonexistent', 5)).not.toThrow()
    })
  })
})
