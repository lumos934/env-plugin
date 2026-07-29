import { Router, RequestHandler } from "express";

/** Express Router 方法的通用签名 */
type RouterMethod = (path: string, ...handlers: RequestHandler[]) => void;

/**
 * 单条路由注册的定义。
 */
export interface RouteDefinition {
  /** HTTP 方法 */
  method: "get" | "post" | "put" | "delete";
  /** 路由路径（如 "/add"、"/list/:envId"） */
  path: string;
  /** 路由处理器（已绑定 this 的 Controller 方法） */
  handler: RequestHandler;
  /** 可选的中间件链（如 [toDTO(SomeSchema)]） */
  middleware?: RequestHandler[];
}

/**
 * 将 RouteDefinition 数组批量注册到 Router 上。
 * 返回 Router 本身以支持链式调用。
 *
 * @example
 *   const router = Router();
 *   registerRoutes(router, [
 *     { method: "get",  path: "/list", handler: ctrl.getList },
 *     { method: "post", path: "/add",  middleware: [toDTO(Schema)], handler: ctrl.add },
 *   ]);
 *   return router;
 */
export function registerRoutes(
  router: Router,
  definitions: RouteDefinition[],
): Router {
  for (const { method, path, handler, middleware } of definitions) {
    const handlers = middleware ? [...middleware, handler] : [handler];
    (router as unknown as Record<string, RouterMethod>)[method](path, ...handlers);
  }
  return router;
}
