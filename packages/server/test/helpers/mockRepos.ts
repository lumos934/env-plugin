import { vi } from 'vitest'
import type { EnvRepo } from '../src/repositories/EnvRepo.js'
import type { DevServerRepo } from '../src/repositories/DevServerRepo.js'
import type { RouteRuleRepo } from '../src/repositories/RouteRuleRepo.js'
import type { PasswordRepo } from '../src/repositories/PasswordRepo.js'

/**
 * 创建 Mock EnvRepo，所有方法默认为 vi.fn()
 */
export function createMockEnvRepo(
  overrides?: Partial<Record<keyof EnvRepo, unknown>>
): EnvRepo {
  return {
    getAll: vi.fn().mockReturnValue([]),
    addEnv: vi.fn(),
    deleteEnv: vi.fn(),
    findOne: vi.fn().mockReturnValue(null),
    findOneById: vi.fn().mockReturnValue(null),
    findEnvsByDevServerId: vi.fn().mockReturnValue([]),
    findAllByStatus: vi.fn().mockReturnValue([]),
    findOneByApiBaseUrl: vi.fn().mockReturnValue(undefined),
    findOneByPortAndStatus: vi.fn().mockReturnValue(null),
    update: vi.fn(),
    ...overrides,
  } as unknown as EnvRepo
}

/**
 * 创建 Mock DevServerRepo
 */
export function createMockDevServerRepo(
  overrides?: Partial<Record<keyof DevServerRepo, unknown>>
): DevServerRepo {
  return {
    getAll: vi.fn().mockReturnValue([]),
    addDevServer: vi.fn(),
    deleteDevServer: vi.fn(),
    findOneById: vi.fn().mockReturnValue(null),
    findOneByUrl: vi.fn().mockReturnValue(null),
    update: vi.fn(),
    updateSortOrder: vi.fn(),
    ...overrides,
  } as unknown as DevServerRepo
}

/**
 * 创建 Mock RouteRuleRepo
 */
export function createMockRouteRuleRepo(
  overrides?: Partial<Record<keyof RouteRuleRepo, unknown>>
): RouteRuleRepo {
  return {
    initCollection: vi.fn(),
    getByEnvId: vi.fn().mockReturnValue([]),
    countByEnvId: vi.fn().mockReturnValue(0),
    findOneById: vi.fn().mockReturnValue(null),
    create: vi.fn(),
    delete: vi.fn(),
    deleteByEnvId: vi.fn(),
    update: vi.fn(),
    existsByEnvIdAndPathPrefix: vi.fn().mockReturnValue(false),
    ...overrides,
  } as unknown as RouteRuleRepo
}

/**
 * 创建 Mock PasswordRepo
 */
export function createMockPasswordRepo(
  overrides?: Partial<Record<keyof PasswordRepo, unknown>>
): PasswordRepo {
  return {
    initCollection: vi.fn(),
    getByEnvId: vi.fn().mockReturnValue([]),
    countByEnvId: vi.fn().mockReturnValue(0),
    findOneById: vi.fn().mockReturnValue(null),
    create: vi.fn(),
    delete: vi.fn(),
    deleteByEnvId: vi.fn(),
    update: vi.fn(),
    existsByEnvIdAndName: vi.fn().mockReturnValue(false),
    findDefaultByEnvId: vi.fn().mockReturnValue(null),
    clearDefaultByEnvId: vi.fn(),
    hasDefaultPassword: vi.fn().mockReturnValue(false),
    ...overrides,
  } as unknown as PasswordRepo
}
