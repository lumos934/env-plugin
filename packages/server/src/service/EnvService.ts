import { v4 as uuidv4 } from "uuid";
import PreProxyServer from "./PreProxyServer.js";
import { EnvRepo } from "../repositories/EnvRepo.js";
import { RouteRuleRepo } from "../repositories/RouteRuleRepo.js";
import {
  EnvCreate,
  EnvDelete,
  EnvQuery,
  EnvUpdate,
  EnvModel,
  EnvSort,
} from "../types/index.js";
import { AppError } from "../utils/errors.js";
import { DevServerRepo } from "../repositories/DevServerRepo.js";
import { envLogger } from "../utils/logger.js";
import * as os from "os";

/**
 * 环境服务类
 * 负责处理与环境相关的核心业务逻辑，包括环境的增删改查、服务器启停等操作
 * 依赖环境仓库(EnvRepo)和开发服务器仓库(DevServerRepo)实现数据持久化和关联操作
 */
class EnvService {
  serverIp: string;
  /**
   * 构造函数 - 通过依赖注入初始化仓库实例
   * @param envRepo - 环境仓库实例，用于环境数据的持久化操作
   * @param devServerRepo - 开发服务器仓库实例，用于关联开发服务器的操作
   * @param routeRuleRepo - 路由规则仓库实例，用于获取路由规则数量
   */
  constructor(
    private envRepo: EnvRepo,
    private devServerRepo: DevServerRepo,
    private routeRuleRepo?: RouteRuleRepo
  ) {
    this.serverIp = `${this.getLocalIp()}`;
  }

  /**
   * 添加新环境
   * 1. 校验输入参数合法性 2. 检查环境是否已存在 3. 生成唯一ID 4. 保存新环境
   * @param envItem - 待添加的环境信息（不含ID）
   * @returns {void}
   * @throws {AppError} 当输入参数不合法时抛出
   * @throws {AppError} 当环境已存在（通过apiBaseUrl判断）时抛出
   */
  handleAddEnv(envItem: EnvCreate): void {
    // 参数校验

    envLogger.debug({ envItem }, "准备添加环境");

    // 检查环境是否已存在（通过apiBaseUrl唯一标识）
    const existingEnv = this.envRepo.findOneByApiBaseUrl(envItem);
    if (existingEnv) {
      throw new AppError(`添加失败，环境【${existingEnv.apiBaseUrl}】已存在`);
    }

    // 生成唯一ID并组装完整环境信息
    const newEnvItem: EnvModel = {
      ...envItem,
      id: uuidv4(),
      status: "stopped", // 默认初始状态为停止
    };

    // 保存环境
    this.envRepo.addEnv(newEnvItem);
    envLogger.info({ newEnvItem }, "环境添加成功");
  }

  /**
   * 删除指定环境
   * 1. 校验输入参数 2. 检查环境是否存在 3. 执行删除操作
   * @param envItem - 包含待删除环境ID的对象
   * @returns {void}
   * @throws {AppError} 当输入参数不合法时抛出
   * @throws {AppError} 当环境不存在时抛出
   */
  async handleDeleteEnv(envItem: EnvDelete) {
    // 参数校验

    const { id } = envItem;
    envLogger.info({ envItem }, "准备删除环境");

    // 检查环境是否存在
    const existingEnv = this.envRepo.findOneById(id);
    if (!existingEnv) {
      throw new AppError(`删除失败，环境【${id}】不存在`);
    }

    if (existingEnv.status === "running") {
      await this.handleStopServer(existingEnv);
    }

    // 执行删除
    this.envRepo.deleteEnv(envItem);
    envLogger.info({ envItem }, "环境删除成功");
  }

  /**
   * 更新环境信息
   * 1. 校验输入参数 2. 检查环境是否存在 3. 执行更新操作
   * @param envItem - 包含待更新环境ID及字段的对象
   * @returns {void}
   * @throws {AppError} 当输入参数不合法时抛出
   * @throws {AppError} 当环境不存在时抛出
   */
  handleUpdateEnv(envItem: EnvUpdate): void {
    // 参数校验

    const { id } = envItem;
    envLogger.info({ envItem }, "准备更新环境");

    // 检查环境是否存在
    const existingEnv = this.envRepo.findOneById(id);
    if (!existingEnv) {
      throw new AppError(`更新失败，环境【${id}】不存在`);
    }

    // 执行更新
    this.envRepo.update(envItem);
    envLogger.info({ envItem }, "环境更新成功");
  }

