import type { EnvmConfigInterface } from '../../src/types/index.js'

const defaultTestConfig: EnvmConfigInterface = {
  port: 3099,
  apiPrefix: '/dev-manage-api',
  cookieSuffix: 'envm',
  logLevel: 'silent',
  injectScriptDir: '.envm',
}

let testConfig = { ...defaultTestConfig }

/**
 * 设置测试用配置（每个测试可以通过 overrides 自定义）
 */
export function setTestConfig(overrides?: Partial<EnvmConfigInterface>): void {
  testConfig = { ...defaultTestConfig, ...overrides }
}

/**
 * 获取当前测试配置
 */
export function getTestConfig(): EnvmConfigInterface {
  return testConfig
}

/**
 * 重置测试配置为默认值
 */
export function resetTestConfig(): void {
  testConfig = { ...defaultTestConfig }
}
