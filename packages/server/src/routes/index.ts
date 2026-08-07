// routes/index.ts
import express, { Router } from "express";
import * as libCookie from "cookie";
import { z } from "zod";
import { Container } from "../Container.js";
import { EnvController } from "../controllers/EnvController.js";
import { DevServerController } from "../controllers/DevServerController.js";
import { RouteRuleController } from "../controllers/RouteRuleController.js";
import { PasswordController } from "../controllers/PasswordController.js";
import { RequestLogController } from "../controllers/RequestLogController.js";
import { ImportExportController } from "../controllers/ImportExportController.js";
import { getConfig } from "../utils/ResolveConfig.js";
import { toDTO } from "../middleware/dto.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { registerRoutes, RouteDefinition } from "../utils/routeBuilder.js";
import {
  EnvPrimarySchema,
  EnvCreateSchema,
  EnvUpdateSchema,
  EnvSortSchema,
  EnvSwitchSchema,
  DevServerCreateSchema,
  DevServerDeleteSchema,
  DevServerUpdateSchema,
  DevServerSortSchema,
  RouteRuleCreateSchema,
  RouteRuleDeleteSchema,
  RouteRuleUpdateSchema,
  PasswordCreateSchema,
  PasswordDeleteSchema,
  PasswordUpdateSchema,
  ExportRequestSchema,
  ImportRequestSchema,
} from "../types/index.js";

// 辅助函数：绑定 Controller 方法，确保 this 指向正确
const bind = <T extends object, K extends keyof T>(obj: T, method: K) =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  (obj[method] as Function).bind(obj) as T[K];

// 1. 创建各模块路由（声明式 RouteDefinition 配置）
const createEnvRoutes = (controller: EnvController, importExportController: ImportExportController) => {
  const router = Router();
  const routes: RouteDefinition[] = [
    {
      method: "get",
      path: "/getlist",
      handler: bind(controller, "handleGetList") as RouteDefinition["handler"],
    },
    {
      method: "post",
      path: "/add",
      middleware: [toDTO(EnvCreateSchema)],
      handler: bind(controller, "handleAddEnv") as RouteDefinition["handler"],
    },
    {
      method: "post",
      path: "/delete",
      middleware: [toDTO(EnvPrimarySchema)],
      handler: asyncHandler(
        bind(controller, "handleDeleteEnv"),
      ) as RouteDefinition["handler"],
    },
    {
      method: "post",
      path: "/update",
      middleware: [toDTO(EnvUpdateSchema)],
      handler: bind(controller, "handleUpdateEnv") as RouteDefinition["handler"],
    },
    {
      method: "post",
      path: "/start",
      middleware: [toDTO(EnvPrimarySchema)],
      handler: asyncHandler(
        bind(controller, "handleStartServer"),
      ) as RouteDefinition["handler"],
    },
    {
      method: "post",
      path: "/stop",
      middleware: [toDTO(EnvPrimarySchema)],
      handler: asyncHandler(
        bind(controller, "handleStopServer"),
      ) as RouteDefinition["handler"],
    },
    {
      method: "post",
      path: "/switch",
      middleware: [toDTO(EnvSwitchSchema)],
      handler: asyncHandler(
        bind(controller, "handleSwitchEnv"),
      ) as RouteDefinition["handler"],
    },
    {
      method: "post",
      path: "/proxy/switch",
      middleware: [toDTO(z.object({ envId: z.string(), devServerId: z.string() }))],
      handler: bind(
        controller,
        "handleSwitchProxy",
      ) as RouteDefinition["handler"],
    },
    {
      method: "put",
      path: "/sort",
      middleware: [toDTO(EnvSortSchema)],
      handler: bind(
        controller,
        "handleUpdateSortOrder",
      ) as RouteDefinition["handler"],
    },
    {
      method: "post",
      path: "/export",
      middleware: [toDTO(ExportRequestSchema)],
      handler: bind(importExportController, "handleExport") as RouteDefinition["handler"],
    },
    {
      method: "post",
      path: "/import",
      middleware: [toDTO(ImportRequestSchema)],
      handler: bind(importExportController, "handleImport") as RouteDefinition["handler"],
    },
  ];
  return registerRoutes(router, routes);
};

