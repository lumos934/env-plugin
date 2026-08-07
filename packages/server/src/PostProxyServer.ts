import { Server } from "http";
import { join } from "path";
import { WebSocketServer, WebSocket } from "ws";
import express, { Express, Request } from "express";
import expressStaticGzip from "express-static-gzip";
import { createProxyMiddleware } from "http-proxy-middleware";
import { getConfig } from "./utils/ResolveConfig.js";
import { createRouter } from "./routes/index.js";
import { globalErrorHandler } from "./middleware/globalErrorHandler.js";
import { responseEnhancer } from "./middleware/responseEnhancer.js";

const currentModuleUrl = import.meta.url;

// 转换为文件系统路径
import { fileURLToPath } from "url";
const __filename = fileURLToPath(currentModuleUrl); // 当前文件的完整路径

// 获取目录路径
import { dirname } from "path";
const __dirname = dirname(__filename); // 当前文件所在的目录路径

import { Container } from "./Container.js";
import type { RequestLogService } from "./service/RequestLogService.js";
import { envLogger, proxyLogger } from "./utils/logger.js";
/**
 * 后置代理服务器---同时也是管理页面的服务器
 */
class PostProxyServer {
  private wss!: WebSocketServer;

  get config() {
    return getConfig();
  }

  constructor(private app: Express = express()) {
    // 代理中间件
    app.use(this.createPostProxyMiddleware());

    // 静态资源
    app.use(expressStaticGzip(join(__dirname, "client"), {}));
    // 注入资源
    // 优先从用户自定义目录加载（如 .envm/），找不到时回退到内置 templates/inject/
    app.use(
      "/envm-inject",
      express.static(join(process.cwd(), this.config.injectScriptDir || ""))
    );
    app.use(
      "/envm-inject",
      express.static(join(__dirname, "..", "templates", "inject"))
    );
    // 统一处理响应
    app.use(responseEnhancer);

    // 初始化管理路由
    app.use(this.config.apiPrefix, createRouter());

    // 全局错误处理中间件
    app.use(globalErrorHandler);

    // 启动服务器
    const server = this.startServer();

    this.registerWs(server);
  }

  /**
   * 启动服务
   */
  private startServer() {
    return this.app.listen(this.config.port, () => {
      envLogger.info(
        `Post Proxy Middleware is running on http://localhost:${this.config.port}`
      );
    });
  }

  /**
   * 注册 WebSocket 服务用于通知客户端更新和推送请求日志
   * @param server
   */
  private registerWs(server: Server) {
    this.wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      if (request?.url?.startsWith(this.config.apiPrefix)) {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit("connection", ws, request);
        });
      }
    });

    this.wss.on("connection", (ws: WebSocket) => {
      proxyLogger.info("WebSocket 客户端已连接");

      // 获取日志服务（Container 已由 createRouter() 初始化）
      const container = Container.getInstance();
      const logService = container.get<RequestLogService>("requestLogService");

      // 连接时发送全量历史日志
      const history = logService.getAllLogs();
      ws.send(
        JSON.stringify({ action: "requestlog_history", data: history })
      );

      // 订阅增量日志推送
      const unsubscribe = logService.subscribe((entry) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: "requestlog", data: entry }));
        }
      });

      ws.on("close", () => {
        unsubscribe();
        proxyLogger.info("WebSocket 客户端已断开");
      });

      ws.on("error", (err) => {
        proxyLogger.error(err, "WebSocket 连接错误");
      });
    });
  }

  /**
   * 创建后置服务器 代理转发中间件
   * @returns
   */
  private createPostProxyMiddleware() {
    // 定义路径过滤函数，排除 管理url
    const pathFilter = (path: string, req: Request) => {
      return !!req.headers["x-api-server"];
    };
    return createProxyMiddleware({
      pathFilter,
      ws: true,
      changeOrigin: true,
      router: async (req) => {
        if (req.headers["x-api-server"]) {
          const target = req.headers["x-api-server"] as string;
          return target;
        }
      },
    });
  }
}

export default PostProxyServer;
