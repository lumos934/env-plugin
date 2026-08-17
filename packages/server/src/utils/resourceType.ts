import type { ResourceType } from "../types/shared/RequestLog.js";

/**
 * 根据命中规则、响应 Content-Type 和请求 URL 判断资源类型。
 *
 * 分类参考 Chrome DevTools Network 面板：
 * - 命中路由规则的请求视为 API 请求（Fetch/XHR）
 * - 其余按 Content-Type 归类，URL 扩展名作为兜底
 *
 * @param matchedRule 命中的路由规则 pathPrefix，'default' 表示未命中
 * @param contentType 响应头 Content-Type（可能为数组）
 * @param url 请求 URL 路径
 */
export function classifyResourceType(
  matchedRule: string,
  contentType: string | string[] | undefined,
  url: string,
): ResourceType {
  // 命中路由规则 → API 请求（Fetch/XHR）
  if (matchedRule !== "default") return "fetch";

  const ct = (
    Array.isArray(contentType) ? contentType[0] : contentType || ""
  ).toLowerCase();
  const path = url.toLowerCase();

  if (ct.includes("wasm") || path.endsWith(".wasm")) return "wasm";
  if (
    ct.includes("manifest+json") ||
    path.endsWith("manifest.json") ||
    path.endsWith(".webmanifest")
  )
    return "manifest";
  if (ct.includes("font") || /\.(woff2?|ttf|otf|eot)$/.test(path))
    return "font";
  if (
    ct.startsWith("image/") ||
    /\.(png|jpe?g|gif|svg|webp|ico|avif)$/.test(path)
  )
    return "image";
  if (ct.startsWith("video/") || ct.startsWith("audio/")) return "media";
  if (ct.includes("text/css") || path.endsWith(".css")) return "stylesheet";
  if (
    ct.includes("javascript") ||
    ct.includes("ecmascript") ||
    /\.(m?js)$/.test(path)
  )
    return "script";
  if (
    ct.includes("text/html") ||
    path.endsWith(".html") ||
    path.endsWith(".htm")
  )
    return "document";
  return "other";
}
