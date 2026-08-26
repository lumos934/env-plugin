import { z } from "zod";

/**
 * 系统设置模型Schema
 * 全局单例设置（id 固定为 "global"），当前仅包含注入资源开关。
 */
export const SystemSettingModelSchema = z.object({
  id: z.literal("global").describe("全局设置唯一标识"),
  injectEnabled: z.boolean().describe("是否开启注入资源功能"),
});

/**
 * 更新系统设置Schema
 * 用于更新注入资源开关时的参数验证
 */
export const SystemSettingUpdateSchema = z.object({
  injectEnabled: z.boolean().describe("是否开启注入资源功能"),
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
}
