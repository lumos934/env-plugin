import { describe, it, expect, beforeEach, vi } from 'vitest'
import { v4 as uuidv4 } from 'uuid'
import { createMemoryDb, setCurrentDb, getCurrentDb } from '../../helpers/db.js'
import { createEnvFixture, createEnvCreateFixture } from '../../helpers/fixtures.js'
import { EnvRepo } from '../../../src/repositories/EnvRepo.js'

// Mock getDatabase() 全局单例，指向内存数据库
vi.mock('../../../src/repositories/database.js', () => ({
  getDatabase: () => getCurrentDb(),
  startDatabase: () => Promise.resolve(getCurrentDb()),
}))

describe('EnvRepo', () => {
  let repo: EnvRepo

  beforeEach(() => {
    setCurrentDb(createMemoryDb())
    repo = new EnvRepo()
  })

  describe('getAll', () => {
    it('空集合应返回空数组', () => {
      expect(repo.getAll()).toEqual([])
    })

    it('应按 sortOrder 升序返回所有环境', () => {
      const env1 = createEnvFixture({ id: 'a', sortOrder: 3, name: 'Third' })
      const env2 = createEnvFixture({ id: 'b', sortOrder: 1, name: 'First' })
      const env3 = createEnvFixture({ id: 'c', sortOrder: 2, name: 'Second' })
      repo.addEnv(env1)
      repo.addEnv(env2)
      repo.addEnv(env3)

      const result = repo.getAll()
      expect(result.map((e) => e.name)).toEqual(['First', 'Second', 'Third'])
    })

    it('无 sortOrder 的环境应视为 0', () => {
      const env1 = createEnvFixture({ id: 'a', sortOrder: undefined, name: 'NoSort' })
      const env2 = createEnvFixture({ id: 'b', sortOrder: 1, name: 'Sorted' })
      // 清除 sortOrder 以便测试 undefined 行为
      delete (env1 as Record<string, unknown>).sortOrder
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo.addEnv(env1 as any)
      repo.addEnv(env2)

      const result = repo.getAll()
      // sortOrder undefined 视为 0，排在 1 前面
      expect(result[0].name).toBe('NoSort')
    })
  })

  describe('addEnv', () => {
    it('应成功添加环境', () => {
      const env = createEnvFixture()
      repo.addEnv(env)
      expect(repo.findOneById(env.id)).toEqual(env)
    })

    it('添加重复 apiBaseUrl 应被 LokiJS unique 索引阻止', () => {
      const env1 = createEnvFixture({ apiBaseUrl: 'http://same.example.com' })
      const env2 = createEnvFixture({ apiBaseUrl: 'http://same.example.com' })
      repo.addEnv(env1)
      // LokiJS unique 索引会在 insert 时抛错
      expect(() => repo.addEnv(env2)).toThrow()
    })
  })

  describe('deleteEnv', () => {
    it('应成功删除已存在的环境', () => {
      const env = createEnvFixture()
      repo.addEnv(env)
      repo.deleteEnv({ id: env.id })
      expect(repo.findOneById(env.id)).toBeNull()
    })

    it('Zod 校验失败应抛出 AppError（缺少 id）', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => repo.deleteEnv({} as any)).toThrow('删除环境验证失败')
    })

    it('删除不存在的环境不应抛出异常', () => {
      // LokiJS findAndRemove 对空结果不抛错
      expect(() => repo.deleteEnv({ id: 'nonexistent' })).not.toThrow()
    })
  })

  describe('findOne', () => {
    it('应通过条件查询环境', () => {
      const env = createEnvFixture({ name: 'UniqueName' })
      repo.addEnv(env)

      expect(repo.findOne({ name: 'UniqueName' })).toEqual(env)
    })

    it('查询不存在记录应返回 null', () => {
      expect(repo.findOne({ name: 'Nobody' })).toBeNull()
    })
  })

  describe('findOneById', () => {
    it('应通过 id 查询环境', () => {
      const env = createEnvFixture({ id: 'my-env-id' })
      repo.addEnv(env)
      expect(repo.findOneById('my-env-id')).toEqual(env)
    })

    it('不存在的 id 应返回 null', () => {
      expect(repo.findOneById('nonexistent')).toBeNull()
    })
  })

  describe('findEnvsByDevServerId', () => {
    it('应返回关联指定 devServer 的环境数组', () => {
      const dsId = uuidv4()
      const env1 = createEnvFixture({ devServerId: dsId })
      const env2 = createEnvFixture({ devServerId: dsId })
      const env3 = createEnvFixture({ devServerId: uuidv4() })
      repo.addEnv(env1)
      repo.addEnv(env2)
      repo.addEnv(env3)

      const result = repo.findEnvsByDevServerId(dsId)
      expect(result).toHaveLength(2)
    })

    it('无关联环境应返回空数组', () => {
      expect(repo.findEnvsByDevServerId('nonexistent')).toEqual([])
    })
  })

  describe('findAllByStatus', () => {
    it('应返回指定状态的环境', () => {
      const running = createEnvFixture({ status: 'running' })
      const stopped = createEnvFixture({ status: 'stopped' })
      repo.addEnv(running)
      repo.addEnv(stopped)

      expect(repo.findAllByStatus('running')).toHaveLength(1)
      expect(repo.findAllByStatus('stopped')).toHaveLength(1)
    })
  })

  describe('findOneByApiBaseUrl', () => {
    it('应通过 apiBaseUrl 查找环境', () => {
      const create = createEnvCreateFixture({ apiBaseUrl: 'http://api.test.com' })
      const env = createEnvFixture({ apiBaseUrl: 'http://api.test.com' })
      repo.addEnv(env)

      const result = repo.findOneByApiBaseUrl(create)
      expect(result).toBeTruthy()
      expect(result!.apiBaseUrl).toBe('http://api.test.com')
    })

    it('不存在应返回 null', () => {
      const create = createEnvCreateFixture({ apiBaseUrl: 'http://nonexistent.com' })
      expect(repo.findOneByApiBaseUrl(create)).toBeNull()
    })
  })

  describe('findOneByPortAndStatus', () => {
    it('应通过端口和状态联合查询', () => {
      const env = createEnvFixture({ port: 9999, status: 'running' })
      repo.addEnv(env)

      const result = repo.findOneByPortAndStatus({ port: 9999, status: 'running' })
      expect(result).toBeTruthy()
      expect(result!.port).toBe(9999)
    })

    it('不匹配组合应返回 null', () => {
      expect(repo.findOneByPortAndStatus({ port: 9999, status: 'stopped' })).toBeNull()
    })
  })

  describe('update', () => {
    it('应成功更新已有环境', () => {
      const env = createEnvFixture({ id: 'update-test', name: 'Old' })
      repo.addEnv(env)

      repo.update({ id: 'update-test', name: 'New' })
      const updated = repo.findOneById('update-test')
      expect(updated!.name).toBe('New')
    })

    it('更新不存在的环境应抛出 AppError', () => {
      expect(() => repo.update({ id: 'nonexistent', name: 'New' })).toThrow('未找到对应的环境')
    })
  })
})
