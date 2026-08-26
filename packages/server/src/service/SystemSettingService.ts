import { SystemSettingRepo } from "../repositories/SystemSettingRepo.js";

/**
 * 模块级内存缓存：系统设置开关的单一事实来源。
 *
 * - 注入资源开关默认关闭（false）
 * - 请求日志记录开关默认暂停（false）
 *
 * 这些函数必须纯内存同步、不访问 getDatabase()，否则会破坏
 * PreProxyServer 集成测试（该测试未初始化数据库）。
 */
let injectEnabled = false;
let logEnabled = false;

/**
 * 获取注入资源开关状态（纯内存、同步，供 PreProxyServer 直接使用）
 * @returns 是否开启注入资源
 */
export function getInjectEnabled(): boolean {
  return injectEnabled;
}

/**
 * 获取请求日志记录开关状态（纯内存、同步，供 RequestLogService 直接使用）
 * @returns 是否开启请求日志记录
 */
export function getLogEnabled(): boolean {
  return logEnabled;
}

/**
 * 系统设置服务
 * 负责系统设置的读取与更新，通过 Repository 实现持久化
 */
class SystemSettingService {
  constructor(private repo: SystemSettingRepo = new SystemSettingRepo()) {}

  /**
   * 获取注入资源开关状态
   * @returns 是否开启注入资源
   */
  getInjectEnabled(): boolean {
    return injectEnabled;
  }

  /**
   * 获取请求日志记录开关状态
   * @returns 是否开启请求日志记录
   */
  getLogEnabled(): boolean {
    return logEnabled;
  }

  /**
   * 更新注入资源开关状态
   * @param value - 是否开启注入资源
   */
  setInjectEnabled(value: boolean): void {
    injectEnabled = value;
    this.persist();
  }

  /**
   * 更新请求日志记录开关状态
   * @param value - 是否开启请求日志记录
   */
  setLogEnabled(value: boolean): void {
    logEnabled = value;
    this.persist();
  }

  /**
   * 初始化：从数据库读取持久化值同步到内存缓存。
   * 数据库就绪后调用（在 index.ts 的 startDatabase 之后）。
   * 空库时 seed 默认记录（注入关闭、日志暂停）。
   */
  init(): void {
    const existing = this.repo.getGlobal();
    if (existing) {
      injectEnabled = existing.injectEnabled;
      // 兼容旧数据：早期版本可能没有 logEnabled 字段
      logEnabled = existing.logEnabled ?? false;
    } else {
      injectEnabled = false;
      logEnabled = false;
      this.persist();
    }
  }

  /**
   * 将当前内存状态持久化到数据库（全量写入）
   */
  private persist(): void {
    this.repo.upsert({ id: "global", injectEnabled, logEnabled });
  }
}

export { SystemSettingService };
