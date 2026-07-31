import { EventEmitter } from "events";
import type { RequestLogEntry } from "../types/shared/RequestLog.js";
import { proxyLogger } from "../utils/logger.js";

const MAX_LOG_ENTRIES = 500;

/** 模块级单例 EventEmitter — PreProxyServer 直接导入使用 */
export const requestLogEmitter = new EventEmitter();

export interface LogFilterParams {
  url?: string;
  statusCode?: number;
}

class RequestLogService {
  private logs: RequestLogEntry[] = [];
  private logSubscribers = new Set<(entry: RequestLogEntry) => void>();

  constructor() {
    // 监听 PreProxyServer 发出的日志事件
    requestLogEmitter.on("log", (entry: RequestLogEntry) => {
      this.addLog(entry);
    });
  }

  /**
   * 添加日志条目（环形缓冲区，最多保留 MAX_LOG_ENTRIES 条）
   */
  private addLog(entry: RequestLogEntry): void {
    if (this.logs.length >= MAX_LOG_ENTRIES) {
      this.logs.shift();
    }
    this.logs.push(entry);

    // 通知所有订阅者（用于 WebSocket 实时推送）
    for (const subscriber of this.logSubscribers) {
      try {
        subscriber(entry);
      } catch (err) {
        proxyLogger.error(err, "日志订阅者通知失败");
      }
    }
  }

  /**
   * 获取日志列表（支持 URL 模糊匹配和状态码精确过滤）
   */
  getLogs(filter?: LogFilterParams): RequestLogEntry[] {
    let result = [...this.logs];
    if (filter?.url) {
      const lower = filter.url.toLowerCase();
      result = result.filter((e) => e.url.toLowerCase().includes(lower));
    }
    if (filter?.statusCode !== undefined) {
      result = result.filter((e) => e.statusCode === filter.statusCode);
    }
    return result;
  }

  /**
   * 获取全部日志历史
   */
  getAllLogs(): RequestLogEntry[] {
    return [...this.logs];
  }

  /**
   * 订阅新日志条目（用于 WebSocket 客户端推送）
   * 返回取消订阅函数
   */
  subscribe(callback: (entry: RequestLogEntry) => void): () => void {
    this.logSubscribers.add(callback);
    return () => {
      this.logSubscribers.delete(callback);
    };
  }
}

export { RequestLogService };
