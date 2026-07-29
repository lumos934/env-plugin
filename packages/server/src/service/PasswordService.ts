import { v4 as uuidv4 } from "uuid";
import { PasswordRepo } from "../repositories/PasswordRepo.js";
import {
  PasswordCreate,
  PasswordDelete,
  PasswordUpdate,
  PasswordModel,
} from "../types/index.js";
import { AppError } from "../utils/errors.js";

/**
 * 密码服务类
 * 负责处理与密码相关的核心业务逻辑，包括密码的增删改查等操作
 * 依赖密码仓库(PasswordRepo)实现数据持久化
 */
class PasswordService {
  /**
   * 构造函数 - 通过依赖注入初始化仓库实例
   * @param passwordRepo - 密码仓库实例，用于密码数据的持久化操作
   */
  constructor(private passwordRepo: PasswordRepo) {}

  /**
   * 获取指定环境的所有密码
   * @param envId - 环境ID
   * @returns 该环境的所有密码数组
   */
  handleGetByEnvId(envId: string): PasswordModel[] {
    return this.passwordRepo.getByEnvId(envId);
  }

  /**
   * 添加新密码
   * 1. 校验输入参数合法性 2. 检查是否已存在相同名称 3. 如果设为默认密码则先清除其他默认密码 4. 生成唯一ID 5. 保存
   * @param passwordItem - 待添加的密码信息（不含ID）
   * @returns 新创建的密码
   * @throws {AppError} 当输入参数不合法或已存在相同名称时抛出
   */
  handleAdd(passwordItem: PasswordCreate): PasswordModel {
    const { envId, name, isDefault } = passwordItem;

    // 检查是否已存在相同名称的密码（同一环境下）
    if (this.passwordRepo.existsByEnvIdAndName(envId, name)) {
      throw new AppError(`添加失败，该环境下已存在名称为【${name}】的密码`);
    }

    // 如果设为默认密码，先清除其他默认密码
    if (isDefault) {
      this.passwordRepo.clearDefaultByEnvId(envId);
    }

    // 生成唯一ID并组装完整密码信息
    const now = new Date().toISOString();
    const newPassword: PasswordModel = {
      ...passwordItem,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };

    // 保存密码
    this.passwordRepo.create(newPassword);
    return newPassword;
  }

  /**
   * 更新密码
   * 1. 校验输入参数 2. 检查密码是否存在 3. 如果设为默认密码则先清除其他默认密码 4. 执行更新
   * @param passwordItem - 包含待更新密码ID及字段的对象
   * @returns 更新后的密码
   * @throws {AppError} 当输入参数不合法或密码不存在时抛出
   */
  handleUpdate(passwordItem: PasswordUpdate): PasswordModel {
    const { id, isDefault } = passwordItem;

    // 检查密码是否存在
    const existingPassword = this.passwordRepo.findOneById(id);
    if (!existingPassword) {
      throw new AppError(`更新失败，密码【${id}】不存在`);
    }

    // 如果更新了名称，检查是否与其他密码冲突
    if (passwordItem.name && passwordItem.name !== existingPassword.name) {
      if (this.passwordRepo.existsByEnvIdAndName(existingPassword.envId, passwordItem.name)) {
        throw new AppError(`更新失败，该环境下已存在名称为【${passwordItem.name}】的密码`);
      }
    }

    // 如果设为默认密码（从false改为true），先清除其他默认密码
    if (isDefault && !existingPassword.isDefault) {
      this.passwordRepo.clearDefaultByEnvId(existingPassword.envId, id);
    }

    // 添加更新时间
    passwordItem.updatedAt = new Date().toISOString();

    // 执行更新
    this.passwordRepo.update(passwordItem);

    // 返回更新后的密码
    return this.passwordRepo.findOneById(id)!;
  }

  /**
   * 删除指定密码
   * 1. 校验输入参数 2. 检查密码是否存在 3. 执行删除操作
   * @param passwordItem - 包含待删除密码ID的对象
   * @throws {AppError} 当输入参数不合法或密码不存在时抛出
   */
  handleDelete(passwordItem: PasswordDelete): void {
    const { id } = passwordItem;

    // 检查密码是否存在
    const existingPassword = this.passwordRepo.findOneById(id);
    if (!existingPassword) {
      throw new AppError(`删除失败，密码【${id}】不存在`);
    }

    // 执行删除
    this.passwordRepo.delete(passwordItem);
  }
}

export { PasswordService };