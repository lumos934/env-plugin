import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createTestApp, expectSuccessResponse } from './setup.js'

interface SystemSettingData {
  injectEnabled: boolean
  logEnabled: boolean
}

describe('System Setting API E2E', () => {
  let app: Express

  beforeEach(() => {
    app = createTestApp()
  })

  describe('GET /dev-manage-api/system-setting', () => {
    it('默认应返回 injectEnabled=false, logEnabled=false', async () => {
      const res = await request(app).get('/dev-manage-api/system-setting')

      expect(res.status).toBe(200)
      const data = expectSuccessResponse(res.body) as SystemSettingData
      expect(data.injectEnabled).toBe(false)
      expect(data.logEnabled).toBe(false)
    })
  })

  describe('POST /dev-manage-api/system-setting', () => {
    it('应更新开关并返回新值', async () => {
      const res = await request(app)
        .post('/dev-manage-api/system-setting')
        .send({ injectEnabled: true, logEnabled: true })

      expect(res.status).toBe(200)
      const data = expectSuccessResponse(res.body) as SystemSettingData
      expect(data.injectEnabled).toBe(true)
      expect(data.logEnabled).toBe(true)

      // 再次 GET 应反映更新后的值
      const getRes = await request(app).get('/dev-manage-api/system-setting')
      const getData = expectSuccessResponse(getRes.body) as SystemSettingData
      expect(getData.injectEnabled).toBe(true)
      expect(getData.logEnabled).toBe(true)
    })
  })

  describe('DTO 校验错误', () => {
    it('缺少 logEnabled 应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/system-setting')
        .send({ injectEnabled: true })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })

    it('缺少 injectEnabled 应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/system-setting')
        .send({ logEnabled: true })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })

    it('injectEnabled 非布尔值应返回 400', async () => {
      const res = await request(app)
        .post('/dev-manage-api/system-setting')
        .send({ injectEnabled: 'yes', logEnabled: false })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(400)
    })
  })
})
