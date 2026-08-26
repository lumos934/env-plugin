import { NextFunction, Request, Response } from "express";
import { SystemSettingService } from "../service/SystemSettingService.js";
import { SystemSettingUpdate } from "../types/index.js";

/**
 * 系统设置控制器
 * 提供系统设置的查询与更新接口
 */
class SystemSettingController {
  constructor(private readonly service: SystemSettingService) {}

  /**
   * 获取系统设置
   * GET /dev-manage-api/system-setting
   */
  handleGet(req: Request, res: Response, next: NextFunction): void {
    try {
      res.success({
        injectEnabled: this.service.getInjectEnabled(),
        logEnabled: this.service.getLogEnabled(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新系统设置
   * POST /dev-manage-api/system-setting
   */
  handleUpdate(req: Request, res: Response, next: NextFunction): void {
    try {
      const { injectEnabled, logEnabled } = req.dto as SystemSettingUpdate;
      this.service.setInjectEnabled(injectEnabled);
      this.service.setLogEnabled(logEnabled);
      res.success({
        injectEnabled: this.service.getInjectEnabled(),
        logEnabled: this.service.getLogEnabled(),
      });
    } catch (error) {
      next(error);
    }
  }
}

export { SystemSettingController };
