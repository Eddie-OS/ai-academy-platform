import type { ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ALL_PAGES, DASHBOARD_PAGE } from './navigation';
import { OperatorOnly } from './OperatorOnly';
import { LoginPage } from '@/pages/LoginPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { DashboardShellPage } from '@/pages/DashboardShellPage';
import { ImportCenterPage } from '@/pages/ImportCenterPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { useAuthStore } from '@/shared/store/authStore';

/**
 * 路由表由 {@link ALL_PAGES} 生成，保证「导航菜单」与「路由」不会各自维护一份而走偏。
 * 运营专属页面是否套 {@link OperatorOnly}，同样取 navigation 里的 {@code operatorOnly} 标记——
 * 侧栏过滤与路由兜底读同一份数据，不会出现「菜单藏了但 URL 能进」。
 *
 * <p>未登录一律跳登录页（错误码 UNAUTHENTICATED 的前端处理）。
 *
 * <p>阶段 1 交付的页面是登录、导入中心、配置中心三个，其余仍是占位页——
 * <b>业务对象页面属于阶段 2 起的范围</b>。
 */

/** 已实现的页面。占位页只发给还没做的那些，避免「做完了但路由还指着占位页」。 */
const IMPLEMENTED: Record<string, ComponentType> = {
  '/imports': ImportCenterPage,
  '/settings': SettingsPage,
};

export function AppRoutes() {
  const account = useAuthStore((state) => state.account);

  if (!account) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<AppShell />}>
        <Route path={DASHBOARD_PAGE.path} element={<DashboardShellPage />} />
        {ALL_PAGES.filter((page) => page.path !== DASHBOARD_PAGE.path).map((page) => {
          const Implemented = IMPLEMENTED[page.path];
          const element = Implemented ? <Implemented /> : <PlaceholderPage page={page} />;
          return (
            <Route
              key={page.path}
              path={page.path}
              element={page.operatorOnly ? <OperatorOnly>{element}</OperatorOnly> : element}
            />
          );
        })}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
