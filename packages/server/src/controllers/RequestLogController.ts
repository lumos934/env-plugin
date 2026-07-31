import { NextFunction, Request, Response } from "express";
import { RequestLogService } from "../service/RequestLogService.js";

/**
 * 请求日志控制器
 * 提供请求日志的历史查询接口
 */
class RequestLogController {
  constructor(private readonly logService: RequestLogService) {}

  /**
   * 获取请求日志列表（支持 URL 模糊匹配和状态码精确过滤）
   * GET /dev-manage-api/request-log/list?url=&statusCode=
   */
  handleGetLogs(req: Request, res: Response, next: NextFunction): void {
    try {
      const urlFilter = req.query.url as string | undefined;
      const statusCodeRaw = req.query.statusCode as string | undefined;
      const statusCodeFilter = statusCodeRaw
        ? parseInt(statusCodeRaw, 10)
        : undefined;

      const logs = this.logService.getLogs({
        url: urlFilter,
        statusCode:
          statusCodeFilter !== undefined && !isNaN(statusCodeFilter)
            ? statusCodeFilter
            : undefined,
      });

      res.success({ list: logs, total: logs.length });
    } catch (error) {
      next(error);
    }
  }
}

export { RequestLogController };
