import { describe, it, expect, beforeEach } from 'vitest'
import { PasswordService } from '../../src/service/PasswordService.js'
import { createMockPasswordRepo } from '../helpers/mockRepos.js'
import {
  createPasswordFixture,
  createPasswordCreateFixture,
} from '../helpers/fixtures.js'

describe('PasswordService', () => {
  let service: PasswordService
  let mockPasswordRepo: ReturnType<typeof createMockPasswordRepo>

  beforeEach(() => {
    mockPasswordRepo = createMockPasswordRepo()
    service = new PasswordService(mockPasswordRepo)
  })

  describe('handleGetByEnvId', () => {
    it('应返回指定环境的密码列表', () => {
      const pwd = createPasswordFixture({ envId: 'env-a' })
      mockPasswordRepo.getByEnvId.mockReturnValue([pwd])

      const result = service.handleGetByEnvId('env-a')
      expect(result).toHaveLength(1)
    })
  })

  describe('handleAdd', () => {
    it('应成功添加密码', () => {
      mockPasswordRepo.existsByEnvIdAndName.mockReturnValue(false)

      const create = createPasswordCreateFixture({
        envId: 'env-a',
        name: 'DB',
        username: 'admin',
        password: 'secret',
      })
      const result = service.handleAdd(create)

      expect(mockPasswordRepo.create).toHaveBeenCalledTimes(1)
      expect(result.id).toBeDefined()
      expect(result.createdAt).toBeDefined()
      expect(result.updatedAt).toBeDefined()
    })

    it('名称重复应抛出 Error', () => {
      mockPasswordRepo.existsByEnvIdAndName.mockReturnValue(true)

      const create = createPasswordCreateFixture({ name: 'Duplicate' })

      expect(() => service.handleAdd(create)).toThrow('已存在名称为')
    })

    it('设为默认密码时应先清除其他默认', () => {
      mockPasswordRepo.existsByEnvIdAndName.mockReturnValue(false)

      const create = createPasswordCreateFixture({ isDefault: true })
      service.handleAdd(create)

      expect(mockPasswordRepo.clearDefaultByEnvId).toHaveBeenCalled()
    })

    it('非默认密码时不应清除其他默认', () => {
      mockPasswordRepo.existsByEnvIdAndName.mockReturnValue(false)

      const create = createPasswordCreateFixture({ isDefault: false })
      service.handleAdd(create)

      expect(mockPasswordRepo.clearDefaultByEnvId).not.toHaveBeenCalled()
    })
  })

  describe('handleUpdate', () => {
    it('应成功更新密码', () => {
      const existing = createPasswordFixture({ id: 'update-pwd', username: 'old' })
      mockPasswordRepo.findOneById.mockReturnValue(existing)

      const result = service.handleUpdate({ id: 'update-pwd', username: 'new' })

      expect(mockPasswordRepo.update).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('密码不存在应抛出 Error', () => {
      mockPasswordRepo.findOneById.mockReturnValue(null)

      expect(() => service.handleUpdate({ id: 'nonexistent', username: 'new' })).toThrow(
        '不存在'
      )
    })

    it('更新名称冲突应抛出 Error', () => {
      const existing = createPasswordFixture({
        id: 'update-pwd',
        envId: 'env-a',
        name: 'OldName',
      })
      mockPasswordRepo.findOneById.mockReturnValue(existing)
      mockPasswordRepo.existsByEnvIdAndName.mockReturnValue(true)

      expect(() =>
        service.handleUpdate({ id: 'update-pwd', name: 'ConflictName' })
      ).toThrow('已存在名称为')
    })

    it('从非默认改为默认时应清除其他默认', () => {
      const existing = createPasswordFixture({
        id: 'update-pwd',
        envId: 'env-a',
        isDefault: false,
      })
      mockPasswordRepo.findOneById.mockReturnValueOnce(existing)
      // handleUpdate 内部最后也会调用 findOneById 返回更新后的结果
      mockPasswordRepo.findOneById.mockReturnValueOnce({ ...existing, isDefault: true })

      service.handleUpdate({ id: 'update-pwd', isDefault: true })

      expect(mockPasswordRepo.clearDefaultByEnvId).toHaveBeenCalledWith('env-a', 'update-pwd')
    })

    it('已是默认时再设为默认不应清除', () => {
      const existing = createPasswordFixture({
        id: 'update-pwd',
        envId: 'env-a',
        isDefault: true,
      })
      mockPasswordRepo.findOneById.mockReturnValue(existing)
      mockPasswordRepo.findOneById.mockReturnValue(existing)

      service.handleUpdate({ id: 'update-pwd', isDefault: true })

      expect(mockPasswordRepo.clearDefaultByEnvId).not.toHaveBeenCalled()
    })

    it('应自动设置 updatedAt', () => {
      const existing = createPasswordFixture({ id: 'update-pwd' })
      mockPasswordRepo.findOneById.mockReturnValue(existing)
      mockPasswordRepo.findOneById.mockReturnValue(existing)

      service.handleUpdate({ id: 'update-pwd' })

      const updateCall = mockPasswordRepo.update.mock.calls[0][0]
      expect(updateCall.updatedAt).toBeDefined()
    })
  })

  describe('handleDelete', () => {
    it('应成功删除已存在的密码', () => {
      mockPasswordRepo.findOneById.mockReturnValue(createPasswordFixture({ id: 'del-pwd' }))

      service.handleDelete({ id: 'del-pwd' })

      expect(mockPasswordRepo.delete).toHaveBeenCalledWith({ id: 'del-pwd' })
    })

    it('密码不存在应抛出 Error', () => {
      mockPasswordRepo.findOneById.mockReturnValue(null)

      expect(() => service.handleDelete({ id: 'nonexistent' })).toThrow('不存在')
    })
  })
})
