import { getDatabase } from "./database.js";
import { SystemSettingModel } from "../types/index.js";

/**
 * 系统设置仓库类
 * 负责全局系统设置数据的持久化操作，封装数据库交互逻辑
 */
class SystemSettingRepo {
  /**
   * 获取系统设置数据集合
   * @returns 系统设置数据集合对象
   */
  private getCollection() {
    return getDatabase().getCollection<SystemSettingModel>("settings");
  }

  /**
   * 构造函数
   */
  constructor() {}

  /**
   * 获取全局设置记录
   * @returns 全局设置，若未找到则返回 null
   */
  getGlobal(): SystemSettingModel | null {
    return this.getCollection().findOne({ id: "global" });
  }

  /**
   * 写入或更新全局设置记录
   * @param model - 要写入的完整设置信息对象
   */
  upsert(model: SystemSettingModel) {
    const existing = this.getGlobal();
    if (existing) {
      this.getCollection().findAndUpdate({ id: "global" }, (item) => {
        Object.assign(item, model);
        return item;
      });
    } else {
      this.getCollection().insert(model);
    }
  }
}

export { SystemSettingRepo };
