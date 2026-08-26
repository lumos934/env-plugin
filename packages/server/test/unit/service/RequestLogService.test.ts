import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  requestLogEmitter,
  RequestLogService,
} from '../../../src/service/RequestLogService.js'
import type { RequestLogEntry } from '../../../src/types/shared/RequestLog.js'

// 可控的请求日志记录开关（避免触碰真实数据库）
const { logEnabledMock } = vi.hoisted(() => ({
  logEnabledMock: { value: false },
}))

vi.mock('../../../src/service/SystemSettingService.js', () => ({
  getLogEnabled: () => logEnabledMock.value,
  getInjectEnabled: () => true,
  SystemSettingService: class {},
}))

function makeEntry(overrides: Partial<RequestLogEntry> = {}): RequestLogEntry {
  return {
    id: 'log-1',
    timestamp: Date.now(),
    method: 'GET',
    url: '/api/test',
    statusCode: 200,
    duration: 10,
    matchedRule: 'default',
    resourceType: 'fetch',
    envId: 'env-1',
    envName: 'Test Env',
    ...overrides,
  }
}

describe('RequestLogService', () => {
  let service: RequestLogService

  beforeEach(() => {
    logEnabledMock.value = false
    // 清除上一个测试实例遗留的 log 监听，避免监听器累积
    requestLogEmitter.removeAllListeners('log')
    service = new RequestLogService()
  })

  describe('记录开关', () => {
    it('默认（logEnabled=false）不应记录日志', () => {
      requestLogEmitter.emit('log', makeEntry())

      expect(service.getAllLogs()).toHaveLength(0)
    })

    it('logEnabled=true 时应记录日志', () => {
      logEnabledMock.value = true
      requestLogEmitter.emit('log', makeEntry())

      expect(service.getAllLogs()).toHaveLength(1)
    })

    it('关闭开关后，新日志不再记录', () => {
      logEnabledMock.value = true
      requestLogEmitter.emit('log', makeEntry({ id: 'log-1' }))
      expect(service.getAllLogs()).toHaveLength(1)

      logEnabledMock.value = false
      requestLogEmitter.emit('log', makeEntry({ id: 'log-2' }))
      expect(service.getAllLogs()).toHaveLength(1)
    })
  })
})
