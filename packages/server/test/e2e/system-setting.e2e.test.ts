import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createTestApp, expectSuccessResponse } from './setup.js'

describe('System Setting API E2E', () => {
  let app: Express

  beforeEach(() => {
    app = createTestApp()
  })

  describe('GET /dev-manage-api/system-setting', () => {
    it('默认应返回 injectEnabled=true', async () => {
      const res = await request(app).get('/dev-manage-api/system-setting')

      expect(res.status).toBe(200)
      const data = expectSuccessResponse(res.body) as { injectEnabled: boolean }
      expect(data.injectEnabled).toBe(true)
    })
  })

  describe('POST /dev-manage-api/system-setting', () => {
    it('应更新开关并返回新值', async () => {
      const res = await request(app)
        .post('/dev-manage-api/system-setting')
        .send({ injectEnabled: false })

      expect(res.status).toBe(200)
      const data = expectSuccessResponse(res.body) as { injectEnabled: boolean }
      expect(data.injectEnabled).toBe(false)

      // 再次 GET 应反映更新后的值
      const getRes = await request(app).get('/dev-manage-api/system-setting')
      const getData = expectSuccessResponse(getRes.body) as { injectEnabled: boolean }
      expect(getData.injectEnabled).toBe(false)
    })
  })

  describe('DTO 校验错误', () => {
    it('缺少 injectEnabled 应返回 400', async () => {
      const res = await request(app).post('/dev-manage-api/system-setting').send({})

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })

    it('injectEnabled 非布尔值应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/system-setting')
        .send({ injectEnabled: 'yes' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })
  })
})
