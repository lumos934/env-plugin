import { NextFunction, Request, Response } from "express";
import { DevServerService } from "../service/DevServerService.js";
import {
  DevServerCreate,
  DevServerUpdate,
  DevServerDelete,
  DevServerQuery,
  DevServerSort,
} from "../types/index.js";
import { devServerLogger } from "../utils/logger.js";

class DevServerController {
  constructor(private readonly devServerService: DevServerService) {}

  /**
   * 处理获取开发服务器列表
   * @param req
   * @param res
   * @param next
   * @returns
   */
  handleGetDevServerList(req: Request, res: Response, next: NextFunction) {
    try {
      const list = this.devServerService.handleGetList();
      res.success({ list });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 处理获取单个开发服务器详情
   * @param req
   * @param res
   * @param next
   * @returns
   */
  handleGetDevServerById(req: Request, res: Response, next: NextFunction) {
    try {
      // 验证请求数据
      const devServerData = req.dto as DevServerQuery;
      devServerLogger.info(devServerData, "接收环境详情查询请求");

      // 调用服务层获取数据（假设服务层有此方法）
      const detail = this.devServerService.findOneById(devServerData);

      if (!detail) {
        res.error("环境不存在");
      }

      // 返回成功响应（包含详情数据）
      res.success({
        message: "环境详情查询成功",
        data: detail,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 处理创建开发服务器
   * @param req
   * @param res
   * @param next
   * @returns
   */
  handleCreateDevServer(req: Request, res: Response, next: NextFunction) {
    try {
      // 验证请求体
      const devServerItem = req.dto as DevServerCreate;

      this.devServerService.handleAddDevServer(devServerItem);
      res.success("开发服务器创建成功");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 处理更新开发服务器
   * @param req
   * @param res
   * @param next
   * @returns
   */
  handleUpdateDevServer(req: Request, res: Response, next: NextFunction) {
    try {
      const updateData = req.dto as DevServerUpdate;

      const updatedServer =
        this.devServerService.handleUpdateDevServer(updateData);

      res.success({ message: "开发服务器更新成功", server: updatedServer });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 处理删除开发服务器
   * @param req
   * @param res
   * @param next
   * @returns
   */
  handleDeleteDevServer(req: Request, res: Response, next: NextFunction) {
    try {
      const devServerData = req.dto as DevServerDelete;
      this.devServerService.handleDeleteDevServer(devServerData);
      res.success({ message: "开发服务器删除成功" });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 处理更新排序顺序
   * @param req
   * @param res
   * @param next
   * @returns
   */
  handleUpdateSortOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const sortData = req.dto as DevServerSort;
      devServerLogger.info(sortData, "接收排序更新请求");
      this.devServerService.handleUpdateSortOrder(sortData);
      res.success({ message: "排序更新成功" });
    } catch (error) {
      next(error);
    }
  }
}

export { DevServerController };
