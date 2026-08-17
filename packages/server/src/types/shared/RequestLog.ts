import { z } from "zod";

/** 资源类型（参考 Chrome DevTools Network 面板分类） */
export const ResourceTypeSchema = z.enum([
  "fetch", // Fetch/XHR
  "document", // 文档
  "stylesheet", // CSS
  "script", // JS
  "font", // 字体
  "image", // 图片
  "media", // 媒体
  "manifest", // 清单
  "websocket", // 套接字
  "wasm", // Wasm
  "other", // 其他
]);

export type ResourceType = z.infer<typeof ResourceTypeSchema>;

/** 单条请求日志 */
export const RequestLogEntrySchema = z.object({
  id: z.string().describe("唯一标识（uuid）"),
  timestamp: z.number().describe("请求开始时间戳（ms）"),
  method: z.string().describe("HTTP 方法（GET/POST/PUT/DELETE 等）"),
  url: z.string().describe("请求 URL 路径"),
  statusCode: z.number().describe("HTTP 响应状态码"),
  duration: z.number().describe("请求耗时（ms）"),
  matchedRule: z.string().describe("命中的路由规则 pathPrefix，或 'default'"),
  resourceType: ResourceTypeSchema.describe("资源类型"),
  envId: z.string().describe("所属环境 ID"),
  envName: z.string().describe("环境名称"),
});

export type RequestLogEntry = z.infer<typeof RequestLogEntrySchema>;

/** 日志列表响应 */
export interface LogListResponse {
  list: RequestLogEntry[];
  total: number;
}
