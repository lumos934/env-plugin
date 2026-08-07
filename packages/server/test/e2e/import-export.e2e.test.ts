import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createTestApp, expectSuccessResponse, expectErrorResponse } from './setup.js'
import { createEnvCreateFixture, createDevServerCreateFixture } from '../helpers/fixtures.js'
import type { ExportData } from '../../src/types/index.js'

describe('Import/Export API E2E', () => {
  let app: Express

  beforeEach(() => {
    app = createTestApp()
  })

  // ==================== 导出 ====================

  describe('POST /dev-manage-api/env/export', () => {
    it('应导出已有环境的完整数据', async () => {
      // 先创建 DevServer
      await request(app)
        .post('/dev-manage-api/server/add')
        .send(createDevServerCreateFixture({ devServerUrl: 'http://localhost:5173' }))
      const dsListRes = await request(app).get('/dev-manage-api/server/list')
      const devServer = dsListRes.body.data?.list?.[0]

      // 创建环境
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(
          createEnvCreateFixture({
            apiBaseUrl: 'http://api.example.com',
            port: 4099,
            devServerId: devServer.id,
          }),
        )

      const listRes = await request(app).get('/dev-manage-api/env/getlist')
      const env = listRes.body.data?.list?.[0]

      // 创建第二个环境作为 routeRule 的 targetEnvId
      const targetEnvRes = await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://target.example.com', port: 4100 }))
      expect(targetEnvRes.status).toBe(200)
      const envListRes2 = await request(app).get('/dev-manage-api/env/getlist')
      const targetEnv = envListRes2.body.data?.list?.[1]

      // 添加路由规则
      const ruleAddRes = await request(app)
        .post('/dev-manage-api/route-rule/add')
        .send({
          envId: env.id,
          pathPrefix: '/api/user',
          description: 'User API',
          targetEnvId: targetEnv.id,
        })
      expect(ruleAddRes.status).toBe(200)

      // 验证路由规则已添加
      const ruleListRes = await request(app).get(`/dev-manage-api/route-rule/list/${env.id}`)
      expect(ruleListRes.body.data.list).toHaveLength(1)

      // 添加密码
      await request(app)
        .post('/dev-manage-api/password/add')
        .send({
          envId: env.id,
          name: 'DB',
          username: 'admin',
          password: 'secret123',
        })

      // 导出
      const exportRes = await request(app)
        .post('/dev-manage-api/env/export')
        .send({ envIds: [env.id] })

      expect(exportRes.status).toBe(200)
      const data = expectSuccessResponse(exportRes.body) as ExportData
      expect(data.version).toBe('1.0.0')
      expect(data.envs).toHaveLength(1)
      expect(data.envs[0].apiBaseUrl).toBe('http://api.example.com')
      expect(data.envs[0].devServerUrl).toBe('http://localhost:5173')
      expect(data.envs[0].routeRules).toHaveLength(1)
      expect(data.envs[0].routeRules[0].pathPrefix).toBe('/api/user')
      expect(data.envs[0].passwords).toHaveLength(1)
      expect(data.envs[0].passwords[0].password).toBe('secret123')
      expect(data.devServers).toHaveLength(1)
    })

    it('空数据库应返回空数据', async () => {
      const res = await request(app)
        .post('/dev-manage-api/env/export')
        .send({})

      expect(res.status).toBe(200)
      const data = expectSuccessResponse(res.body) as ExportData
      expect(data.envs).toHaveLength(0)
      expect(data.devServers).toHaveLength(0)
    })

    it('应包含关联的 devServer 信息', async () => {
      // 创建 DevServer
      await request(app)
        .post('/dev-manage-api/server/add')
        .send(createDevServerCreateFixture({ devServerUrl: 'http://localhost:5173', name: 'Vite' }))

      const dsListRes = await request(app).get('/dev-manage-api/server/list')
      const ds = dsListRes.body.data?.list?.[0]

      // 创建环境
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://x.example.com', port: 5000, devServerId: ds.id }))

      const envListRes = await request(app).get('/dev-manage-api/env/getlist')
      const env = envListRes.body.data?.list?.[0]

      const exportRes = await request(app)
        .post('/dev-manage-api/env/export')
        .send({ envIds: [env.id] })

      const data = expectSuccessResponse(exportRes.body) as ExportData
      expect(data.devServers).toHaveLength(1)
      expect(data.devServers[0].name).toBe('Vite')
      expect(data.devServers[0].devServerUrl).toBe('http://localhost:5173')
    })

    it('routeRule targetEnvId 应正确映射为 apiBaseUrl', async () => {
      // 创建两个环境
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://source.example.com', port: 6001 }))
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://target.example.com', port: 6002 }))

      const envListRes = await request(app).get('/dev-manage-api/env/getlist')
      const sourceEnv = envListRes.body.data?.list?.[0]
      const targetEnv = envListRes.body.data?.list?.[1]

      // 添加带 targetEnvId 的路由规则
      await request(app)
        .post('/dev-manage-api/route-rule/add')
        .send({
          envId: sourceEnv.id,
          pathPrefix: '/api/proxy',
          targetEnvId: targetEnv.id,
        })

      const exportRes = await request(app)
        .post('/dev-manage-api/env/export')
        .send({ envIds: [sourceEnv.id] })

      const data = expectSuccessResponse(exportRes.body) as ExportData
      expect(data.envs[0].routeRules[0].targetEnvApiBaseUrl).toBe('http://target.example.com')
    })

    it('启用加密时应返回加密后的 password 字段', async () => {
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://enc.example.com', port: 7001 }))

      const envListRes = await request(app).get('/dev-manage-api/env/getlist')
      const env = envListRes.body.data?.list?.[0]

      await request(app)
        .post('/dev-manage-api/password/add')
        .send({ envId: env.id, name: 'Key', username: 'u', password: 'plain-secret' })

      const exportRes = await request(app)
        .post('/dev-manage-api/env/export')
        .send({ envIds: [env.id], encryptPassword: 'mypass' })

      const data = expectSuccessResponse(exportRes.body) as ExportData
      expect(data.encrypted).toBe(true)
      expect(data.envs[0].passwords[0].password).not.toBe('plain-secret')
      expect(data.envs[0].passwords[0].password).toMatch(/^[0-9a-f]+$/)
    })
  })

  // ==================== 导入 ====================

  describe('POST /dev-manage-api/env/import', () => {
    it('应成功创建新环境及关联数据', async () => {
      const importPayload = {
        data: {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          encrypted: false,
          devServers: [
            { name: 'Local', devServerUrl: 'http://localhost:5173' },
          ],
          envs: [
            {
              apiBaseUrl: 'http://new.example.com',
              port: 4099,
              name: 'New Env',
              devServerUrl: 'http://localhost:5173',
              routeRules: [
                { pathPrefix: '/api/test', description: 'Test rule', enabled: true },
              ],
              passwords: [
                { name: 'DB', username: 'admin', password: 'pass' },
              ],
            },
          ],
        },
        conflictStrategy: 'skip',
      }

      const res = await request(app)
        .post('/dev-manage-api/env/import')
        .send(importPayload)

      expect(res.status).toBe(200)
      const result = expectSuccessResponse(res.body) as Record<string, unknown>
      expect(result.created).toEqual(
        expect.objectContaining({
          envs: 1,
          devServers: 1,
          routeRules: 1,
          passwords: 1,
        }),
      )

      // 验证环境已创建
      const envListRes = await request(app).get('/dev-manage-api/env/getlist')
      const envs = envListRes.body.data?.list || []
      expect(envs).toHaveLength(1)
      expect(envs[0].apiBaseUrl).toBe('http://new.example.com')
      expect(envs[0].port).toBe(4099)
      expect(envs[0].name).toBe('New Env')
    })

    it('重复 apiBaseUrl + skip 策略应跳过', async () => {
      // 先创建一个环境
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://dup.example.com', port: 8001 }))

      // 尝试导入相同 apiBaseUrl 的环境
      const importPayload = {
        data: {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          encrypted: false,
          devServers: [],
          envs: [
            {
              apiBaseUrl: 'http://dup.example.com',
              port: 8002,
              name: 'Dup Env',
              routeRules: [{ pathPrefix: '/api/v2' }],
              passwords: [],
            },
          ],
        },
        conflictStrategy: 'skip',
      }

      const res = await request(app)
        .post('/dev-manage-api/env/import')
        .send(importPayload)

      const result = expectSuccessResponse(res.body) as Record<string, unknown>
      expect(result.skipped).toEqual(expect.objectContaining({ envs: 1 }))
      expect(result.created.envs).toBe(0)

      // 验证原有环境未被修改
      const envListRes = await request(app).get('/dev-manage-api/env/getlist')
      expect(envListRes.body.data.list).toHaveLength(1)
      expect(envListRes.body.data.list[0].port).toBe(8001) // 保持原端口不变
    })

    it('重复 apiBaseUrl + overwrite 策略应覆盖', async () => {
      // 先创建一个环境
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://overwrite.example.com', port: 8001 }))

      const importPayload = {
        data: {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          encrypted: false,
          devServers: [],
          envs: [
            {
              apiBaseUrl: 'http://overwrite.example.com',
              port: 8002,
              name: 'Overwritten Env',
              routeRules: [],
              passwords: [],
            },
          ],
        },
        conflictStrategy: 'overwrite',
      }

      const res = await request(app)
        .post('/dev-manage-api/env/import')
        .send(importPayload)

      const result = expectSuccessResponse(res.body) as Record<string, unknown>
      expect(result.overwritten).toEqual(expect.objectContaining({ envs: 1 }))

      // 验证环境已更新
      const envListRes = await request(app).get('/dev-manage-api/env/getlist')
      expect(envListRes.body.data.list[0].port).toBe(8002)
      expect(envListRes.body.data.list[0].name).toBe('Overwritten Env')
    })

    it('缺失的 devServer 应自动创建', async () => {
      const importPayload = {
        data: {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          encrypted: false,
          devServers: [
            { name: 'Auto DS', devServerUrl: 'http://localhost:9999' },
          ],
          envs: [
            {
              apiBaseUrl: 'http://autods.example.com',
              port: 4099,
              devServerUrl: 'http://localhost:9999',
              routeRules: [],
              passwords: [],
            },
          ],
        },
        conflictStrategy: 'skip',
      }

      const res = await request(app)
        .post('/dev-manage-api/env/import')
        .send(importPayload)

      const result = expectSuccessResponse(res.body) as Record<string, unknown>
      expect(result.created.devServers).toBe(1)
      expect(result.created.envs).toBe(1)

      // 验证 DevServer 已创建
      const dsListRes = await request(app).get('/dev-manage-api/server/list')
      expect(dsListRes.body.data.list).toHaveLength(1)
      expect(dsListRes.body.data.list[0].devServerUrl).toBe('http://localhost:9999')
    })

    it('加密数据 + 正确密码应成功导入', async () => {
      // 先导出加密数据
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://enc-import.example.com', port: 7001 }))

      const envListRes = await request(app).get('/dev-manage-api/env/getlist')
      const env = envListRes.body.data?.list?.[0]

      await request(app)
        .post('/dev-manage-api/password/add')
        .send({ envId: env.id, name: 'Secret', username: 'u', password: 'my-password' })

      const exportRes = await request(app)
        .post('/dev-manage-api/env/export')
        .send({ envIds: [env.id], encryptPassword: 'key123' })

      const encryptedData = expectSuccessResponse(exportRes.body) as ExportData

      // 现在导入到空数据库（需重新创建 app 来清空数据）
      const app2 = createTestApp()
      const importRes = await request(app2)
        .post('/dev-manage-api/env/import')
        .send({ data: encryptedData, conflictStrategy: 'skip', decryptPassword: 'key123' })

      const result = expectSuccessResponse(importRes.body) as Record<string, unknown>
      expect(result.created.envs).toBe(1)

      // 验证密码已正确解密
      const export2Res = await request(app2)
        .post('/dev-manage-api/env/export')
        .send({})
      const exportedData2 = expectSuccessResponse(export2Res.body) as ExportData
      expect(exportedData2.encrypted).toBe(false)
      expect(exportedData2.envs[0].passwords[0].password).toBe('my-password')
    })

    it('加密数据 + 错误密码应返回错误', async () => {
      // 创建加密导出数据
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://wrongpass.example.com', port: 8001 }))

      const envListRes = await request(app).get('/dev-manage-api/env/getlist')
      const env = envListRes.body.data?.list?.[0]

      await request(app)
        .post('/dev-manage-api/password/add')
        .send({ envId: env.id, name: 'P', username: 'u', password: 'secret' })

      const exportRes = await request(app)
        .post('/dev-manage-api/env/export')
        .send({ envIds: [env.id], encryptPassword: 'correct-key' })

      const encryptedData = expectSuccessResponse(exportRes.body) as ExportData

      // 用错误密码导入
      const app2 = createTestApp()
      const res = await request(app2)
        .post('/dev-manage-api/env/import')
        .send({ data: encryptedData, conflictStrategy: 'skip', decryptPassword: 'wrong-key' })

      expectErrorResponse(res.body, 400)
    })
  })

  // ==================== Round-trip ====================

  describe('round-trip（导出后导入）', () => {
    it('导出的数据导入到空数据库应完全还原', async () => {
      // Step 1: 创建完整的数据集
      await request(app)
        .post('/dev-manage-api/server/add')
        .send(createDevServerCreateFixture({ devServerUrl: 'http://localhost:5173', name: 'Vite' }))

      const dsListRes = await request(app).get('/dev-manage-api/server/list')
      const ds = dsListRes.body.data?.list?.[0]

      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://rt.example.com', port: 9001, devServerId: ds.id }))

      const envListRes = await request(app).get('/dev-manage-api/env/getlist')
      const env = envListRes.body.data?.list?.[0]

      // 创建第二个环境作为 routeRule 的 targetEnvId
      await request(app)
        .post('/dev-manage-api/env/add')
        .send(createEnvCreateFixture({ apiBaseUrl: 'http://rt-target.example.com', port: 9002 }))
      const envListRes2 = await request(app).get('/dev-manage-api/env/getlist')
      const targetEnv = envListRes2.body.data?.list?.[1]

      const ruleAddRes = await request(app)
        .post('/dev-manage-api/route-rule/add')
        .send({ envId: env.id, pathPrefix: '/api/v1', description: 'V1 API', targetEnvId: targetEnv.id })
      expect(ruleAddRes.status).toBe(200)

      await request(app)
        .post('/dev-manage-api/password/add')
        .send({ envId: env.id, name: 'Cred', username: 'user', password: 'pass' })

      // Step 2: 导出（只导出第一个环境）
      const exportRes = await request(app)
        .post('/dev-manage-api/env/export')
        .send({ envIds: [env.id] })

      const exportData = expectSuccessResponse(exportRes.body) as ExportData
      expect(exportData.envs).toHaveLength(1)

      // Step 3: 在空数据库中导入
      const app2 = createTestApp()
      const importRes = await request(app2)
        .post('/dev-manage-api/env/import')
        .send({ data: exportData, conflictStrategy: 'skip' })

      const result = expectSuccessResponse(importRes.body) as Record<string, unknown>
      expect(result.created.envs).toBe(1)

      // Step 4: 验证导入的数据
      const restoredEnvListRes = await request(app2).get('/dev-manage-api/env/getlist')
      const restoredEnv = restoredEnvListRes.body.data?.list?.[0]
      expect(restoredEnv.apiBaseUrl).toBe('http://rt.example.com')
      expect(restoredEnv.port).toBe(9001)

      const restoredDsListRes = await request(app2).get('/dev-manage-api/server/list')
      expect(restoredDsListRes.body.data.list).toHaveLength(1)
      expect(restoredDsListRes.body.data.list[0].devServerUrl).toBe('http://localhost:5173')

      const rulesRes = await request(app2).get(`/dev-manage-api/route-rule/list/${restoredEnv.id}`)
      expect(rulesRes.body.data.list).toHaveLength(1)
      expect(rulesRes.body.data.list[0].pathPrefix).toBe('/api/v1')

      const pwdsRes = await request(app2).get(`/dev-manage-api/password/list/${restoredEnv.id}`)
      expect(pwdsRes.body.data.list).toHaveLength(1)
      expect(pwdsRes.body.data.list[0].password).toBe('pass')
    })
  })
})
