import { getDatabase } from "./database.js";
import {
  PasswordModel,
  PasswordDelete,
  PasswordDeleteSchema,
  PasswordUpdate,
} from "../types/index.js";

/**
 * 密码仓库类
 * 负责密码相关数据的持久化操作，封装了数据库交互逻辑
 */
class PasswordRepo {
  /**
   * 获取密码数据集合
   * @returns 密码数据集合对象
   */
  private getCollection() {
    return getDatabase().getCollection<PasswordModel>("passwords");
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
    collection.ensureIndex("isDefault");
  }

  /**
   * 根据环境ID获取所有密码
   * @param envId - 环境ID
   * @returns 该环境的所有密码数组
   */
  getByEnvId(envId: string): PasswordModel[] {
    return this.getCollection().find({ envId });
  }

  /**
   * 统计指定环境的密码数量
   * @param envId - 环境ID
   * @returns 密码数量
   */
  countByEnvId(envId: string): number {
    return this.getCollection().count({ envId });
  }

  /**
   * 根据ID查询单个密码
   * @param id - 密码ID
   * @returns 匹配的密码，若未找到则返回null
   */
  findOneById(id: string) {
    return this.getCollection().findOne({ id });
  }

  /**
   * 添加新密码
   * @param password - 要添加的密码完整信息对象
   */
  create(password: PasswordModel) {
    this.getCollection().insert(password);
  }

  /**
   * 删除指定密码
   * @param password - 包含要删除密码ID的对象
   */
  delete(password: PasswordDelete) {
    const target = PasswordDeleteSchema.safeParse(password);
    if (!target.success) {
      throw new Error(`删除密码验证失败: ${JSON.stringify(target.error)}`);
    }
    this.getCollection().findAndRemove(target.data);
  }

  /**
   * 删除指定环境的所有密码
   * @param envId - 环境ID
   */
  deleteByEnvId(envId: string) {
    this.getCollection().findAndRemove({ envId });
  }

  /**
   * 更新密码信息
   * @param passwordItem - 包含要更新的密码ID及字段的对象
   */
  update(passwordItem: PasswordUpdate) {
    // 先检查存在性：findAndUpdate 回调仅在匹配文档时执行
    const existing = this.findOneById(passwordItem.id);
    if (!existing) {
      throw new Error(`未找到对应的密码【${passwordItem.id}】`);
    }
    this.getCollection().findAndUpdate({ id: passwordItem.id }, (pwd) => {
      Object.assign(pwd, passwordItem);
      return pwd;
    });
  }

  /**
   * 检查指定环境是否已存在相同名称的密码
   * @param envId - 环境ID
   * @param name - 密码名称
   * @returns 是否存在重复
   */
  existsByEnvIdAndName(envId: string, name: string): boolean {
    const existing = this.getCollection().findOne({
      envId,
      name,
    });
    return existing !== null;
  }

  /**
   * 获取指定环境的默认密码
   * @param envId - 环境ID
   * @returns 默认密码，若未找到则返回null
   */
  findDefaultByEnvId(envId: string): PasswordModel | null {
    return this.getCollection().findOne({ envId, isDefault: true });
  }

  /**
   * 设置指定环境的默认密码（先将其他密码的isDefault设为false）
   * @param envId - 环境ID
   * @param excludeId - 排除的密码ID（更新时使用）
   */
  clearDefaultByEnvId(envId: string, excludeId?: string) {
    const query: Record<string, unknown> = { envId, isDefault: true };
    if (excludeId) {
      query.id = { $ne: excludeId };
    }
    this.getCollection().findAndUpdate(query, (pwd) => {
      if (pwd) {
        pwd.isDefault = false;
      }
      return pwd;
    });
  }

  /**
   * 检查指定环境是否已存在默认密码
   * @param envId - 环境ID
   * @param excludeId - 排除的密码ID（更新时使用）
   * @returns 是否存在默认密码
   */
  hasDefaultPassword(envId: string, excludeId?: string): boolean {
    const query: Record<string, unknown> = { envId, isDefault: true };
    if (excludeId) {
      query.id = { $ne: excludeId };
    }
    return this.getCollection().count(query) > 0;
  }
}

export { PasswordRepo };