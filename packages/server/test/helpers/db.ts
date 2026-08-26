import loki from 'lokijs'

// 模块级可变引用，配合 vi.mock 提升机制实现数据库隔离
let currentDb: loki | null = null

/**
 * 创建一个全新的内存数据库实例（LokiMemoryAdapter），
 * 并初始化四个集合（与 database.ts 保持一致）。
 */
export function createMemoryDb(): loki {
  const db = new loki('test.db', {
    adapter: new loki.LokiMemoryAdapter(),
  })

  if (!db.getCollection('envms')) {
    db.addCollection('envms', {
      indices: ['apiBaseUrl', 'id'],
      unique: ['apiBaseUrl'],
    })
  }
  if (!db.getCollection('devServer')) {
    db.addCollection('devServer', {
      indices: ['id', 'devServerUrl'],
      unique: ['devServerUrl'],
    })
  }
  if (!db.getCollection('routeRules')) {
    db.addCollection('routeRules', {
      indices: ['id', 'envId', 'pathPrefix'],
    })
  }
  if (!db.getCollection('passwords')) {
    db.addCollection('passwords', {
      indices: ['id', 'envId', 'isDefault'],
    })
  }
  if (!db.getCollection('settings')) {
    db.addCollection('settings', {
      indices: ['id'],
      unique: ['id'],
    })
  }

  return db
}

/**
 * 设置当前活跃的数据库实例。
 * 在 beforeEach 中调用以创建全新隔离环境。
 */
export function setCurrentDb(db: loki): void {
  currentDb = db
}

/**
 * 获取当前活跃的数据库实例。
 * 供 vi.mock 中的 getDatabase() 调用。
 */
export function getCurrentDb(): loki {
  if (!currentDb) {
    throw new Error(
      'Database not initialized. Call setCurrentDb(createMemoryDb()) in beforeEach.'
    )
  }
  return currentDb
}
