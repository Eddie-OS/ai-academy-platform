import { create } from 'zustand';
import { authApi } from '@/shared/api/auth';
import type { AccountInfo } from '@/shared/api/types';
import { isRegressionMode } from '@/app/regressionMode';
import { FIXTURE_ACCOUNT } from '@/fixtures/account';

/**
 * 登录态。用 Zustand 管这一点点客户端状态即可，不引 Redux（《开发实施文档》3.4）。
 *
 * 纪律 PMI-5：写操作入口是否渲染，只看 {@link AccountInfo.operator} 一个布尔值。
 */
interface AuthState {
  account: AccountInfo | null;
  /** 是否已完成首次登录态探测。未完成时不渲染路由，避免登录页闪一下 */
  resolved: boolean;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  account: null,
  resolved: false,

  bootstrap: async () => {
    // 唯一跳过登录的地方，且只在视觉回归模式下：文档 1.1 要求「禁用网络」，
    // 不给冻结账号的话未登录会整体跳登录页，九张基线全拍成登录页。
    //
    // 回归模式的入口是 URL 参数 ?fixture=1，仅供截图比对使用（见 regressionMode.ts）。
    // 除此之外<b>任何情况都必须真的登录一次</b>：会话由后端 HttpSession 持有，
    // 前端不持久化登录态，浏览器关掉即失效。
    if (isRegressionMode()) {
      set({ account: FIXTURE_ACCOUNT, resolved: true });
      return;
    }
    try {
      const account = await authApi.current();
      set({ account, resolved: true });
    } catch {
      set({ account: null, resolved: true });
    }
  },

  login: async (username, password) => {
    const account = await authApi.login(username, password);
    set({ account });
  },

  logout: async () => {
    await authApi.logout();
    set({ account: null });
  },
}));

/** 是否运营账号。用户账号为只读，例外只有点赞与评论（需求 6.2.5）。 */
export const useIsOperator = () => useAuthStore((state) => state.account?.operator ?? false);
