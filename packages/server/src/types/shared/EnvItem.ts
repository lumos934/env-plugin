import { z } from "zod";

/**
 * 环境主键Schema
 * 用于标识环境的唯一ID
 */
export const EnvPrimarySchema = z.object({
  id: z.string().describe("主键"),
});

/**
 * 环境基础信息Schema
 * 包含环境的基本配置信息
 */
export const EnvItemBaseSchema = z.object({
  apiBaseUrl: z.string().describe("API服务器地址"),

  port: z
    .number()
    .int("端口号必须是整数")
    .min(1, "端口号不能小于1")
    .max(65535, "端口号不能大于65535")
    .describe("环境绑定端口（必填）"),

  name: z.string().describe("环境名称").optional(),

  description: z.string().optional().describe("环境描述"),

  devServerId: z
    .string()
    .min(1, "开发服务器ID不能为空")
    .optional()
    .describe("环境绑定的开发服务器ID"),

  homePage: z.string().optional().describe("环境首页"),

  status: z.enum(["running", "stopped"]).optional(),

  sortOrder: z.number().optional().describe("排序顺序"),
});

/**
 * 完整环境模型Schema
 * 合并了主键和基础信息，用于创建完整的环境模型
 */
export const EnvModelSchema = EnvPrimarySchema.extend(EnvItemBaseSchema.shape);

/**
 * 新增环境Schema
 * 用于创建新环境时的参数验证，不需要提供id（由系统生成）
 */
export const EnvCreateSchema = EnvItemBaseSchema.omit({
  status: true, // 新增时状态由系统自动设置
});

/**
 * 删除环境Schema
 * 用于删除环境时的参数验证，只需要提供环境id
 */
export const EnvDeleteSchema = EnvPrimarySchema;

/**
 * 修改环境Schema
 * 用于更新环境信息时的参数验证，id为必填项，其他字段可选
 */
export const EnvUpdateSchema = EnvPrimarySchema.extend(
  EnvItemBaseSchema.partial().shape
);

/**
 * 查询环境Schema
 * 用于查询环境信息时的参数验证，只需要提供环境id
 */
export const EnvQuerySchema = EnvPrimarySchema;

/**
 * 环境主键类型
 * 包含环境的唯一标识id
 */
export type EnvPrimary = z.infer<typeof EnvPrimarySchema>;

/**
 * 环境基础信息类型
 * 包含环境的所有配置字段
 */
export type EnvItemBase = z.infer<typeof EnvItemBaseSchema>;

/**
 * 完整环境模型类型
 * 包含环境的所有信息（主键+基础信息）
 */
export type EnvModel = z.infer<typeof EnvModelSchema>;

/**
 * 新增环境参数类型
 * 用于创建新环境时的参数类型，不包含id字段
 */
export type EnvCreate = z.infer<typeof EnvCreateSchema>;

/**
 * 删除环境参数类型
 * 用于删除环境时的参数类型，只包含id字段
 */
export type EnvDelete = z.infer<typeof EnvDeleteSchema>;

/**
 * 修改环境参数类型
 * 用于更新环境时的参数类型，id为必填项，其他字段可选
 */
export type EnvUpdate = z.infer<typeof EnvUpdateSchema>;

/**
 * 查询环境参数类型
 * 用于查询环境时的参数类型，只包含id字段
 */
export type EnvQuery = z.infer<typeof EnvQuerySchema>;

/**
 * 带路由规则数量的环境模型
 */
export type EnvModelWithRouteCount = EnvModel & {
  routeRuleCount?: number;
};

/**
 * 环境排序Schema
 * 用于保存排序顺序
 */
export const EnvSortSchema = z.object({
  orders: z.array(z.object({
    id: z.string(),
    sortOrder: z.number(),
  })),
});

/**
 * 排序参数类型
 */
export type EnvSort = z.infer<typeof EnvSortSchema>;

/**
 * 排序项类型
 */
export type EnvSortOrder = EnvSort['orders'][number];

/**
 * 环境切换Schema
 * 用于切换环境时的参数验证
 */
export const EnvSwitchSchema = z.object({
  currentEnvId: z.string().describe("当前环境ID"),
  targetEnvId: z.string().describe("目标环境ID"),
});

/**
 * 环境切换参数类型
 */
export type EnvSwitch = z.infer<typeof EnvSwitchSchema>;
