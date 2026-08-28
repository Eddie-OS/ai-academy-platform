import { create } from 'zustand';
import { authApi } from '@/shared/api/auth';
import type { AccountInfo } from '@/shared/api/types';
import { isRegressionMode } from '@/app/regressionMode';
import { isDemoMode } from '@/app/demoMode';
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
    // 视觉回归模式不打后端：文档 1.1 要求「禁用网络」。这里直接给冻结账号，
    // 否则未登录会整体跳登录页，九张基线全拍成登录页。
    //
    // 演示构建同理且更彻底：静态托管上根本没有 /api，探测必然失败，
    // 整站会停在一个永远登不进去的登录页。两种模式共用这个冻结账号，
    // 但它<b>只是个展示用的身份</b>——判权仍在后端 PermissionInterceptor 一处（AR-7），
    // 这里给 operator 不等于放开了任何写接口，演示构建里写接口压根没有对端。
    if (isRegressionMode() || isDemoMode()) {
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
