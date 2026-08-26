import portfinder from "portfinder";
import http from "http";
import PostProxyServer from "./PostProxyServer.js";
import { getConfig, loadConfig } from "./utils/ResolveConfig.js";
import { EnvmConfigInterface } from "./types/index.js";
import { startDatabase } from "./repositories/database.js";
import { initLoggers, logger } from "./utils/logger.js";
import { Container } from "./Container.js";
import { SystemSettingService } from "./service/SystemSettingService.js";

class EnvManage {
  get config() {
    return getConfig();
  }

  constructor(options: Partial<EnvmConfigInterface> = {}) {
    try {
      loadConfig(options);
      initLoggers(this.config.logLevel);
    } catch (error) {
      if (error instanceof Error) {
        console.error("❌ 配置加载失败，服务启动失败，", error.message);
      }
      process.exit(1);
    }
  }

  async startIndependent() {
    logger.info(this.config, "Starting EnvManage...");

    // 检查端口是否被占用
    try {
      await this.checkPortAsync();

      logger.info(`端口 ${this.config.port} 可用，启动服务...`);

      await startDatabase();
      // 数据库就绪后，同步注入资源开关的持久化值到内存缓存
      Container.getInstance()
        .get<SystemSettingService>("systemSettingService")
        .init();
      new PostProxyServer();
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error, "启动失败");
      }
      process.exit(1);
    }
  }

  /**
   * 判断端口是否被占用，如果被占用的，查询是否已经启动
   * @returns
   */
  async checkPortAsync() {
    const result = await this.isPortOccupied(this.config.port);
    if (result) {
      try {
        await this.checkIsRunning();
      } catch (error) {
        logger.error(error, "端口被占用，且不是 envm 服务");
      }
      throw new Error(
        `envm 服务已经在端口 ${this.config.port} 启动，请勿重复启动！`
      );
    }
  }

  /**
   *
   * @param port 查询端口是否被占用
   * @returns
   */
  isPortOccupied(port: number) {
    return portfinder
      .getPortPromise({
        port: port,
        stopPort: port,
      })
      .then(() => {
        return false;
      })
      .catch(() => {
        return true;
      });
  }
  /**
   * 查询端口，中启动的服务是否为 envm
   * @returns
   */
  checkIsRunning() {
    const options = {
      hostname: "127.0.0.1",
      port: this.config.port,
      path: `${this.config.apiPrefix}/are-you-ok`,
      method: "GET",
    };

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        const statusCode = res.statusCode || 0;
        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`请求失败，状态码: ${res.statusCode}`));
          return;
        }
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          const result = JSON.parse(responseData);
          logger.info(result, "收到已启动的代理服务返回的消息");
          resolve(result);
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.end();
    });
  }
}

export { EnvManage };
