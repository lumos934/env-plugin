import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMemoryDb, setCurrentDb, getCurrentDb } from '../../helpers/db.js'
import { SystemSettingRepo } from '../../../src/repositories/SystemSettingRepo.js'

vi.mock('../../../src/repositories/database.js', () => ({
  getDatabase: () => getCurrentDb(),
  startDatabase: () => Promise.resolve(getCurrentDb()),
}))

describe('SystemSettingRepo', () => {
  let repo: SystemSettingRepo

  beforeEach(() => {
    setCurrentDb(createMemoryDb())
    repo = new SystemSettingRepo()
  })

  describe('getGlobal', () => {
    it('空库应返回 null', () => {
      expect(repo.getGlobal()).toBeNull()
    })

    it('upsert 后应返回该记录', () => {
      repo.upsert({ id: 'global', injectEnabled: false, logEnabled: false })
      expect(repo.getGlobal()).toMatchObject({
        id: 'global',
        injectEnabled: false,
        logEnabled: false,
      })
    })
  })

  describe('upsert', () => {
    it('不存在时应插入新记录', () => {
      repo.upsert({ id: 'global', injectEnabled: true, logEnabled: true })
      expect(repo.getGlobal()).toMatchObject({
        id: 'global',
        injectEnabled: true,
        logEnabled: true,
      })
    })

    it('已存在时应更新原记录（不产生重复）', () => {
      repo.upsert({ id: 'global', injectEnabled: true, logEnabled: true })
      repo.upsert({ id: 'global', injectEnabled: false, logEnabled: false })

      expect(repo.getGlobal()).toMatchObject({
        id: 'global',
        injectEnabled: false,
        logEnabled: false,
      })
      // 集合中应只有一条记录
      const collection = getCurrentDb().getCollection('settings')
      expect(collection.find({ id: 'global' })).toHaveLength(1)
    })
  })
})
