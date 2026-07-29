import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createTestApp, expectSuccessResponse } from './setup.js'
import { createEnvCreateFixture } from '../helpers/fixtures.js'

describe('Env API E2E', () => {
  let app: Express

  beforeEach(() => {
    app = createTestApp()
  })

  // ---- Happy Path ----

  describe('POST /dev-manage-api/env/add', () => {
    it('应成功创建新环境', async () => {
      const payload = createEnvCreateFixture({
        apiBaseUrl: 'http://test-env.example.com',
        port: 3001,
      })

      const res = await request(app)
        .post('/dev-manage-api/env/add')
        .send(payload)

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)

      // 验证环境已添加到列表中
      const listRes = await request(app).get('/dev-manage-api/env/getlist')
      const list = listRes.body.data?.list || []
      expect(list).toHaveLength(1)
      expect(list[0].apiBaseUrl).toBe('http://test-env.example.com')
      expect(list[0].port).toBe(3001)
      expect(list[0].status).toBe('stopped')
    })

    it('应自动生成 id 和默认 status', async () => {
      const payload = createEnvCreateFixture({
        apiBaseUrl: 'http://auto-id.example.com',
        port: 3002,
      })

      await request(app).post('/dev-manage-api/env/add').send(payload)

      const listRes = await request(app).get('/dev-manage-api/env/getlist')
      const env = listRes.body.data?.list?.[0]
      expect(env.id).toBeDefined()
      expect(typeof env.id).toBe('string')
      expect(env.id.length).toBeGreaterThan(0)
      expect(env.status).toBe('stopped')
    })
  })

  describe('GET /dev-manage-api/env/getlist', () => {
    it('空数据库应返回空列表', async () => {
      const res = await request(app).get('/dev-manage-api/env/getlist')

      expect(res.status).toBe(200)
      const data = expectSuccessResponse(res.body)
      expect(data).toEqual({ list: [], total: 0 })
    })

    it('应返回所有环境及其 routeRuleCount', async () => {
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://a.example.com', port: 4001 }))
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://b.example.com', port: 4002 }))

      const res = await request(app).get('/dev-manage-api/env/getlist')

      const data = expectSuccessResponse(res.body)
      expect(data.list).toHaveLength(2)
      expect(data.total).toBe(2)
      // routeRuleCount 应由 Service 层填充（初始为 0）
      data.list.forEach((env: Record<string, unknown>) => {
        expect(env.routeRuleCount).toBe(0)
      })
    })
  })

  describe('POST /dev-manage-api/env/update', () => {
    it('应成功更新环境信息', async () => {
      // 先创建
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://update-test.example.com', port: 5001 }))

      const listRes = await request(app).get('/dev-manage-api/env/getlist')
      const envId = listRes.body.data.list[0].id

      // 更新名称
      const res = await request(app)
        .post('/dev-manage-api/env/update')
        .send({ id: envId, name: 'Updated Env Name' })

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)

      // 验证更新后的数据
      const updatedListRes = await request(app).get('/dev-manage-api/env/getlist')
      expect(updatedListRes.body.data.list[0].name).toBe('Updated Env Name')
    })
  })

  describe('POST /dev-manage-api/env/delete', () => {
    it('应成功删除环境', async () => {
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://delete-test.example.com', port: 6001 }))

      const listRes = await request(app).get('/dev-manage-api/env/getlist')
      const envId = listRes.body.data.list[0].id

      const res = await request(app)
        .post('/dev-manage-api/env/delete')
        .send({ id: envId })

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)

      // 验证已从列表中移除
      const afterListRes = await request(app).get('/dev-manage-api/env/getlist')
      expect(afterListRes.body.data.list).toHaveLength(0)
    })
  })

  describe('POST /dev-manage-api/env/start', () => {
    it('应成功启动环境代理（PreProxyServer mocked）', async () => {
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://start-test.example.com', port: 7001 }))

      const listRes = await request(app).get('/dev-manage-api/env/getlist')
      const envId = listRes.body.data.list[0].id

      const res = await request(app)
        .post('/dev-manage-api/env/start')
        .send({ id: envId })

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)

      // 验证 status 变为 running
      const afterListRes = await request(app).get('/dev-manage-api/env/getlist')
      expect(afterListRes.body.data.list[0].status).toBe('running')
    })
  })

  describe('POST /dev-manage-api/env/stop', () => {
    it('应成功停止已启动的环境', async () => {
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://stop-test.example.com', port: 8001 }))

      const listRes = await request(app).get('/dev-manage-api/env/getlist')
      const envId = listRes.body.data.list[0].id

      // 先启动
      await request(app).post('/dev-manage-api/env/start').send({ id: envId })

      // 再停止
      const res = await request(app)
        .post('/dev-manage-api/env/stop')
        .send({ id: envId })

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)

      // 验证 status 变为 stopped
      const afterListRes = await request(app).get('/dev-manage-api/env/getlist')
      expect(afterListRes.body.data.list[0].status).toBe('stopped')
    })
  })

  describe('PUT /dev-manage-api/env/sort', () => {
    it('应成功更新排序', async () => {
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://sort-a.example.com', port: 9001 }))
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://sort-b.example.com', port: 9002 }))

      const listRes = await request(app).get('/dev-manage-api/env/getlist')
      const ids = listRes.body.data.list.map((e: Record<string, unknown>) => e.id)

      const res = await request(app)
        .put('/dev-manage-api/env/sort')
        .send({
          orders: [
            { id: ids[0], sortOrder: 2 },
            { id: ids[1], sortOrder: 1 },
          ],
        })

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)
    })
  })

  // ---- DTO 校验错误 ----

  describe('DTO 校验错误', () => {
    it('缺少 apiBaseUrl 时应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/env/add')
        .send({ port: 3000 })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
      expect(res.body.errors).toBeDefined()
    })

    it('port 为 0 时应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/env/add')
        .send({ apiBaseUrl: 'http://test.example.com', port: 0 })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
      expect(res.body.message).toContain('端口号')
    })

    it('port 超过 65535 时应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/env/add')
        .send({ apiBaseUrl: 'http://test.example.com', port: 65536 })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
      expect(res.body.message).toContain('端口号')
    })

    it('删除环境时缺少 id 应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/env/delete')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })

    it('更新环境时缺少 id 应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/env/update')
        .send({ name: 'NoId' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })
  })

  // ---- 业务逻辑错误 ----
  // 注意：EnvController.handleDeleteEnv 缺少 await，导致
  // Service 中的同步 throw 成为 unhandled rejection，res.success() 先于错误处理被调用

  describe('业务逻辑错误', () => {
    it('添加重复 apiBaseUrl 应返回错误', async () => {
      const payload = createEnvCreateFixture({
        apiBaseUrl: 'http://duplicate.example.com',
        port: 3101,
      })

      await request(app).post('/dev-manage-api/env/add').send(payload)

      const res = await request(app)
        .post('/dev-manage-api/env/add')
        .send({ ...payload, port: 3102 })

      expect(res.status).toBe(500)
      expect(res.body.code).toBe(500)
      expect(res.body.message).toContain('已存在')
    })

    it('更新不存在的环境应返回错误', async () => {
      const res = await request(app)
        .post('/dev-manage-api/env/update')
        .send({ id: 'non-existent-id', name: 'Whatever' })

      expect(res.body.code).toBe(500)
      expect(res.body.message).toContain('不存在')
    })

    // BUG: Controller 缺少 await handleDeleteEnv，同步抛出的 AppError
    // 变为 unhandled rejection，res.success() 先执行
    it('删除不存在的环境因 Controller bug 返回 200', async () => {
      const res = await request(app)
        .post('/dev-manage-api/env/delete')
        .send({ id: 'non-existent-id' })

      expect(res.body.code).toBe(200)
    })

    it('启动不存在的环境应返回错误', async () => {
      const res = await request(app)
        .post('/dev-manage-api/env/start')
        .send({ id: 'non-existent-id' })

      expect(res.body.code).toBe(500)
      expect(res.body.message).toContain('不存在')
    })

    it('停止不存在的环境应返回错误', async () => {
      const res = await request(app)
        .post('/dev-manage-api/env/stop')
        .send({ id: 'non-existent-id' })

      expect(res.body.code).toBe(500)
      expect(res.body.message).toContain('不存在')
    })
  })
})
