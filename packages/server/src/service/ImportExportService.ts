import { v4 as uuidv4 } from "uuid";
import * as crypto from "crypto";
import { EnvRepo } from "../repositories/EnvRepo.js";
import { DevServerRepo } from "../repositories/DevServerRepo.js";
import { RouteRuleRepo } from "../repositories/RouteRuleRepo.js";
import { PasswordRepo } from "../repositories/PasswordRepo.js";
import {
  ExportData,
  ExportEnv,
  ExportDevServer,
  ExportRouteRule,
  ExportPassword,
  ExportRequest,
  ImportRequest,
  ImportResult,
  EXPORT_VERSION,
} from "../types/index.js";
import { AppError } from "../utils/errors.js";
import { envLogger } from "../utils/logger.js";

const ENCRYPTION_ALGORITHM = "aes-256-cbc";
const MAGIC_BYTES = Buffer.from("ENVM");

/**
 * 导入/导出服务
 * 负责环境配置的导出（打包为 JSON）和导入（解析并重建数据）
 */
class ImportExportService {
  constructor(
    private envRepo: EnvRepo,
    private devServerRepo: DevServerRepo,
    private routeRuleRepo: RouteRuleRepo,
    private passwordRepo: PasswordRepo,
  ) {}

  // ==================== 导出 ====================

  /**
   * 导出指定环境（或全部环境）的完整配置数据
   */
  exportEnvs(request: ExportRequest): ExportData {
    const allEnvs = this.envRepo.getAll();
    const targetEnvs =
      request.envIds && request.envIds.length > 0
        ? allEnvs.filter((e) => request.envIds!.includes(e.id))
        : allEnvs;

    const devServerMap = new Map<string, ExportDevServer>();
    const exportedEnvs: ExportEnv[] = [];

    for (const env of targetEnvs) {
      // 解析 devServerUrl
      let devServerUrl: string | undefined;
      if (env.devServerId) {
        const ds = this.devServerRepo.findOneById({ id: env.devServerId });
        if (ds) {
          devServerUrl = ds.devServerUrl;
          // 收集关联的 DevServer（去重）
          if (!devServerMap.has(ds.devServerUrl)) {
            devServerMap.set(ds.devServerUrl, {
              name: ds.name,
              devServerUrl: ds.devServerUrl,
              description: ds.description,
            });
          }
        }
      }

      // 获取路由规则（targetEnvId → targetEnvApiBaseUrl）
      const routeRules: ExportRouteRule[] = this.routeRuleRepo
        .getByEnvId(env.id)
        .map((rule) => {
          const result: ExportRouteRule = {
            pathPrefix: rule.pathPrefix,
            description: rule.description,
            enabled: rule.enabled,
          };
          if (rule.targetEnvId) {
            const targetEnv = this.envRepo.findOneById(rule.targetEnvId);
            if (targetEnv) {
              result.targetEnvApiBaseUrl = targetEnv.apiBaseUrl;
            }
          }
          return result;
        });

      // 获取密码
      const passwords: ExportPassword[] = this.passwordRepo
        .getByEnvId(env.id)
        .map((pwd) => ({
          name: pwd.name,
          username: pwd.username,
          password: pwd.password,
          description: pwd.description,
          isDefault: pwd.isDefault,
        }));

      exportedEnvs.push({
        apiBaseUrl: env.apiBaseUrl,
        port: env.port,
        name: env.name,
        description: env.description,
        devServerUrl,
        homePage: env.homePage,
        routeRules,
        passwords,
      });
    }

    const data: ExportData = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      encrypted: false,
      devServers: Array.from(devServerMap.values()),
      envs: exportedEnvs,
    };

    // 可选加密
    if (request.encryptPassword) {
      this.encryptPasswords(data, request.encryptPassword);
    }

