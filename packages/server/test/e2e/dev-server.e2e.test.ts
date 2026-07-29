import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createTestApp, expectSuccessResponse } from './setup.js'
import { createDevServerCreateFixture } from '../helpers/fixtures.js'
import { createEnvCreateFixture } from '../helpers/fixtures.js'

describe('DevServer API E2E', () => {
  let app: Express

  beforeEach(() => {
    app = createTestApp()
  })

  // ---- Happy Path ----

  describe('POST /dev-manage-api/server/add', () => {
    it('应成功创建开发服务器', async () => {
      const payload = createDevServerCreateFixture({
        name: 'Test Server',
        devServerUrl: 'http://localhost:5173',
      })

      const res = await request(app)
        .post('/dev-manage-api/server/add')
        .send(payload)

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)

      // 验证已添加到列表
      const listRes = await request(app).get('/dev-manage-api/server/list')
      const list = listRes.body.data?.list || []
      expect(list).toHaveLength(1)
      expect(list[0].name).toBe('Test Server')
      expect(list[0].devServerUrl).toBe('http://localhost:5173')
    })
  })

  describe('GET /dev-manage-api/server/list', () => {
    it('空数据库应返回空列表', async () => {
      const res = await request(app).get('/dev-manage-api/server/list')

      expect(res.status).toBe(200)
      const data = expectSuccessResponse(res.body)
      expect(data.list).toEqual([])
    })

    it('应返回所有开发服务器', async () => {
      await request(app)
        .post('/dev-manage-api/server/add')
        .send(createDevServerCreateFixture({ devServerUrl: 'http://localhost:3000' }))
      await request(app)
        .post('/dev-manage-api/server/add')
        .send(createDevServerCreateFixture({ devServerUrl: 'http://localhost:3001' }))

      const res = await request(app).get('/dev-manage-api/server/list')
      const data = expectSuccessResponse(res.body)
      expect(data.list).toHaveLength(2)
    })
  })

  describe('PUT /dev-manage-api/server/update', () => {
    it('应成功更新开发服务器', async () => {
      await request(app)
        .post('/dev-manage-api/server/add')
        .send(createDevServerCreateFixture({ devServerUrl: 'http://localhost:4000' }))

      const listRes = await request(app).get('/dev-manage-api/server/list')
      const serverId = listRes.body.data.list[0].id

      const res = await request(app)
        .put('/dev-manage-api/server/update')
        .send({ id: serverId, name: 'Updated Server' })

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)

      const updatedList = await request(app).get('/dev-manage-api/server/list')
      expect(updatedList.body.data.list[0].name).toBe('Updated Server')
    })
  })

  describe('DELETE /dev-manage-api/server/', () => {
    it('应成功删除开发服务器', async () => {
      await request(app)
        .post('/dev-manage-api/server/add')
        .send(createDevServerCreateFixture({ devServerUrl: 'http://localhost:5000' }))

      const listRes = await request(app).get('/dev-manage-api/server/list')
      const serverId = listRes.body.data.list[0].id

      const res = await request(app)
        .delete('/dev-manage-api/server/')
        .send({ id: serverId })

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)

      const afterList = await request(app).get('/dev-manage-api/server/list')
      expect(afterList.body.data.list).toHaveLength(0)
    })
  })

  describe('PUT /dev-manage-api/server/sort', () => {
    it('应成功更新排序', async () => {
      await request(app)
        .post('/dev-manage-api/server/add')
        .send(createDevServerCreateFixture({ devServerUrl: 'http://localhost:6000' }))
      await request(app)
        .post('/dev-manage-api/server/add')
        .send(createDevServerCreateFixture({ devServerUrl: 'http://localhost:6001' }))

      const listRes = await request(app).get('/dev-manage-api/server/list')
      const ids = listRes.body.data.list.map((s: Record<string, unknown>) => s.id)

      const res = await request(app)
        .put('/dev-manage-api/server/sort')
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
    it('缺少 name 时应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/server/add')
        .send({ devServerUrl: 'http://localhost:7000' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })

    it('缺少 devServerUrl 时应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/server/add')
        .send({ name: 'No URL' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })

    it('更新时缺少 id 应返回 400', async () => {
      const res = await request(app)
        .put('/dev-manage-api/server/update')
        .send({ name: 'NoId' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })

    it('删除时缺少 id 应返回 400', async () => {
      const res = await request(app)
        .delete('/dev-manage-api/server/')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })
  })

  // ---- 业务逻辑错误 ----

  describe('业务逻辑错误', () => {
    it('添加重复 devServerUrl 应返回错误', async () => {
      const payload = createDevServerCreateFixture({
        devServerUrl: 'http://localhost:8000',
      })

      await request(app).post('/dev-manage-api/server/add').send(payload)

      const res = await request(app)
        .post('/dev-manage-api/server/add')
        .send({ ...payload })

      expect(res.body.code).toBe(500)
      expect(res.body.message).toContain('已存在')
    })

    it('更新不存在的开发服务器应返回错误', async () => {
      const res = await request(app)
        .put('/dev-manage-api/server/update')
        .send({ id: 'non-existent-id', name: 'Whatever' })

      expect(res.body.code).toBe(500)
      expect(res.body.message).toContain('不存在')
    })

    it('删除不存在的开发服务器应返回错误', async () => {
      const res = await request(app)
        .delete('/dev-manage-api/server/')
        .send({ id: 'non-existent-id' })

      expect(res.body.code).toBe(500)
      expect(res.body.message).toContain('不存在')
    })

    it('删除已关联环境的开发服务器应返回错误', async () => {
      // 先创建 devServer
      const payload = createDevServerCreateFixture({
        name: 'Linked Server',
        devServerUrl: 'http://localhost:9000',
      })
      await request(app).post('/dev-manage-api/server/add').send(payload)

      const listRes = await request(app).get('/dev-manage-api/server/list')
      const serverId = listRes.body.data.list[0].id

      // 创建关联此 devServer 的环境
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(
          createEnvCreateFixture({
            apiBaseUrl: 'http://linked-env.example.com',
            port: 9001,
            devServerId: serverId,
          })
        )

      // 尝试删除已关联的 devServer
      const res = await request(app)
        .delete('/dev-manage-api/server/')
        .send({ id: serverId })

      expect(res.body.code).toBe(500)
      expect(res.body.message).toContain('已关联')
    })
  })
})
