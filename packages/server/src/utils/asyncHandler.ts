import type { Request, Response, NextFunction } from "express";

/**
 * 包装 async Express 路由处理器，使 rejected promise 自动转发到 next()。
 * 这样 Express 的 globalErrorHandler 可以统一捕获异步错误，无需在每个 Controller 方法中手动 try/catch。
 *
 * @example
 *   router.post("/start", toDTO(EnvPrimarySchema), asyncHandler(controller.handleStartServer));
 */
export const asyncHandler = <
  T extends (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<void>,
>(
  fn: T,
): ((req: Request, res: Response, next: NextFunction) => void) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
