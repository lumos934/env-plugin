import { v4 as uuidv4 } from "uuid";
import { RouteRuleRepo } from "../repositories/RouteRuleRepo.js";
import { EnvRepo } from "../repositories/EnvRepo.js";
import {
  RouteRuleCreate,
  RouteRuleDelete,
  RouteRuleUpdate,
  RouteRuleModel,
} from "../types/index.js";
import { AppError } from "../utils/errors.js";

/**
 * 路由规则服务类
 * 负责处理与路由规则相关的核心业务逻辑，包括路由规则的增删改查等操作
 * 依赖路由规则仓库(RouteRuleRepo)和环境仓库(EnvRepo)实现数据持久化和关联操作
 */
class RouteRuleService {
  /**
   * 构造函数 - 通过依赖注入初始化仓库实例
   * @param routeRuleRepo - 路由规则仓库实例，用于路由规则数据的持久化操作
   * @param envRepo - 环境仓库实例，用于获取环境信息
   */
  constructor(
    private routeRuleRepo: RouteRuleRepo,
    private envRepo: EnvRepo
  ) {}

  /**
   * 获取指定环境的所有路由规则
   * @param envId - 环境ID
   * @returns 该环境的所有路由规则数组（实时关联环境名称）
   */
  handleGetByEnvId(envId: string): RouteRuleModel[] {
    const rules = this.routeRuleRepo.getByEnvId(envId);

    // 实时关联环境名称
    return rules.map((rule) => {
      const targetEnv = rule.targetEnvId
        ? this.envRepo.findOneById(rule.targetEnvId)
        : null;
      return {
        ...rule,
        targetEnvName: targetEnv
          ? `${targetEnv.name}${targetEnv.apiBaseUrl}` || targetEnv.apiBaseUrl
          : "",
      };
    });
  }

  /**
   * 添加新路由规则
   * 1. 校验输入参数合法性 2. 检查目标环境是否存在 3. 生成唯一ID 4. 保存
   * @param routeRuleItem - 待添加的路由规则信息（不含ID）
   * @returns 新创建的路由规则
   * @throws {AppError} 当输入参数不合法或目标环境不存在时抛出
   */
  handleAdd(routeRuleItem: RouteRuleCreate): RouteRuleModel {
    const { envId, pathPrefix, targetEnvId } = routeRuleItem;

    // 检查目标环境是否存在
    if (targetEnvId) {
      const targetEnv = this.envRepo.findOneById(targetEnvId);
      if (!targetEnv) {
        throw new AppError(`添加失败，目标环境【${targetEnvId}】不存在`);
      }
    }

    // 目标环境不能为空
    if (!targetEnvId) {
      throw new AppError("添加失败，目标环境不能为空");
    }

    // 检查是否已存在相同路径前缀的规则（同一环境下）
    if (this.routeRuleRepo.existsByEnvIdAndPathPrefix(envId, pathPrefix)) {
      throw new AppError(
        `添加失败，该环境下已存在路径前缀【${pathPrefix}】的规则`
      );
    }

    // 生成唯一ID并组装完整路由规则信息
    const now = new Date().toISOString();
    const newRouteRule: RouteRuleModel = {
      ...routeRuleItem,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };

    // 保存路由规则
    this.routeRuleRepo.create(newRouteRule);
    return newRouteRule;
  }

  /**
   * 更新路由规则
   * 1. 校验输入参数 2. 检查规则是否存在 3. 检查目标环境是否存在 4. 执行更新
   * @param routeRuleItem - 包含待更新路由规则ID及字段的对象
   * @returns 更新后的路由规则
   * @throws {AppError} 当输入参数不合法或规则/目标环境不存在时抛出
   */
  handleUpdate(routeRuleItem: RouteRuleUpdate): RouteRuleModel {
    const { id, targetEnvId } = routeRuleItem;

    // 检查路由规则是否存在
    const existingRule = this.routeRuleRepo.findOneById(id);
    if (!existingRule) {
      throw new AppError(`更新失败，路由规则【${id}】不存在`);
    }

    // 判断是否需要清空目标环境（只有明确发送空字符串时才清空）
    if (targetEnvId === "") {
      // 清空目标环境
      routeRuleItem.targetEnvId = "";
    } else if (targetEnvId !== undefined && targetEnvId !== existingRule.targetEnvId) {
      // 更新了目标环境，检查目标环境是否存在
      const targetEnv = this.envRepo.findOneById(targetEnvId);
      if (!targetEnv) {
        throw new AppError(`更新失败，目标环境【${targetEnvId}】不存在`);
      }
    }

    // 如果更新了路径前缀，检查是否与其他规则冲突
    if (
      routeRuleItem.pathPrefix &&
      routeRuleItem.pathPrefix !== existingRule.pathPrefix
    ) {
      if (
        this.routeRuleRepo.existsByEnvIdAndPathPrefix(
          existingRule.envId,
          routeRuleItem.pathPrefix
        )
      ) {
        throw new AppError(
          `更新失败，该环境下已存在路径前缀【${routeRuleItem.pathPrefix}】的规则`
        );
      }
    }

    // 添加更新时间
    routeRuleItem.updatedAt = new Date().toISOString();

    // 执行更新
    this.routeRuleRepo.update(routeRuleItem);

    // 返回更新后的规则
    return this.routeRuleRepo.findOneById(id)!;
  }

  /**
   * 删除指定路由规则
   * 1. 校验输入参数 2. 检查规则是否存在 3. 执行删除操作
   * @param routeRuleItem - 包含待删除路由规则ID的对象
   * @throws {AppError} 当输入参数不合法或规则不存在时抛出
   */
  handleDelete(routeRuleItem: RouteRuleDelete): void {
    const { id } = routeRuleItem;

    // 检查路由规则是否存在
    const existingRule = this.routeRuleRepo.findOneById(id);
    if (!existingRule) {
      throw new AppError(`删除失败，路由规则【${id}】不存在`);
    }

    // 执行删除
    this.routeRuleRepo.delete(routeRuleItem);
  }
}

export { RouteRuleService };
