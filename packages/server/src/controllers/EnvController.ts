import { NextFunction, Request, Response } from "express";
import { EnvService } from "../service/EnvService.js";
import { EnvCreate, EnvDelete, EnvQuery, EnvUpdate, EnvSort } from "../types/index.js";
import { envLogger } from "../utils/logger.js";

/**
 * 环境控制器
 * 负责处理与环境相关的HTTP请求，作为请求入口层：
 * - 解析并验证请求参数
 * - 调用对应的服务层方法处理业务逻辑
 * - 格式化并返回响应结果
 * - 统一错误处理
 */
class EnvController {
  /**
   * 构造函数 - 注入环境服务实例
   * @param private readonly envService - 环境服务实例，处理核心业务逻辑
   */
  constructor(private readonly envService: EnvService) {}

  /**
   * 新增环境
   * @description 处理创建新环境的POST请求
   * @param req - Express请求对象，包含待创建的环境数据（在req.dto中）
   * @param res - Express响应对象，用于返回处理结果
   * @param next - Express下一步中间件函数，用于错误处理
   */
  handleAddEnv(req: Request, res: Response, next: NextFunction): void {
    try {
      // 验证请求数据
      const envData = req.dto as EnvCreate;
      envLogger.info({ envData }, "接收新增环境请求");

      // 调用服务层处理业务
      this.envService.handleAddEnv(envData);

      // 返回成功响应
      res.success();
    } catch (error) {
      envLogger.error(error, "新增环境请求处理失败");
      next(error);
    }
  }

  /**
   * 删除环境
   * @description 处理删除环境的DELETE请求
   * @param req - Express请求对象，包含待删除环境的ID（在req.dto中）
   * @param res - Express响应对象，用于返回处理结果
   * @param next - Express下一步中间件函数，用于错误处理
   */
  async handleDeleteEnv(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // 验证请求数据
      const envData = req.dto as EnvDelete;
      envLogger.info({ envData }, "接收删除环境请求");

      // 调用服务层处理业务（异步操作，需要 await 否则 try/catch 无法捕获错误）
      await this.envService.handleDeleteEnv(envData);

      // 返回成功响应
      res.success({ message: "环境删除成功" });
    } catch (error) {
      envLogger.error(error, "删除环境请求处理失败");
      next(error);
    }
  }

  /**
   * 更新环境
   * @description 处理更新环境信息的PUT请求
   * @param req - Express请求对象，包含待更新的环境数据（在req.dto中）
   * @param res - Express响应对象，用于返回处理结果
   * @param next - Express下一步中间件函数，用于错误处理
   */
  handleUpdateEnv(req: Request, res: Response, next: NextFunction): void {
    try {
      // 验证请求数据
      const envData = req.dto as EnvUpdate;
      envLogger.info({ envData }, "接收更新环境请求");

      // 调用服务层处理业务
      this.envService.handleUpdateEnv(envData);

      // 返回成功响应
      res.success({ message: "环境更新成功" });
    } catch (error) {
      envLogger.error(error, "更新环境请求处理失败");
      next(error);
    }
  }

  /**
   * 获取环境列表
   * @description 处理查询所有环境的GET请求
   * @param req - Express请求对象
   * @param res - Express响应对象，用于返回环境列表
   * @param next - Express下一步中间件函数，用于错误处理
   */
  handleGetList(req: Request, res: Response, next: NextFunction): void {
    try {
      envLogger.info("接收环境列表查询请求");

      // 调用服务层获取数据
      const list = this.envService.handleGetList();

      // 返回成功响应（包含列表数据）
      res.success({ list, total: list.length });
    } catch (error) {
      envLogger.error(error, "环境列表查询请求处理失败");
      next(error);
    }
  }

  /**
   * 获取单个环境详情
   * @description 处理查询指定环境的GET请求
   * @param req - Express请求对象，包含待查询环境的ID（在req.dto中）
   * @param res - Express响应对象，用于返回环境详情
   * @param next - Express下一步中间件函数，用于错误处理
   */
  handleGetDetail(req: Request, res: Response, next: NextFunction): void {
    try {
      // 验证请求数据
      const envData = req.dto as EnvQuery;
      envLogger.info({ envData }, "接收环境详情查询请求");

      // 调用服务层获取数据（假设服务层有此方法）
      const detail = this.envService.findOneById(envData.id);

      if (!detail) {
        res.error("环境不存在");
        return;
      }

      // 返回成功响应（包含详情数据）
      res.success({
        message: "环境详情查询成功",
        data: detail,
      });
    } catch (error) {
      envLogger.error(error, "环境详情查询请求处理失败");
      next(error);
    }
  }

  /**
   * 启动代理服务器
   * @description 处理启动指定环境代理服务的POST请求
   * @param req - Express请求对象，包含目标环境的ID（在req.dto中）
   * @param res - Express响应对象，用于返回处理结果
   * @param next - Express下一步中间件函数，用于错误处理
   */
  async handleStartServer(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // 验证请求数据
      const envData = req.dto as EnvQuery;
      envLogger.info({ envData }, "接收启动代理服务器请求");

      // 调用服务层处理业务（异步操作）
      await this.envService.handleStartServer(envData);

      // 返回成功响应
      res.success();
    } catch (error) {
      envLogger.error(error, "启动代理服务器请求处理失败");
      next(error);
    }
  }

  /**
   * 停止代理服务器
   * @description 处理停止指定环境代理服务的POST请求
   * @param req - Express请求对象，包含目标环境的ID（在req.dto中）
   * @param res - Express响应对象，用于返回处理结果
   * @param next - Express下一步中间件函数，用于错误处理
   */
  async handleStopServer(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // 验证请求数据
      const envData = req.dto as EnvQuery;
      envLogger.info({ envData }, "接收停止代理服务器请求");

      // 调用服务层处理业务（异步操作）
      await this.envService.handleStopServer(envData);

      // 返回成功响应
      res.success({ message: "代理服务器停止成功" });
    } catch (error) {
      envLogger.error(error, "停止代理服务器请求处理失败");
      next(error);
    }
  }

  /**
   * 更新环境排序顺序
   * @description 处理更新环境排序的PUT请求
   * @param req - Express请求对象，包含排序数据（在req.dto中）
   * @param res - Express响应对象，用于返回处理结果
   * @param next - Express下一步中间件函数，用于错误处理
   */
  handleUpdateSortOrder(req: Request, res: Response, next: NextFunction): void {
    try {
      const sortData = req.dto as EnvSort;
      envLogger.info(sortData, "接收排序更新请求");
      this.envService.handleUpdateSortOrder(sortData);
      res.success({ message: "排序更新成功" });
    } catch (error) {
      envLogger.error(error, "排序更新请求处理失败");
      next(error);
    }
  }
}

export { EnvController };
