// 全局测试 setup 文件
// 1. Mock logger 模块（避免 execSync("chcp 65001") 副作用和其他模块级副作用）
import { vi } from 'vitest'

const noop = () => {}
const mockLoggerInstance = {
  info: noop,
  error: noop,
  warn: noop,
  debug: noop,
  trace: noop,
  fatal: noop,
  level: 'silent',
  child: () => mockLoggerInstance,
}

vi.mock('../src/utils/logger.js', () => ({
  logger: mockLoggerInstance,
  envLogger: mockLoggerInstance,
  devServerLogger: mockLoggerInstance,
  proxyLogger: mockLoggerInstance,
  initLoggers: vi.fn(),
  getRootLogger: () => mockLoggerInstance,
  createRootLogger: () => mockLoggerInstance,
}))
