import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createTestApp, expectSuccessResponse } from './setup.js'
import { createEnvCreateFixture, createPasswordCreateFixture } from '../helpers/fixtures.js'

describe('Password API E2E', () => {
  let app: Express
  let envId: string

  beforeEach(async () => {
    app = createTestApp()

    // 创建环境作为密码的关联目标
    await request(app)
      .post('/dev-manage-api/env/add')
      .send(
        createEnvCreateFixture({
          apiBaseUrl: `http://pwd-test-${Date.now()}.example.com`,
          port: 20101,
        })
      )

    const listRes = await request(app).get('/dev-manage-api/env/getlist')
    const envs = listRes.body.data?.list || []
    envId = envs[0]?.id
  })

  // ---- Happy Path ----
  // 注意：PasswordController 使用 res.success({ message, data }) 模式，
  // 所以实际数据在 res.body.data.data 下

  describe('POST /dev-manage-api/password/add', () => {
    it('应成功创建密码', async () => {
      const payload = createPasswordCreateFixture({
        envId,
        name: 'DB Password',
        username: 'admin',
        password: 'secret123',
      })

      const res = await request(app)
        .post('/dev-manage-api/password/add')
        .send(payload)

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)
      // 嵌套结构: res.success({ message, data }) → data in res.body.data.data
      expect(res.body.data?.data?.id).toBeDefined()
      expect(res.body.data?.data?.name).toBe('DB Password')
    })
  })

  describe('GET /dev-manage-api/password/list/:envId', () => {
    it('应返回指定环境的密码列表', async () => {
      await request(app)
        .post('/dev-manage-api/password/add')
        .send(
          createPasswordCreateFixture({
            envId,
            name: 'API Key',
            username: 'apiuser',
            password: 'key123',
          })
        )

      const res = await request(app).get(
        `/dev-manage-api/password/list/${envId}`
      )

      const data = expectSuccessResponse(res.body)
      expect(data.list).toHaveLength(1)
      expect(data.total).toBe(1)
      expect(data.list[0].name).toBe('API Key')
    })

    it('无密码的环境应返回空列表', async () => {
      const res = await request(app).get(
        `/dev-manage-api/password/list/${envId}`
      )

      const data = expectSuccessResponse(res.body)
      expect(data.list).toEqual([])
      expect(data.total).toBe(0)
    })
  })

  describe('POST /dev-manage-api/password/update', () => {
    it('应成功更新密码', async () => {
      const addRes = await request(app)
        .post('/dev-manage-api/password/add')
        .send(
          createPasswordCreateFixture({
            envId,
            name: 'Old Name',
            username: 'olduser',
            password: 'oldpass',
          })
        )
      const pwdId = addRes.body.data?.data?.id

      const res = await request(app)
        .post('/dev-manage-api/password/update')
        .send({ id: pwdId, username: 'newuser' })

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)
      // 嵌套结构
      expect(res.body.data?.data?.username).toBe('newuser')
    })
  })

  describe('POST /dev-manage-api/password/delete', () => {
    it('应成功删除密码', async () => {
      const addRes = await request(app)
        .post('/dev-manage-api/password/add')
        .send(
          createPasswordCreateFixture({
            envId,
            name: 'To Delete',
            username: 'temp',
            password: 'temp',
          })
        )
      const pwdId = addRes.body.data?.data?.id

      const res = await request(app)
        .post('/dev-manage-api/password/delete')
        .send({ id: pwdId })

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)

      // 验证已删除
      const listRes = await request(app).get(
        `/dev-manage-api/password/list/${envId}`
      )
      expect(listRes.body.data.list).toHaveLength(0)
    })
  })

  // ---- DTO 校验错误 ----

  describe('DTO 校验错误', () => {
    it('缺少 envId 时应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/password/add')
        .send({ name: 'Test', username: 'u', password: 'p' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })

    it('缺少 name 时应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/password/add')
        .send({ envId, username: 'u', password: 'p' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })

    it('name 为空字符串时应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/password/add')
        .send({ envId, name: '', username: 'u', password: 'p' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })

    it('缺少 username 时应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/password/add')
        .send({ envId, name: 'Test', password: 'p' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })

    it('缺少 password 时应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/password/add')
        .send({ envId, name: 'Test', username: 'u' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })

    it('删除时缺少 id 应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/password/delete')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })
  })

  // ---- 业务逻辑错误 ----

  describe('业务逻辑错误', () => {
    it('同一环境重复 name 应返回 500', async () => {
      await request(app)
        .post('/dev-manage-api/password/add')
        .send(
          createPasswordCreateFixture({
            envId,
            name: 'DuplicateName',
            username: 'user1',
            password: 'pass1',
          })
        )

      const res = await request(app)
        .post('/dev-manage-api/password/add')
        .send(
          createPasswordCreateFixture({
            envId,
            name: 'DuplicateName',
            username: 'user2',
            password: 'pass2',
          })
        )

      expect(res.body.code).toBe(500)
      expect(res.body.message).toContain('已存在名称为')
    })

    it('更新不存在的密码应返回 500', async () => {
      const res = await request(app)
        .post('/dev-manage-api/password/update')
        .send({ id: 'non-existent', name: 'NewName' })

      expect(res.body.code).toBe(500)
      expect(res.body.message).toContain('不存在')
    })

    it('删除不存在的密码应返回 500', async () => {
      const res = await request(app)
        .post('/dev-manage-api/password/delete')
        .send({ id: 'non-existent' })

      expect(res.body.code).toBe(500)
      expect(res.body.message).toContain('不存在')
    })
  })

  // ---- 边界情况 ----

  describe('边界情况', () => {
    it('设置 isDefault=true 应自动清除旧默认密码', async () => {
      // 添加第一个密码并设为默认
      await request(app)
        .post('/dev-manage-api/password/add')
        .send(
          createPasswordCreateFixture({
            envId,
            name: 'First Default',
            username: 'user1',
            password: 'pass1',
            isDefault: true,
          })
        )

      // 添加第二个密码并设为默认
      const res = await request(app)
        .post('/dev-manage-api/password/add')
        .send(
          createPasswordCreateFixture({
            envId,
            name: 'Second Default',
            username: 'user2',
            password: 'pass2',
            isDefault: true,
          })
        )

      expect(res.status).toBe(200)

      // 验证列表中只有最新的一个是默认
      const listRes = await request(app).get(`/dev-manage-api/password/list/${envId}`)
      const passwords = listRes.body.data?.list || []

      const defaultPasswords = passwords.filter(
        (p: Record<string, unknown>) => p.isDefault === true
      )
      expect(defaultPasswords).toHaveLength(1)
      expect(defaultPasswords[0].name).toBe('Second Default')
    })

    it('更新 name 为冲突值应返回 500', async () => {
      await request(app)
        .post('/dev-manage-api/password/add')
        .send(
          createPasswordCreateFixture({
            envId,
            name: 'NameA',
            username: 'userA',
            password: 'passA',
          })
        )

      const addRes = await request(app)
        .post('/dev-manage-api/password/add')
        .send(
          createPasswordCreateFixture({
            envId,
            name: 'NameB',
            username: 'userB',
            password: 'passB',
          })
        )
      const pwdBId = addRes.body.data?.data?.id

      // 尝试把 NameB 改名为 NameA（冲突）
      const res = await request(app)
        .post('/dev-manage-api/password/update')
        .send({ id: pwdBId, name: 'NameA' })

      expect(res.body.code).toBe(500)
      expect(res.body.message).toContain('已存在名称为')
    })
  })
})
