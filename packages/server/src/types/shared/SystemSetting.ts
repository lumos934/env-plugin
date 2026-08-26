import { z } from "zod";

/**
 * 系统设置模型Schema
 * 全局单例设置（id 固定为 "global"）。
 */
export const SystemSettingModelSchema = z.object({
  id: z.literal("global").describe("全局设置唯一标识"),
  injectEnabled: z.boolean().describe("是否开启注入资源功能"),
  logEnabled: z.boolean().describe("是否开启请求日志记录"),
});

/**
 * 更新系统设置Schema
 * 用于更新系统设置时的参数验证（全量更新）
 */
export const SystemSettingUpdateSchema = z.object({
  injectEnabled: z.boolean().describe("是否开启注入资源功能"),
  logEnabled: z.boolean().describe("是否开启请求日志记录"),
});

/**
 * 完整系统设置模型类型
 */
export type SystemSettingModel = z.infer<typeof SystemSettingModelSchema>;

/**
 * 更新系统设置参数类型
 */
export type SystemSettingUpdate = z.infer<typeof SystemSettingUpdateSchema>;

/**
 * 系统设置响应
 * 供前端 @envm/schemas 引用，类比 LogListResponse
 */
export interface SystemSettingResponse {
  injectEnabled: boolean;
  logEnabled: boolean;
}
