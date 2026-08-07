import { z } from "zod";

// ---- 导出数据子 Schema ----

/** 导出的开发服务器（不含 id，通过 devServerUrl 做跨安装匹配） */
export const ExportDevServerSchema = z.object({
  name: z.string(),
  devServerUrl: z.string(),
  description: z.string().optional(),
});
export type ExportDevServer = z.infer<typeof ExportDevServerSchema>;

/** 导出的路由规则（targetEnvId 转为 targetEnvApiBaseUrl 做跨安装引用） */
export const ExportRouteRuleSchema = z.object({
  pathPrefix: z.string().min(1),
  targetEnvApiBaseUrl: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional().default(true),
});
export type ExportRouteRule = z.infer<typeof ExportRouteRuleSchema>;

/** 导出的密码 */
export const ExportPasswordSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  description: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
});
export type ExportPassword = z.infer<typeof ExportPasswordSchema>;

/** 导出的环境（包含关联的 routeRules 和 passwords） */
export const ExportEnvSchema = z.object({
  apiBaseUrl: z.string(),
  port: z.number().int().min(1).max(65535),
  name: z.string().optional(),
  description: z.string().optional(),
  devServerUrl: z.string().optional(),
  homePage: z.string().optional(),
  routeRules: z.array(ExportRouteRuleSchema).optional().default([]),
  passwords: z.array(ExportPasswordSchema).optional().default([]),
});
export type ExportEnv = z.infer<typeof ExportEnvSchema>;

// ---- 顶层导出文件 Schema ----

export const EXPORT_VERSION = "1.0.0" as const;

export const ExportDataSchema = z.object({
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.string(),
  encrypted: z.boolean().optional().default(false),
  devServers: z.array(ExportDevServerSchema).optional().default([]),
  envs: z.array(ExportEnvSchema),
});
export type ExportData = z.infer<typeof ExportDataSchema>;

// ---- 导入/导出请求 Schema ----

export const ExportRequestSchema = z.object({
  /** 要导出的环境 ID 列表；为空则导出全部 */
  envIds: z.array(z.string()).optional(),
  /** 加密密码；提供则对 passwords 中的 password 字段做 AES 加密 */
  encryptPassword: z.string().optional(),
});
export type ExportRequest = z.infer<typeof ExportRequestSchema>;

export const ImportRequestSchema = z.object({
  data: ExportDataSchema,
  conflictStrategy: z.enum(["skip", "overwrite"]).optional().default("skip"),
  decryptPassword: z.string().optional(),
});
export type ImportRequest = z.infer<typeof ImportRequestSchema>;

// ---- 导入结果类型 ----

/** 导入操作的结果统计 */
export interface ImportResult {
  created: {
    envs: number;
    devServers: number;
    routeRules: number;
    passwords: number;
  };
  skipped: { envs: number; devServers: number };
  overwritten: { envs: number; devServers: number };
  errors: string[];
}
