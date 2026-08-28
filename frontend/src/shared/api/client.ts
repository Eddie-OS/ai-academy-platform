import { isDemoMode } from '@/app/demoMode';
import type { ErrorCode, R } from './types';

/**
 * HTTP 客户端。
 *
 * 阶段 1 起业务接口改用 OpenAPI 生成的 client（纪律 STK-1、API-2），
 * 本文件只保留生成代码无法覆盖的三件事：统一响应拆包、CSRF 头、错误对象构造。
 */

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly traceId: string | null,
    readonly context: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
  return match?.[2] ? decodeURIComponent(match[2]) : null;
}

/** 演示构建里所有接口共用的失败对象。文案要说清是环境缺后端，不是系统故障 */
const DEMO_UNAVAILABLE = '这是纯前端演示环境，没有连接后端，该功能不可用。';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // 演示构建（静态托管）上 /api 没有对端。不拦的话每个请求都要先跑一趟 404 才失败，
  // 页面在此期间停在骨架屏；更糟的是静态托管普遍把未命中路径回落成 index.html，
  // 那会返回 200 + HTML，客户端解析成 JSON 失败后报「服务暂时不可用」——
  // 对着一个本来就没有后端的环境，这个提示是误导。
  if (isDemoMode()) {
    throw new ApiError('INTERNAL_ERROR', DEMO_UNAVAILABLE, null, null);
  }

  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData)) {
    // FormData 的 Content-Type 必须由浏览器带上 boundary 生成，手工设置会让后端解析不出分片
    headers.set('Content-Type', 'application/json');
  }
  if (method !== 'GET' && method !== 'HEAD') {
    // Spring Security 的 CookieCsrfTokenRepository 把 token 写在 XSRF-TOKEN Cookie 里
    const csrf = readCookie('XSRF-TOKEN');
    if (csrf) {
      headers.set('X-XSRF-TOKEN', csrf);
    }
  }

  const response = await fetch(path, {
    ...init,
    method,
    headers,
    credentials: 'same-origin',
  });

  const traceId = response.headers.get('X-Trace-Id');

  let body: R<T> | null = null;
  try {
    body = (await response.json()) as R<T>;
  } catch {
    // 非 JSON 响应（例如 Nginx 直接返回的 502）
    throw new ApiError('INTERNAL_ERROR', '服务暂时不可用，请稍后重试', traceId, null);
  }

  if (body.code === 'OK') {
    return body.data;
  }

  throw new ApiError(
    body.code,
    body.message ?? '请求失败',
    body.traceId ?? traceId,
    body.data,
  );
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, payload?: unknown) =>
    request<T>(path, { method: 'POST', body: payload === undefined ? undefined : JSON.stringify(payload) }),
  put: <T>(path: string, payload?: unknown) =>
    request<T>(path, { method: 'PUT', body: payload === undefined ? undefined : JSON.stringify(payload) }),
  /** 只改一个字段的局部更新。目前只有案例的停留时长回报用它 */
  patch: <T>(path: string, payload?: unknown) =>
    request<T>(path, { method: 'PATCH', body: payload === undefined ? undefined : JSON.stringify(payload) }),
  /** DELETE 允许带请求体：解除附件引用要同时给出 refType／refId／refField 三元组 */
  delete: <T>(path: string, payload?: unknown) =>
    request<T>(path, { method: 'DELETE', body: payload === undefined ? undefined : JSON.stringify(payload) }),
  /** 文件上传。分片上传另见 storage 模块的接口，这里只管一次性的导入文件 */
  postFile: <T>(path: string, file: File, field = 'file') => {
    const form = new FormData();
    form.append(field, file);
    return request<T>(path, { method: 'POST', body: form });
  },
  /** 分片上传的单片（PUT）。分片是 Blob 而不是 File，因此不能复用 postFile */
  putBlob: <T>(path: string, blob: Blob, fileName: string, field = 'file') => {
    const form = new FormData();
    form.append(field, blob, fileName);
    return request<T>(path, { method: 'PUT', body: form });
  },
};

/** 查询串拼装：null／undefined／空串一律不出现在 URL 里，避免后端把空串当成筛选值。 */
export function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
