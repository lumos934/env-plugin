import { describe, it, expect, beforeEach } from 'vitest'
import { DevServerService } from '../../../src/service/DevServerService.js'
import {
  createMockDevServerRepo,
  createMockEnvRepo,
} from '../../helpers/mockRepos.js'
import {
  createDevServerFixture,
  createDevServerCreateFixture,
} from '../../helpers/fixtures.js'

describe('DevServerService', () => {
  let service: DevServerService
  let mockDevServerRepo: ReturnType<typeof createMockDevServerRepo>
  let mockEnvRepo: ReturnType<typeof createMockEnvRepo>

  beforeEach(() => {
    mockDevServerRepo = createMockDevServerRepo()
    mockEnvRepo = createMockEnvRepo()
    service = new DevServerService(mockDevServerRepo, mockEnvRepo)
  })

  describe('handleAddDevServer', () => {
    it('应成功添加开发服务器', () => {
      const create = createDevServerCreateFixture({
        devServerUrl: 'http://new.example.com',
        name: 'New DS',
      })
      mockDevServerRepo.findOneByUrl.mockReturnValue(null)

      service.handleAddDevServer(create)

      expect(mockDevServerRepo.addDevServer).toHaveBeenCalledTimes(1)
      const added = mockDevServerRepo.addDevServer.mock.calls[0][0]
      expect(added.name).toBe('New DS')
      expect(added.id).toBeDefined()
      expect(added.sortOrder).toBe(0)
    })

    it('URL 重复应抛出 AppError', () => {
      const create = createDevServerCreateFixture({ devServerUrl: 'http://dup.example.com' })
      const existing = createDevServerFixture({ devServerUrl: 'http://dup.example.com' })
      mockDevServerRepo.findOneByUrl.mockReturnValue(existing)

      expect(() => service.handleAddDevServer(create)).toThrow('已存在')
    })
  })

  describe('handleDeleteDevServer', () => {
    it('应成功删除未关联的开发服务器', () => {
      const ds = createDevServerFixture({ id: 'delete-ds' })
      mockDevServerRepo.findOneById.mockReturnValue(ds)
      mockEnvRepo.findEnvsByDevServerId.mockReturnValue([])

      service.handleDeleteDevServer({ id: 'delete-ds' })

      expect(mockDevServerRepo.deleteDevServer).toHaveBeenCalledWith({ id: 'delete-ds' })
    })

    it('不存在应抛出 AppError', () => {
      mockDevServerRepo.findOneById.mockReturnValue(null)

      expect(() => service.handleDeleteDevServer({ id: 'nonexistent' })).toThrow('不存在')
    })

    it('已关联环境的禁止删除', () => {
      const ds = createDevServerFixture({ id: 'linked-ds' })
      mockDevServerRepo.findOneById.mockReturnValue(ds)
      mockEnvRepo.findEnvsByDevServerId.mockReturnValue([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'env-1' } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'env-2' } as any,
      ])

      expect(() => service.handleDeleteDevServer({ id: 'linked-ds' })).toThrow('已关联')
    })
  })

  describe('handleUpdateDevServer', () => {
    it('应成功更新', () => {
      const existing = createDevServerFixture({ id: 'update-ds', name: 'Old' })
      mockDevServerRepo.findOneById.mockReturnValue(existing)

      service.handleUpdateDevServer({ id: 'update-ds', name: 'New' })

      expect(mockDevServerRepo.update).toHaveBeenCalled()
    })

    it('不存在应抛出 AppError', () => {
      mockDevServerRepo.findOneById.mockReturnValue(null)

      expect(() => service.handleUpdateDevServer({ id: 'nonexistent', name: 'New' })).toThrow(
        '不存在'
      )
    })

    it('更新 URL 重复应抛出 AppError', () => {
      const existing = createDevServerFixture({
        id: 'update-ds',
        devServerUrl: 'http://old.example.com',
      })
      const conflict = createDevServerFixture({ devServerUrl: 'http://conflict.example.com' })
      mockDevServerRepo.findOneById.mockReturnValue(existing)
      mockDevServerRepo.findOneByUrl.mockReturnValue(conflict)

      expect(() =>
        service.handleUpdateDevServer({
          id: 'update-ds',
          devServerUrl: 'http://conflict.example.com',
        })
      ).toThrow('已被其他开发服务器使用')
    })

    it('URL 不变时不检查重复', () => {
      const existing = createDevServerFixture({
        id: 'update-ds',
        devServerUrl: 'http://same.example.com',
      })
      mockDevServerRepo.findOneById.mockReturnValue(existing)

      service.handleUpdateDevServer({
        id: 'update-ds',
        devServerUrl: 'http://same.example.com',
        name: 'Updated',
      })

      // findOneByUrl 不应被调用（URL 未变）
      expect(mockDevServerRepo.findOneByUrl).not.toHaveBeenCalled()
    })
  })

  describe('handleGetList', () => {
    it('应按 sortOrder 排序返回', () => {
      const ds1 = createDevServerFixture({ id: 'a', sortOrder: 3 })
      const ds2 = createDevServerFixture({ id: 'b', sortOrder: 1 })
      const ds3 = createDevServerFixture({ id: 'c', sortOrder: 2 })
      mockDevServerRepo.getAll.mockReturnValue([ds1, ds2, ds3])

      const result = service.handleGetList()
      expect(result.map((d) => d.sortOrder)).toEqual([1, 2, 3])
    })
  })

  describe('findOneById', () => {
    it('应通过 id 查询', () => {
      const ds = createDevServerFixture({ id: 'find-me' })
      mockDevServerRepo.findOneById.mockReturnValue(ds)

      const result = service.findOneById({ id: 'find-me' })
      expect(result).toEqual(ds)
    })

    it('Zod 校验失败应抛出 AppError', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => service.findOneById({} as any)).toThrow('参数不合法')
    })
  })

  describe('handleLinkToEnv', () => {
    it('空参数应抛出 AppError', () => {
      expect(() => service.handleLinkToEnv('', '')).toThrow('不能为空')
    })

    it('DevServer 不存在应抛出 AppError', () => {
      mockDevServerRepo.findOneById.mockReturnValue(null)

      expect(() => service.handleLinkToEnv('ds-id', 'env-id')).toThrow('不存在')
    })

    it('Env 不存在应抛出 AppError', () => {
      mockDevServerRepo.findOneById.mockReturnValue(createDevServerFixture({ id: 'ds-id' }))
      mockEnvRepo.findOneById.mockReturnValue(null)

      expect(() => service.handleLinkToEnv('ds-id', 'env-id')).toThrow('不存在')
    })
  })

  describe('handleUnlinkFromEnv', () => {
    it('空 id 应抛出 AppError', () => {
      expect(() => service.handleUnlinkFromEnv('')).toThrow('不能为空')
    })

    it('DevServer 不存在应抛出 AppError', () => {
      mockDevServerRepo.findOneById.mockReturnValue(null)

      expect(() => service.handleUnlinkFromEnv('nonexistent')).toThrow('不存在')
    })
  })

  describe('handleUpdateSortOrder', () => {
    it('应成功批量更新', () => {
      mockDevServerRepo.findOneById.mockReturnValue({ id: 'a', sortOrder: 0 })

      service.handleUpdateSortOrder({
        orders: [
          { id: 'a', sortOrder: 1 },
          { id: 'b', sortOrder: 2 },
        ],
      })

      expect(mockDevServerRepo.updateSortOrder).toHaveBeenCalledWith('a', 1)
      expect(mockDevServerRepo.updateSortOrder).toHaveBeenCalledWith('b', 2)
    })

    it('DevServer 不存在应抛出 AppError', () => {
      mockDevServerRepo.findOneById.mockReturnValue(null)

      expect(() =>
        service.handleUpdateSortOrder({
          orders: [{ id: 'nonexistent', sortOrder: 1 }],
        })
      ).toThrow('不存在')
    })
  })
})
