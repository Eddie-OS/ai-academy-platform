import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ALL_PAGES, DASHBOARD_PAGE } from './navigation';
import { LoginPage } from '@/pages/LoginPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { DashboardShellPage } from '@/pages/DashboardShellPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { useAuthStore } from '@/shared/store/authStore';

/**
 * 路由表由 {@link ALL_PAGES} 生成，保证「导航菜单」与「路由」不会各自维护一份而走偏。
 *
 * 未登录一律跳登录页（错误码 UNAUTHENTICATED 的前端处理）。
 */
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
        {ALL_PAGES.filter((page) => page.path !== DASHBOARD_PAGE.path).map((page) => (
          <Route key={page.path} path={page.path} element={<PlaceholderPage page={page} />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