const createDevServerRoutes = (controller: DevServerController) => {
  const router = Router();
  const routes: RouteDefinition[] = [
    {
      method: "get",
      path: "/list",
      handler: bind(
        controller,
        "handleGetDevServerList",
      ) as RouteDefinition["handler"],
    },
    {
      method: "post",
      path: "/add",
      middleware: [toDTO(DevServerCreateSchema)],
      handler: bind(
        controller,
        "handleCreateDevServer",
      ) as RouteDefinition["handler"],
    },
    {
      method: "put",
      path: "/update",
      middleware: [toDTO(DevServerUpdateSchema)],
      handler: bind(
        controller,
        "handleUpdateDevServer",
      ) as RouteDefinition["handler"],
    },
    {
      method: "put",
      path: "/sort",
      middleware: [toDTO(DevServerSortSchema)],
      handler: bind(
        controller,
        "handleUpdateSortOrder",
      ) as RouteDefinition["handler"],
    },
    {
      method: "delete",
      path: "/",
      middleware: [toDTO(DevServerDeleteSchema)],
      handler: bind(
        controller,
        "handleDeleteDevServer",
      ) as RouteDefinition["handler"],
    },
  ];
  return registerRoutes(router, routes);
};

const createRouteRuleRoutes = (controller: RouteRuleController) => {
  const router = Router();
  const routes: RouteDefinition[] = [
    {
      method: "get",
      path: "/list/:envId",
      handler: bind(controller, "handleGetList") as RouteDefinition["handler"],
    },
    {
      method: "post",
      path: "/add",
      middleware: [toDTO(RouteRuleCreateSchema)],
      handler: bind(controller, "handleAdd") as RouteDefinition["handler"],
    },
    {
      method: "post",
      path: "/update",
      middleware: [toDTO(RouteRuleUpdateSchema)],
      handler: bind(controller, "handleUpdate") as RouteDefinition["handler"],
    },
    {
      method: "post",
      path: "/delete",
      middleware: [toDTO(RouteRuleDeleteSchema)],
      handler: bind(controller, "handleDelete") as RouteDefinition["handler"],
    },
  ];
  return registerRoutes(router, routes);
};

const createPasswordRoutes = (controller: PasswordController) => {
  const router = Router();
  const routes: RouteDefinition[] = [
    {
      method: "get",
      path: "/list/:envId",
      handler: bind(controller, "handleGetList") as RouteDefinition["handler"],
    },
    {
      method: "post",
      path: "/add",
      middleware: [toDTO(PasswordCreateSchema)],
      handler: bind(controller, "handleAdd") as RouteDefinition["handler"],
    },
    {
      method: "post",
      path: "/update",
      middleware: [toDTO(PasswordUpdateSchema)],
      handler: bind(controller, "handleUpdate") as RouteDefinition["handler"],
    },
    {
      method: "post",
      path: "/delete",
      middleware: [toDTO(PasswordDeleteSchema)],
      handler: bind(controller, "handleDelete") as RouteDefinition["handler"],
    },
  ];
  return registerRoutes(router, routes);
};

const createRequestLogRoutes = (controller: RequestLogController) => {
  const router = Router();
  const routes: RouteDefinition[] = [
    {
      method: "get",
      path: "/list",
      handler: bind(controller, "handleGetLogs") as RouteDefinition["handler"],
    },
  ];
  return registerRoutes(router, routes);
};

const createCommonRoutes = () => {
  const router = Router();
  router.get("/are-you-ok", (req, res) => res.success({}, "I'm ok!"));
  router.get("/clear-proxy-cookie", (req, res) => {
    const cookies = req.headers.cookie;
    if (cookies) {
      const cookieArr = libCookie.parse(cookies);
      Object.keys(cookieArr).forEach((cookieName) => {
        if (cookieName.endsWith(getConfig().cookieSuffix)) {
          res.setHeader("Set-Cookie", `${cookieName}=; max-age=0; path=/`);
        }
      });
    }
    res.success();
  });
  return router;
};

// 2. 整合所有路由并导出
export const createRouter = (): Router => {
  const rootRouter = Router();

  // 全局中间件（原 ManageRouter 中的通用中间件）
  rootRouter.use(express.json());

  // 依赖注入
  const container = Container.getInstance();
  const envController = container.get<EnvController>("envController");
  const devServerController = container.get<DevServerController>(
    "devServerController",
  );
  const routeRuleController = container.get<RouteRuleController>(
    "routeRuleController",
  );
  const passwordController = container.get<PasswordController>(
    "passwordController",
  );
  const requestLogController = container.get<RequestLogController>(
    "requestLogController",
  );
  const importExportController = container.get<ImportExportController>(
    "importExportController",
  );

  // 挂载模块路由
  rootRouter.use("/env", createEnvRoutes(envController, importExportController));
  rootRouter.use("/server", createDevServerRoutes(devServerController));
  rootRouter.use("/route-rule", createRouteRuleRoutes(routeRuleController));
  rootRouter.use("/password", createPasswordRoutes(passwordController));
  rootRouter.use("/request-log", createRequestLogRoutes(requestLogController));
  rootRouter.use("/", createCommonRoutes());

  return rootRouter;
};
