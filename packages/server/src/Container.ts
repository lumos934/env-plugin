import { EnvController } from "./controllers/EnvController.js";
import { DevServerController } from "./controllers/DevServerController.js";
import { RouteRuleController } from "./controllers/RouteRuleController.js";
import { PasswordController } from "./controllers/PasswordController.js";
import { EnvRepo } from "./repositories/EnvRepo.js";
import { EnvService } from "./service/EnvService.js";
import { DevServerService } from "./service/DevServerService.js";
import { DevServerRepo } from "./repositories/DevServerRepo.js";
import { RouteRuleRepo } from "./repositories/RouteRuleRepo.js";
import { RouteRuleService } from "./service/RouteRuleService.js";
import { PasswordRepo } from "./repositories/PasswordRepo.js";
import { PasswordService } from "./service/PasswordService.js";
import { RequestLogService } from "./service/RequestLogService.js";
import { RequestLogController } from "./controllers/RequestLogController.js";
import { ImportExportService } from "./service/ImportExportService.js";
import { ImportExportController } from "./controllers/ImportExportController.js";
import { SystemSettingRepo } from "./repositories/SystemSettingRepo.js";
import { SystemSettingService } from "./service/SystemSettingService.js";
import { SystemSettingController } from "./controllers/SystemSettingController.js";
import { ProxyAutoStarter } from "./service/ProxyAutoStarterService.js";

class Container {
  private static instance: Container;
  private dependencies: Map<string, unknown> = new Map();

  private constructor() {
    // 环境和服务的注册
    const envRepo = new EnvRepo();
    const devServerRepo = new DevServerRepo();
    const routeRuleRepo = new RouteRuleRepo();
    const passwordRepo = new PasswordRepo();
    // configIns.initConfig();
    this.register("envService", new EnvService(envRepo, devServerRepo, routeRuleRepo));
    this.register("envController", new EnvController(this.get("envService")));
    // 开发服务器服务和控制器的注册
    this.register(
      "devServerService",
      new DevServerService(devServerRepo, envRepo)
    );
    this.register(
      "devServerController",
      new DevServerController(this.get("devServerService"))
    );
    // 路由规则服务和控制器的注册
    this.register(
      "routeRuleService",
      new RouteRuleService(routeRuleRepo, envRepo)
    );
    this.register(
      "routeRuleController",
      new RouteRuleController(this.get("routeRuleService"))
    );
    // 密码服务和控制器的注册
    this.register(
      "passwordService",
      new PasswordService(passwordRepo)
    );
    this.register(
      "passwordController",
      new PasswordController(this.get("passwordService"))
    );
    // 请求日志服务和控制器
    const requestLogService = new RequestLogService();
    this.register("requestLogService", requestLogService);
    this.register(
      "requestLogController",
      new RequestLogController(requestLogService)
    );
    // 导入导出服务和控制器
    this.register(
      "importExportService",
      new ImportExportService(envRepo, devServerRepo, routeRuleRepo, passwordRepo),
    );
    this.register(
      "importExportController",
      new ImportExportController(this.get("importExportService")),
    );
    // 系统设置服务和控制器
    const systemSettingService = new SystemSettingService(
      new SystemSettingRepo()
    );
    this.register("systemSettingService", systemSettingService);
    this.register(
      "systemSettingController",
      new SystemSettingController(systemSettingService),
    );
    setTimeout(() => {
      new ProxyAutoStarter(envRepo, this.get("envService"), routeRuleRepo);
    }, 5000);
  }

  static getInstance(): Container {
    if (!this.instance) {
      this.instance = new Container();
    }
    return this.instance;
  }

  register<T>(key: string, value: T): this {
    this.dependencies.set(key, value);
    return this;
  }

  get<T>(key: string): T {
    if (!this.dependencies.has(key)) {
      throw new Error(`Dependency ${key} not found`);
    }
    return this.dependencies.get(key) as T;
  }
}

export { Container };