  /**
   * 获取本机 IP 地址
   * @returns 本机 IP 地址
   */
  getLocalIp(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (!iface) continue;
      for (const info of iface) {
        // 跳过 IPv6 和内部地址
        if (info.family === "IPv4" && !info.internal) {
          return info.address;
        }
      }
    }
    return "127.0.0.1";
  }

  /**
   * 获取所有环境列表
   * @returns {Array<EnvModel & {routeRuleCount?: number}>} 环境信息数组
   */
  handleGetList(): Array<EnvModel & { routeRuleCount?: number }> {
    const list = this.envRepo.getAll();
    // 如果有 routeRuleRepo，则统计每个环境的路由规则数量
    if (this.routeRuleRepo) {
      const result = list.map((env) => ({
        ...env,
        routeRuleCount: this.routeRuleRepo?.countByEnvId(env.id) ?? 0,
        serverIp: this.serverIp,
      }));
      envLogger.info({ count: list.length }, `查询到${list.length}个环境`);
      return result;
    }
    envLogger.info({ count: list.length }, `查询到${list.length}个环境`);
    return list;
  }

  findOneById(id: string) {
    return this.envRepo.findOneById(id);
  }

  /**
   * 启动指定环境的代理服务器
   * 1. 校验参数 2. 检查环境存在性 3. 先停止同端口服务 4. 启动新服务 5. 更新状态
   * @param env - 包含待启动环境ID的对象
   * @returns {Promise<void>}
   * @throws {AppError} 当输入参数不合法时抛出
   * @throws {AppError} 当环境不存在时抛出
   * @throws {Error} 当服务器启动失败时抛出
   */
  async handleStartServer(env: EnvQuery): Promise<void> {
    const { id } = env;
    envLogger.info({ env }, "准备启动环境服务");

    // 检查环境是否存在
    const envItem = this.envRepo.findOneById(id);
    if (!envItem) {
      throw new AppError(`启动失败，环境【${id}】不存在`);
    }

    try {
      // 先查与当前服务同端口的环境，如果启动，则关闭掉
      await this.stopServerAtSamePort(envItem);

      // 启动新的代理服务器
      await PreProxyServer.create(
        id,
        this.envRepo,
        this.devServerRepo,
        this.routeRuleRepo!
      );

      // 更新环境状态为运行中
      await this.updateEnvStatus({
        ...env,
        status: "running",
      });
      envLogger.info({ envItem }, "环境服务启动成功");
    } catch (error) {
      envLogger.error(error, "环境服务启动失败");
      throw new AppError(`启动服务失败：${(error as Error).message}`);
    }
  }

  /**
   * 关闭指定端口的服务
   * @param port
   */
  private async stopServerAtSamePort(envItem: EnvModel) {
    // 先查与当前服务同端口的环境，如果启动，则关闭掉
    const samePortAndRunningEnv = this.envRepo.findOne({
      $and: [
        { id: { $ne: envItem.id } }, // $ne 表示 "不等于"
        { port: envItem.port },
        { status: "running" }, // 直接匹配等于的值
      ],
    });
    if (samePortAndRunningEnv) {
      envLogger.info(
        {
          name: samePortAndRunningEnv.name,
        },
        `关闭 ${samePortAndRunningEnv.port} 端口服务`
      );
      await this.handleStopServer(samePortAndRunningEnv);
    }
    envLogger.info({ port: envItem.port }, `端口${envItem.port}没有服务启动`);
  }

  /**
   * 停止指定环境的代理服务器
   * 1. 校验参数 2. 检查环境存在性 3. 停止服务 4. 更新状态
   * @param env - 包含待停止环境ID的对象
   * @returns {Promise<void>}
   * @throws {AppError} 当输入参数不合法时抛出
   * @throws {AppError} 当环境不存在时抛出
   */
  async handleStopServer(env: EnvQuery): Promise<void> {
    const { id } = env;
    envLogger.info({ id }, "准备停止环境服务");

    // 检查环境是否存在
    const envItem = this.envRepo.findOneById(id);
    if (!envItem) {
      throw new AppError(`停止失败，环境【${id}】不存在`);
    }

    // 停止对应端口的服务
    await PreProxyServer.stopServer(id);
    envLogger.info({ envItem }, `环境【${envItem.name}】的服务已停止`);
    // 更新环境的运行状态
    await this.updateEnvStatus({
      id,
      status: "stopped",
    });
  }

  /**
   * 私有方法：更新环境运行状态
   * @param env - 包含环境ID的对象
   * @param status - 目标状态（running/stopped）
   * @returns {Promise<EnvModel | undefined>} 更新后的环境信息
   */
  private async updateEnvStatus(env: EnvUpdate): Promise<EnvModel | undefined> {
    // 查找最新的环境信息（避免使用旧引用）
    const envItem = this.envRepo.findOneById(env.id);
    if (!envItem) {
      envLogger.warn(`更新状态失败，环境【${env.id}】不存在`);
      return undefined;
    }

    // 执行状态更新
    const updatedEnv = { ...envItem, ...env };
    this.envRepo.update(updatedEnv);
    envLogger.info(
      { env, updatedEnv },
      `环境【${env.id}】状态已更新为${updatedEnv.status}`
    );

    return updatedEnv;
  }

  /**
   * 环境切换：启动目标环境（不停止当前环境，允许多环境并行运行）
   * @param currentEnvId - 当前环境ID（仅用于日志和幂等判断）
   * @param targetEnvId - 目标环境ID
   * @returns 目标环境信息（含端口号），供客户端重定向
   * @throws {AppError} 当环境不存在或操作失败时抛出
   */
  async handleSwitchEnv(
    currentEnvId: string,
    targetEnvId: string
  ): Promise<EnvModel> {
    envLogger.info(
      { currentEnvId, targetEnvId },
      "准备切换环境"
    );

    // 检查目标环境是否存在
    const targetEnv = this.envRepo.findOneById(targetEnvId);
    if (!targetEnv) {
      throw new AppError(`切换失败，目标环境【${targetEnvId}】不存在`);
    }

    // 如果切换到同一个环境且已在运行，则无需操作
    if (currentEnvId === targetEnvId && targetEnv.status === "running") {
      envLogger.info("切换到相同环境且已在运行，无需操作");
      return targetEnv;
    }

    // 启动目标环境（如果已在运行则重启以确保状态正确）
    if (targetEnv.status === "running") {
      await this.handleStopServer({ id: targetEnvId });
    }
    await this.handleStartServer({ id: targetEnvId });

    // 3. 返回目标环境最新信息
    const updatedTarget = this.envRepo.findOneById(targetEnvId);
    if (!updatedTarget) {
      throw new AppError("切换后无法获取目标环境信息");
    }

    envLogger.info({ updatedTarget }, "环境切换成功");
    return updatedTarget;
  }

  /**
   * 切换当前环境的 DevServer 绑定
   * 更新 devServerId 后，PreProxyServer 在下个请求中动态读取，即时生效
   * @param envId - 当前环境ID
   * @param devServerId - 目标 DevServer ID
   * @returns 更新后的环境信息
   * @throws {AppError} 当环境或 DevServer 不存在时抛出
   */
  handleSwitchProxy(envId: string, devServerId: string): EnvModel {
    envLogger.info({ envId, devServerId }, "准备切换环境代理目标");

    // 校验环境存在
    const env = this.envRepo.findOneById(envId);
    if (!env) {
      throw new AppError(`切换代理失败，环境【${envId}】不存在`);
    }

    // 校验 DevServer 存在
    const devServer = this.devServerRepo.findOneById({ id: devServerId });
    if (!devServer) {
      throw new AppError(`切换代理失败，DevServer【${devServerId}】不存在`);
    }

    // 更新 devServerId（PreProxyServer 动态读取，即时生效）
    this.envRepo.update({ id: envId, devServerId });

    const updatedEnv = this.envRepo.findOneById(envId);
    envLogger.info({ updatedEnv }, "环境代理目标切换成功");
    return updatedEnv!;
  }

  /**
   * 批量更新排序顺序
   * @param sortData - 排序数据
   * @returns {void}
   * @throws {AppError} 当数据不合法时抛出
   */
  handleUpdateSortOrder(sortData: EnvSort): void {
    const { orders } = sortData;
    envLogger.info(orders, "准备更新排序顺序");

    for (const item of orders) {
      const existing = this.envRepo.findOneById(item.id);
      if (!existing) {
        throw new AppError(`环境【${item.id}】不存在，无法更新排序`);
      }
      this.envRepo.update({
        id: item.id,
        sortOrder: item.sortOrder,
      });
    }
    envLogger.info("排序更新成功");
  }
}

export { EnvService };
