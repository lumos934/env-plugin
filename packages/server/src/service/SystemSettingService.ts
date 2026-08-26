import { SystemSettingRepo } from "../repositories/SystemSettingRepo.js";

/**
 * 模块级内存缓存：注入资源开关的单一事实来源。
 *
 * 默认 true（开启注入），供 PreProxyServer 在代理热路径中零开销读取。
 * 注意：此函数必须纯内存同步、不访问 getDatabase()，否则会破坏
 * PreProxyServer 集成测试（该测试未初始化数据库）。
 */
let injectEnabled = true;

/**
 * 获取注入资源开关状态（纯内存、同步，供 PreProxyServer 直接使用）
 * @returns 是否开启注入资源
 */
export function getInjectEnabled(): boolean {
  return injectEnabled;
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
   * 更新注入资源开关状态
   * @param value - 是否开启注入资源
   */
  setInjectEnabled(value: boolean): void {
    injectEnabled = value;
    this.repo.upsert({ id: "global", injectEnabled: value });
  }

  /**
   * 初始化：从数据库读取持久化值同步到内存缓存。
   * 数据库就绪后调用（在 index.ts 的 startDatabase 之后）。
   * 空库时 seed 默认记录（injectEnabled = true）。
   */
  init(): void {
    const existing = this.repo.getGlobal();
    if (existing) {
      injectEnabled = existing.injectEnabled;
    } else {
      this.repo.upsert({ id: "global", injectEnabled: true });
      injectEnabled = true;
    }
  }
}

export { SystemSettingService };
