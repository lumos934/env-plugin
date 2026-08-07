import { NextFunction, Request, Response } from "express";
import { ImportExportService } from "../service/ImportExportService.js";
import { ExportRequest, ImportRequest } from "../types/index.js";
import { envLogger } from "../utils/logger.js";

/**
 * 导入/导出控制器
 * 负责处理环境配置导入和导出的 HTTP 请求
 */
class ImportExportController {
  constructor(private readonly service: ImportExportService) {}

  /**
   * 导出环境配置
   * POST /dev-manage-api/env/export
   */
  handleExport(req: Request, res: Response, next: NextFunction): void {
    try {
      const request = req.dto as ExportRequest;
      envLogger.info({ envIds: request.envIds }, "接收环境导出请求");
      const data = this.service.exportEnvs(request);
      res.success(data, "导出成功");
    } catch (error) {
      envLogger.error(error, "环境导出失败");
      next(error);
    }
  }

  /**
   * 导入环境配置
   * POST /dev-manage-api/env/import
   */
  handleImport(req: Request, res: Response, next: NextFunction): void {
    try {
      const request = req.dto as ImportRequest;
      envLogger.info("接收环境导入请求");
      const result = this.service.importEnvs(request);
      res.success(result, "导入完成");
    } catch (error) {
      envLogger.error(error, "环境导入失败");
      next(error);
    }
  }
}

export { ImportExportController };
