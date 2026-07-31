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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) {
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
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
