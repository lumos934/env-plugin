import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createTestApp, expectSuccessResponse } from './setup.js'

describe('Common API E2E', () => {
  let app: Express

  beforeEach(() => {
    app = createTestApp()
  })

  describe('GET /dev-manage-api/are-you-ok', () => {
    it('应返回健康检查成功响应', async () => {
      const res = await request(app).get('/dev-manage-api/are-you-ok')

      expect(res.status).toBe(200)
      const data = expectSuccessResponse(res.body)
      expect(res.body.message).toBe("I'm ok!")
      expect(data).toEqual({})
    })
  })

  describe('GET /dev-manage-api/clear-proxy-cookie', () => {
    it('无 Cookie 时应返回成功响应', async () => {
      const res = await request(app).get('/dev-manage-api/clear-proxy-cookie')

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)
    })

    it('带匹配后缀的 Cookie 时应设置 Set-Cookie 清空', async () => {
      const res = await request(app)
        .get('/dev-manage-api/clear-proxy-cookie')
        .set('Cookie', 'token-3000-envm=abc123; other=keep')

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)

      // 应包含清空匹配 Cookie 的 Set-Cookie 头
      const setCookieHeader = res.headers['set-cookie']
      expect(setCookieHeader).toBeDefined()
      if (Array.isArray(setCookieHeader)) {
        const clearedCookie = setCookieHeader.find((c: string) =>
          c.includes('token-3000-envm')
        )
        expect(clearedCookie).toBeDefined()
        expect(clearedCookie).toContain('max-age=0')
      } else if (typeof setCookieHeader === 'string') {
        expect(setCookieHeader).toContain('token-3000-envm')
        expect(setCookieHeader).toContain('max-age=0')
      }
    })

    it('不匹配后缀的 Cookie 不应被清空', async () => {
      const res = await request(app)
        .get('/dev-manage-api/clear-proxy-cookie')
        .set('Cookie', 'session=xyz789; other=keep')

      expect(res.status).toBe(200)
      expectSuccessResponse(res.body)

      // 不匹配 envm 后缀的 Cookie 不应产生 Set-Cookie
      const setCookieHeader = res.headers['set-cookie']
      // 应该没有 Set-Cookie header，或者至少不应该包含 session cookie
      if (setCookieHeader) {
        const setCookieStr = Array.isArray(setCookieHeader)
          ? setCookieHeader.join('; ')
          : setCookieHeader
        expect(setCookieStr).not.toContain('session')
      }
    })
  })
})
