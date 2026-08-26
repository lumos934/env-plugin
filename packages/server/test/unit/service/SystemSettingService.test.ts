import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMemoryDb, setCurrentDb, getCurrentDb } from '../../helpers/db.js'
import {
  SystemSettingService,
  getInjectEnabled,
} from '../../../src/service/SystemSettingService.js'
import { SystemSettingRepo } from '../../../src/repositories/SystemSettingRepo.js'

vi.mock('../../../src/repositories/database.js', () => ({
  getDatabase: () => getCurrentDb(),
  startDatabase: () => Promise.resolve(getCurrentDb()),
}))

describe('SystemSettingService', () => {
  let service: SystemSettingService
  let repo: SystemSettingRepo

  beforeEach(() => {
    setCurrentDb(createMemoryDb())
    repo = new SystemSettingRepo()
    service = new SystemSettingService(repo)
    // 复位模块级单例缓存为 true（空库 seed），确保用例间隔离
    service.init()
  })

  describe('init', () => {
    it('空库应 seed 默认开启记录，缓存为 true', () => {
      expect(getInjectEnabled()).toBe(true)
      expect(repo.getGlobal()).toMatchObject({ id: 'global', injectEnabled: true })
    })

    it('已有持久化记录时应同步到缓存', () => {
      // 先持久化 false
      service.setInjectEnabled(false)

      // 新实例 init 应读回 false
      const service2 = new SystemSettingService(new SystemSettingRepo())
      service2.init()
      expect(getInjectEnabled()).toBe(false)
    })
  })

  describe('getInjectEnabled', () => {
    it('应返回模块级缓存值', () => {
      expect(service.getInjectEnabled()).toBe(true)
      service.setInjectEnabled(false)
      expect(service.getInjectEnabled()).toBe(false)
    })
  })

  describe('setInjectEnabled', () => {
    it('应更新缓存并持久化', () => {
      service.setInjectEnabled(false)

      expect(getInjectEnabled()).toBe(false)
      expect(repo.getGlobal()?.injectEnabled).toBe(false)
    })
  })
})
