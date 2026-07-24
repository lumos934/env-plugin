import { getDatabase } from "./database.js";
import {
  DevServerModel,
  DevServerDelete,
  DevServerUpdate,
  DevServerQuery,
  DevServerDeleteSchema,
  DevServerUpdateSchema,
  DevServerQuerySchema,
  DevServerModelSchema,
} from "../types/index.js";
import { AppError } from "../utils/errors.js";

/**
 * 开发服务器仓库类
 * 负责开发服务器相关数据的持久化操作，封装数据库交互逻辑
 */
class DevServerRepo {
  /**
   * 获取开发服务器数据集合
   * @returns 开发服务器数据集合对象
   */
  private getCollection() {
    return getDatabase().getCollection<DevServerModel>("devServer");
  }

  /**
   * 获取所有开发服务器信息
   * @returns 所有开发服务器信息的数组
   */
  getAll(): DevServerModel[] {
    return this.getCollection().find();
  }

  /**
   * 添加新的开发服务器
   * @param devServer - 要添加的开发服务器信息（不含ID）
   * @throws {AppError} 当验证失败时抛出错误
   */
  addDevServer(devServer: DevServerModel): void {
    // 验证输入数据
    const validationResult = DevServerModelSchema.safeParse(devServer);
    if (!validationResult.success) {
      throw new AppError(
        `添加开发服务器失败：参数验证错误 - ${JSON.stringify(
          validationResult.error.issues
        )}`
      );
    }

    this.getCollection().insert(validationResult.data);
  }

  /**
   * 根据ID删除开发服务器
   * @param devServer - 包含要删除的开发服务器ID的对象
   * @throws {AppError} 当验证失败或服务器不存在时抛出错误
   */
  deleteDevServer(devServer: DevServerDelete): void {
    // 验证输入数据
    const validationResult = DevServerDeleteSchema.safeParse(devServer);
    if (!validationResult.success) {
      throw new AppError(
        `删除开发服务器失败：参数验证错误 - ${JSON.stringify(
          validationResult.error.issues
        )}`
      );
    }

    // 检查服务器是否存在
    const existing = this.findOneById(validationResult.data);
    if (!existing) {
      throw new AppError(
        `删除开发服务器失败：服务器【${validationResult.data.id}】不存在`
      );
    }

    this.getCollection().findAndRemove(validationResult.data);
  }

  /**
   * 根据ID查询开发服务器
   * @param devServer - 包含要查询的开发服务器ID的对象
   * @returns 匹配的开发服务器信息，若未找到则返回null
   * @throws {AppError} 当验证失败时抛出错误
   */
  findOneById(devServer: DevServerQuery): DevServerModel | null {
    // 验证输入数据
    const validationResult = DevServerQuerySchema.safeParse(devServer);
    if (!validationResult.success) {
      throw new AppError(
        `查询开发服务器失败：参数验证错误 - ${JSON.stringify(
          validationResult.error.issues
        )}`
      );
    }

    return this.getCollection().findOne(validationResult.data);
  }

  /**
   * 根据URL查询开发服务器
   * @param url - 开发服务器URL
   * @returns 匹配的开发服务器信息，若未找到则返回null
   */
  findOneByUrl(url: string): DevServerModel | null {
    return this.getCollection().findOne({ devServerUrl: url });
  }

  /**
   * 更新开发服务器信息
   * @param devServer - 包含要更新的开发服务器ID及字段的对象
   * @throws {AppError} 当验证失败或服务器不存在时抛出错误
   */
  update(devServer: DevServerUpdate): void {
    // 验证输入数据
    const validationResult = DevServerUpdateSchema.safeParse(devServer);
    if (!validationResult.success) {
      throw new AppError(
        `更新开发服务器失败：参数验证错误 - ${JSON.stringify(
          validationResult.error.issues
        )}`
      );
    }

    // 检查服务器是否存在
    const existing = this.findOneById({ id: validationResult.data.id });
    if (!existing) {
      throw new AppError(
        `更新开发服务器失败：服务器【${validationResult.data.id}】不存在`
      );
    }

    this.getCollection().findAndUpdate(
      { id: validationResult.data.id },
      (server) => {
        // 此前已通过 findOneById 确认存在性，回调必定有值
        Object.assign(server, validationResult.data);
        return server;
      }
    );
  }

  /**
   * 更新开发服务器排序顺序
   * @param id - 开发服务器ID
   * @param sortOrder - 排序顺序
   */
  updateSortOrder(id: string, sortOrder: number): void {
    this.getCollection().findAndUpdate(
      { id },
      (server) => {
        if (server) {
          server.sortOrder = sortOrder;
        }
        return server;
      }
    );
  }
}

export { DevServerRepo };