    envLogger.info(
      { envCount: exportedEnvs.length, devServerCount: data.devServers.length },
      "环境配置导出完成",
    );
    return data;
  }

  // ==================== 导入 ====================

  /**
   * 导入环境配置数据
   */
  importEnvs(request: ImportRequest): ImportResult {
    const { data, conflictStrategy } = request;

    const result: ImportResult = {
      created: { envs: 0, devServers: 0, routeRules: 0, passwords: 0 },
      skipped: { envs: 0, devServers: 0 },
      overwritten: { envs: 0, devServers: 0 },
      errors: [],
    };

    // 解密（如果需要）
    if (data.encrypted && request.decryptPassword) {
      try {
        this.decryptPasswords(data, request.decryptPassword);
      } catch (error) {
        throw new AppError(
          `密码解密失败：${error instanceof Error ? error.message : "密码错误或数据损坏"}`,
          400,
        );
      }
    }

    // 第一步：导入 DevServer（建立 devServerUrl → id 映射）
    const devServerIdMap = new Map<string, string>();
    for (const ds of data.devServers) {
      try {
        const existing = this.devServerRepo.findOneByUrl(ds.devServerUrl);
        if (existing) {
          if (conflictStrategy === "overwrite") {
            this.devServerRepo.update({
              id: existing.id,
              name: ds.name,
              description: ds.description,
            });
            devServerIdMap.set(ds.devServerUrl, existing.id);
            result.overwritten.devServers++;
          } else {
            devServerIdMap.set(ds.devServerUrl, existing.id);
            result.skipped.devServers++;
          }
        } else {
          const id = uuidv4();
          this.devServerRepo.addDevServer({
            id,
            name: ds.name,
            devServerUrl: ds.devServerUrl,
            description: ds.description ?? "",
            sortOrder: 0,
          });
          devServerIdMap.set(ds.devServerUrl, id);
          result.created.devServers++;
        }
      } catch (error) {
        result.errors.push(
          `DevServer [${ds.devServerUrl}]: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // 第二步：导入环境
    for (const exportEnv of data.envs) {
      try {
        const existingEnv = this.envRepo.findOne({
          apiBaseUrl: exportEnv.apiBaseUrl,
        });

        let envId: string;

        if (existingEnv) {
          if (conflictStrategy === "overwrite") {
            // 解析 devServerId
            const devServerId = exportEnv.devServerUrl
              ? devServerIdMap.get(exportEnv.devServerUrl)
              : undefined;

            this.envRepo.update({
              id: existingEnv.id,
              port: exportEnv.port,
              name: exportEnv.name,
              description: exportEnv.description,
              devServerId,
              homePage: exportEnv.homePage,
              apiBaseUrl: exportEnv.apiBaseUrl,
            });
            envId = existingEnv.id;

            // 删除旧的 routeRules 和 passwords
            this.routeRuleRepo.deleteByEnvId(envId);
            this.passwordRepo.deleteByEnvId(envId);

            result.overwritten.envs++;
          } else {
            result.skipped.envs++;
            continue;
          }
        } else {
          // 创建新环境
          envId = uuidv4();
          const devServerId = exportEnv.devServerUrl
            ? devServerIdMap.get(exportEnv.devServerUrl)
            : undefined;

          this.envRepo.addEnv({
            id: envId,
            apiBaseUrl: exportEnv.apiBaseUrl,
            port: exportEnv.port,
            name: exportEnv.name,
            description: exportEnv.description,
            devServerId,
            homePage: exportEnv.homePage,
            status: "stopped",
            sortOrder: 0,
          });
          result.created.envs++;
        }

        // 创建 routeRules
        for (const rule of exportEnv.routeRules) {
          try {
            const targetEnvId = rule.targetEnvApiBaseUrl
              ? this.resolveTargetEnvId(rule.targetEnvApiBaseUrl)
              : undefined;

            const now = new Date().toISOString();
            this.routeRuleRepo.create({
              id: uuidv4(),
              envId,
              pathPrefix: rule.pathPrefix,
              targetEnvId,
              description: rule.description,
              enabled: rule.enabled ?? true,
              createdAt: now,
              updatedAt: now,
            });
            result.created.routeRules++;
          } catch (error) {
            result.errors.push(
              `RouteRule [${rule.pathPrefix}]: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        // 创建 passwords
        for (const pwd of exportEnv.passwords) {
          try {
            const now = new Date().toISOString();
            this.passwordRepo.create({
              id: uuidv4(),
              envId,
              name: pwd.name,
              username: pwd.username,
              password: pwd.password,
              description: pwd.description,
              isDefault: pwd.isDefault ?? false,
              createdAt: now,
              updatedAt: now,
            });
            result.created.passwords++;
          } catch (error) {
            result.errors.push(
              `Password [${pwd.name}]: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      } catch (error) {
        result.errors.push(
          `Env [${exportEnv.apiBaseUrl}]: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    envLogger.info(result, "环境配置导入完成");
    return result;
  }

  // ==================== 加密 / 解密 ====================

  /**
   * 对导出数据中的所有 password 字段进行加密
   */
  private encryptPasswords(data: ExportData, passphrase: string): void {
    const { key, iv } = this.deriveKeyAndIV(passphrase);
    let hasPasswords = false;

    for (const env of data.envs) {
      for (const pwd of env.passwords) {
        pwd.password = this.encryptField(pwd.password, key, iv);
        hasPasswords = true;
      }
    }

    data.encrypted = hasPasswords;
  }

  /**
   * 对导入数据中的所有 password 字段进行解密
   */
  private decryptPasswords(data: ExportData, passphrase: string): void {
    const { key, iv } = this.deriveKeyAndIV(passphrase);

    for (const env of data.envs) {
      for (const pwd of env.passwords) {
        pwd.password = this.decryptField(pwd.password, key, iv);
      }
    }
  }

  /**
   * 从密码短语派生 AES-256-CBC 密钥和 IV
   */
  private deriveKeyAndIV(passphrase: string): { key: Buffer; iv: Buffer } {
    const key = crypto.createHash("sha256").update(passphrase).digest();
    const iv = crypto
      .createHash("sha256")
      .update(passphrase + "envm-iv-salt")
      .digest()
      .subarray(0, 16);
    return { key, iv };
  }

  /**
   * 加密单个字段（hex 输出，带魔术字前缀）
   */
  private encryptField(plaintext: string, key: Buffer, iv: Buffer): string {
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      MAGIC_BYTES,
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    return encrypted.toString("hex");
  }

  /**
   * 解密单个字段（hex 输入，验证魔术字）
   */
  private decryptField(hexCiphertext: string, key: Buffer, iv: Buffer): string {
    const encrypted = Buffer.from(hexCiphertext, "hex");
    const magic = encrypted.subarray(0, MAGIC_BYTES.length).toString("utf8");
    if (magic !== MAGIC_BYTES.toString("utf8")) {
      throw new AppError("密码解密失败：密码错误或数据损坏", 400);
    }
    const ciphertext = encrypted.subarray(MAGIC_BYTES.length);
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
  }

  // ==================== 辅助方法 ====================

  /**
   * 根据 apiBaseUrl 查找本地 envId
   */
  private resolveTargetEnvId(apiBaseUrl: string): string | undefined {
    const env = this.envRepo.findOne({ apiBaseUrl });
    return env?.id;
  }
}

export { ImportExportService };
