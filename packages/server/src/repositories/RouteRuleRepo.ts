import { getDatabase } from "./database.js";
import {
  RouteRuleModel,
  RouteRuleDelete,
  RouteRuleDeleteSchema,
  RouteRuleUpdate,
  // RouteRuleCreate,
} from "../types/index.js";

/**
 * 路由规则仓库类
 * 负责路由规则相关数据的持久化操作，封装了数据库交互逻辑
 */
class RouteRuleRepo {
  /**
   * 获取路由规则数据集合
   * @returns 路由规则数据集合对象
   */
  private getCollection() {
    return getDatabase().getCollection<RouteRuleModel>("routeRules");
  }

  /**
   * 构造函数
   */
  constructor() {}

  /**
   * 初始化集合索引
   */
  initCollection() {
    const collection = this.getCollection();
    collection.ensureIndex("id");
    collection.ensureIndex("envId");
    collection.ensureIndex("pathPrefix");
  }

  /**
   * 根据环境ID获取所有路由规则
   * @param envId - 环境ID
   * @returns 该环境的所有路由规则数组
   */
  getByEnvId(envId: string): RouteRuleModel[] {
    return this.getCollection().find({ envId });
  }

  /**
   * 统计指定环境的路由规则数量
   * @param envId - 环境ID
   * @returns 路由规则数量
   */
  countByEnvId(envId: string): number {
    return this.getCollection().count({ envId });
  }

  /**
   * 根据ID查询单个路由规则
   * @param id - 路由规则ID
   * @returns 匹配的路由规则，若未找到则返回null
   */
  findOneById(id: string) {
    return this.getCollection().findOne({ id });
  }

  /**
   * 添加新路由规则
   * @param routeRule - 要添加的路由规则完整信息对象
   */
  create(routeRule: RouteRuleModel) {
    this.getCollection().insert(routeRule);
  }

  /**
   * 删除指定路由规则
   * @param routeRule - 包含要删除路由规则ID的对象
   */
  delete(routeRule: RouteRuleDelete) {
    const target = RouteRuleDeleteSchema.safeParse(routeRule);
    if (!target.success) {
      throw new Error(`删除路由规则验证失败: ${JSON.stringify(target.error)}`);
    }
    this.getCollection().findAndRemove(target.data);
  }

  /**
   * 删除指定环境的所有路由规则
   * @param envId - 环境ID
   */
  deleteByEnvId(envId: string) {
    this.getCollection().findAndRemove({ envId });
  }

  /**
   * 更新路由规则信息
   * @param routeRuleItem - 包含要更新的路由规则ID及字段的对象
   */
  update(routeRuleItem: RouteRuleUpdate) {
    // 先检查存在性：findAndUpdate 回调仅在匹配文档时执行
    const existing = this.findOneById(routeRuleItem.id);
    if (!existing) {
      throw new Error(`未找到对应的路由规则【${routeRuleItem.id}】`);
    }
    this.getCollection().findAndUpdate({ id: routeRuleItem.id }, (rule) => {
      Object.assign(rule, routeRuleItem);
      return rule;
    });
  }

  /**
   * 检查指定环境是否已存在相同路径前缀的规则
   * @param envId - 环境ID
   * @param pathPrefix - 路径前缀
   * @returns 是否存在重复
   */
  existsByEnvIdAndPathPrefix(envId: string, pathPrefix: string): boolean {
    const existing = this.getCollection().findOne({
      envId,
      pathPrefix,
    });
    return existing !== null;
  }
}

export { RouteRuleRepo };