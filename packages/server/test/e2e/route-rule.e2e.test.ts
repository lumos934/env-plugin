import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createTestApp, expectSuccessResponse } from './setup.js'
import { createEnvCreateFixture, createRouteRuleCreateFixture } from '../helpers/fixtures.js'

describe('RouteRule API E2E', () => {
  let app: Express
  let envId: string
  let targetEnvId: string

  beforeEach(async () => {
    app = createTestApp()

    // 创建源环境
    await request(app)
      .post('/dev-manage-api/env/add')
      .send(
        createEnvCreateFixture({
          apiBaseUrl: `http://source-${Date.now()}.example.com`,
          port: 10101,
        })
      )

    // 创建目标环境
    await request(app)
      .post('/dev-manage-api/env/add')
      .send(
        createEnvCreateFixture({
          apiBaseUrl: `http://target-${Date.now()}.example.com`,
          port: 10102,
        })
      )

    // 提取环境 ID
    const listRes = await request(app).get('/dev-manage-api/env/getlist')
    const envs = listRes.body.data?.list || []
    envId = envs[0]?.id
    targetEnvId = envs[1]?.id
  })

  // ---- Happy Path ----
  // 注意：RouteRuleController 使用 res.success({ message, data }) 模式，
  // 所以实际数据在 res.body.data.data 下

  describe('POST /dev-manage-api/route-rule/add', () => {
    it('应成功创建路由规则', async () => {
      const payload = createRouteRuleCreateFixture({
        envId,
        pathPrefix: '/api/users',
        targetEnvId,
      })

      const res = await request(app)
        .post('/dev-manage-api/route-rule/add')
        .send(payload)

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)
      // 嵌套结构: res.success({ message, data }) → data in res.body.data.data
      expect(res.body.data?.data?.id).toBeDefined()
    })
  })

  describe('GET /dev-manage-api/route-rule/list/:envId', () => {
    it('应返回指定环境的路由规则列表', async () => {
      await request(app)
        .post('/dev-manage-api/route-rule/add')
        .send(
          createRouteRuleCreateFixture({ envId, pathPrefix: '/api/a', targetEnvId })
        )

      const res = await request(app).get(
        `/dev-manage-api/route-rule/list/${envId}`
      )

      const data = expectSuccessResponse(res.body)
      expect(data.list).toHaveLength(1)
      expect(data.total).toBe(1)
      expect(data.list[0].pathPrefix).toBe('/api/a')
    })

    it('无规则的环境应返回空列表', async () => {
      const res = await request(app).get(
        `/dev-manage-api/route-rule/list/${envId}`
      )

      const data = expectSuccessResponse(res.body)
      expect(data.list).toEqual([])
      expect(data.total).toBe(0)
    })
  })

  describe('POST /dev-manage-api/route-rule/update', () => {
    it('应成功更新路由规则', async () => {
      const addRes = await request(app)
        .post('/dev-manage-api/route-rule/add')
        .send(
          createRouteRuleCreateFixture({ envId, pathPrefix: '/api/old', targetEnvId })
        )
      const ruleId = addRes.body.data?.data?.id

      const res = await request(app)
        .post('/dev-manage-api/route-rule/update')
        .send({ id: ruleId, pathPrefix: '/api/new' })

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)
      // 嵌套结构
      expect(res.body.data?.data?.pathPrefix).toBe('/api/new')
    })
  })

  describe('POST /dev-manage-api/route-rule/delete', () => {
    it('应成功删除路由规则', async () => {
      const addRes = await request(app)
        .post('/dev-manage-api/route-rule/add')
        .send(
          createRouteRuleCreateFixture({ envId, pathPrefix: '/api/to-delete', targetEnvId })
        )
      const ruleId = addRes.body.data?.data?.id

      const res = await request(app)
        .post('/dev-manage-api/route-rule/delete')
        .send({ id: ruleId })

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)

      // 验证已删除
      const listRes = await request(app).get(
        `/dev-manage-api/route-rule/list/${envId}`
      )
      expect(listRes.body.data.list).toHaveLength(0)
    })
  })

  // ---- DTO 校验错误 ----

  describe('DTO 校验错误', () => {
    it('缺少 envId 时应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/route-rule/add')
        .send({ pathPrefix: '/api/test', targetEnvId })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })

    it('缺少 pathPrefix 时应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/route-rule/add')
        .send({ envId, targetEnvId })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })

    it('pathPrefix 为空字符串时应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/route-rule/add')
        .send({ envId, pathPrefix: '', targetEnvId })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })

    it('删除时缺少 id 应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/route-rule/delete')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })

    it('更新时缺少 id 应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/route-rule/update')
        .send({ pathPrefix: '/new' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })
  })

  // ---- 业务逻辑错误 ----

  describe('业务逻辑错误', () => {
    it('添加规则时缺少 targetEnvId 应返回 500', async () => {
      const res = await request(app)
        .post('/dev-manage-api/route-rule/add')
        .send({ envId, pathPrefix: '/api/no-target' })

      expect(res.body.code).toBe(500)
      expect(res.body.message).toContain('目标环境不能为空')
    })

    it('targetEnvId 不存在应返回 500', async () => {
      const res = await request(app)
        .post('/dev-manage-api/route-rule/add')
        .send({ envId, pathPrefix: '/api/bad-target', targetEnvId: 'non-existent' })

      expect(res.body.code).toBe(500)
      expect(res.body.message).toContain('目标环境')
      expect(res.body.message).toContain('不存在')
    })

    it('同一环境重复 pathPrefix 应返回 500', async () => {
      await request(app)
        .post('/dev-manage-api/route-rule/add')
        .send(
          createRouteRuleCreateFixture({ envId, pathPrefix: '/api/dup', targetEnvId })
        )

      const res = await request(app)
        .post('/dev-manage-api/route-rule/add')
        .send(
          createRouteRuleCreateFixture({ envId, pathPrefix: '/api/dup', targetEnvId })
        )

      expect(res.body.code).toBe(500)
      expect(res.body.message).toContain('已存在路径前缀')
    })

    it('更新不存在的规则应返回 500', async () => {
      const res = await request(app)
        .post('/dev-manage-api/route-rule/update')
        .send({ id: 'non-existent', pathPrefix: '/new' })

      expect(res.body.code).toBe(500)
      expect(res.body.message).toContain('不存在')
    })

    it('删除不存在的规则应返回 500', async () => {
      const res = await request(app)
        .post('/dev-manage-api/route-rule/delete')
        .send({ id: 'non-existent' })

      expect(res.body.code).toBe(500)
      expect(res.body.message).toContain('不存在')
    })
  })

  // ---- 边界情况 ----

  describe('边界情况', () => {
    it('targetEnvId 设为空字符串应清空目标环境', async () => {
      const addRes = await request(app)
        .post('/dev-manage-api/route-rule/add')
        .send(
          createRouteRuleCreateFixture({ envId, pathPrefix: '/api/clearable', targetEnvId })
        )
      const ruleId = addRes.body.data?.data?.id

      const res = await request(app)
        .post('/dev-manage-api/route-rule/update')
        .send({ id: ruleId, targetEnvId: '' })

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)
      // 嵌套结构
      expect(res.body.data?.data?.targetEnvId).toBe('')
    })
  })
})
