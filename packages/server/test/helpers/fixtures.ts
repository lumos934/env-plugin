import { v4 as uuidv4 } from 'uuid'
import type {
  EnvModel,
  EnvCreate,
  DevServerModel,
  DevServerCreate,
  RouteRuleModel,
  RouteRuleCreate,
  PasswordModel,
  PasswordCreate,
} from '../src/types/index.js'

// ---- DevServer ----

export function createDevServerFixture(
  overrides?: Partial<DevServerModel>
): DevServerModel {
  return {
    id: uuidv4(),
    name: 'Test DevServer',
    description: 'A test dev server',
    devServerUrl: `http://localhost:${Math.floor(Math.random() * 10000) + 3000}`,
    sortOrder: 0,
    ...overrides,
  }
}

export function createDevServerCreateFixture(
  overrides?: Partial<DevServerCreate>
): DevServerCreate {
  return {
    name: 'Test DevServer',
    description: 'A test dev server',
    devServerUrl: `http://localhost:${Math.floor(Math.random() * 10000) + 3000}`,
    ...overrides,
  }
}

// ---- Env ----

let envFixtureCounter = 0

export function createEnvFixture(overrides?: Partial<EnvModel>): EnvModel {
  const counter = ++envFixtureCounter
  return {
    id: uuidv4(),
    name: `Test Env ${counter}`,
    apiBaseUrl: `http://api-${counter}.example.com`,
    port: 10000 + counter,
    devServerId: uuidv4(),
    status: 'stopped',
    sortOrder: 0,
    ...overrides,
  }
}

export function createEnvCreateFixture(
  overrides?: Partial<EnvCreate>
): EnvCreate {
  const counter = ++envFixtureCounter
  return {
    name: `Test Env ${counter}`,
    apiBaseUrl: `http://api-${counter}.example.com`,
    port: 10000 + counter,
    devServerId: uuidv4(),
    ...overrides,
  }
}

// ---- RouteRule ----

export function createRouteRuleFixture(
  overrides?: Partial<RouteRuleModel>
): RouteRuleModel {
  return {
    id: uuidv4(),
    envId: uuidv4(),
    pathPrefix: '/api/test',
    targetEnvId: uuidv4(),
    description: 'Test route rule',
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

export function createRouteRuleCreateFixture(
  overrides?: Partial<RouteRuleCreate>
): RouteRuleCreate {
  return {
    envId: uuidv4(),
    pathPrefix: '/api/test',
    targetEnvId: uuidv4(),
    description: 'Test route rule',
    enabled: true,
    ...overrides,
  }
}

// ---- Password ----

export function createPasswordFixture(
  overrides?: Partial<PasswordModel>
): PasswordModel {
  return {
    id: uuidv4(),
    envId: uuidv4(),
    name: 'Test Password',
    username: 'testuser',
    password: 'testpass',
    description: 'Test password entry',
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

export function createPasswordCreateFixture(
  overrides?: Partial<PasswordCreate>
): PasswordCreate {
  return {
    envId: uuidv4(),
    name: 'Test Password',
    username: 'testuser',
    password: 'testpass',
    description: 'Test password entry',
    isDefault: false,
    ...overrides,
  }
}
