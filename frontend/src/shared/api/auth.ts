import { api } from './client';
import type { AccountInfo } from './types';

/** 登录、登出与当前登录态。一期不做注册、找回密码、手机验证（需求 6.1.6）。 */
export const authApi = {
  login: (username: string, password: string) =>
    api.post<AccountInfo>('/api/auth/login', { username, password }),

  logout: () => api.post<void>('/api/auth/logout'),

  /** 未登录时后端返回 data = null，前端据此跳登录页 */
  current: () => api.get<AccountInfo | null>('/api/auth/current'),
};
