import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMemoryDb, setCurrentDb, getCurrentDb } from '../../helpers/db.js'
import {
  SystemSettingService,
  getInjectEnabled,
  getLogEnabled,
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
    // 复位模块级单例缓存（空库 seed 默认值），确保用例间隔离
    service.init()
  })

  describe('init', () => {
    it('空库应 seed 默认关闭记录（注入 false、日志 false）', () => {
      expect(getInjectEnabled()).toBe(false)
      expect(getLogEnabled()).toBe(false)
      expect(repo.getGlobal()).toMatchObject({
        id: 'global',
        injectEnabled: false,
        logEnabled: false,
      })
    })

    it('已有持久化记录时应同步到缓存', () => {
      service.setInjectEnabled(true)
      service.setLogEnabled(true)

      const service2 = new SystemSettingService(new SystemSettingRepo())
      service2.init()
      expect(getInjectEnabled()).toBe(true)
      expect(getLogEnabled()).toBe(true)
    })
  })

  describe('getInjectEnabled / getLogEnabled', () => {
    it('默认应返回 false', () => {
      expect(service.getInjectEnabled()).toBe(false)
      expect(service.getLogEnabled()).toBe(false)
    })
  })

  describe('setInjectEnabled', () => {
    it('应更新缓存并持久化，且不影响 logEnabled', () => {
      service.setInjectEnabled(true)

      expect(getInjectEnabled()).toBe(true)
      expect(getLogEnabled()).toBe(false)
      expect(repo.getGlobal()?.injectEnabled).toBe(true)
      expect(repo.getGlobal()?.logEnabled).toBe(false)
    })
  })

  describe('setLogEnabled', () => {
    it('应更新缓存并持久化，且不影响 injectEnabled', () => {
      service.setLogEnabled(true)

      expect(getLogEnabled()).toBe(true)
      expect(getInjectEnabled()).toBe(false)
      expect(repo.getGlobal()?.logEnabled).toBe(true)
      expect(repo.getGlobal()?.injectEnabled).toBe(false)
    })
  })
})
