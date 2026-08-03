import type { ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShellV2 } from './shell/AppShellV2';
import { PAGE_ROUTE_ALIASES } from './shell/shellNav';
import { DASHBOARD_PAGE, LEGACY_REDIRECTS, ROUTE_PAGES } from './navigation';
import { OperatorOnly } from './OperatorOnly';
import { LoginPage } from '@/pages/LoginPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { DashboardV2Page } from '@/pages/v2/DashboardV2Page';
import { DemandV2Page } from '@/pages/v2/DemandV2Page';
import { CourseV2Page } from '@/pages/v2/CourseV2Page';
import { LecturerV2Page } from '@/pages/v2/LecturerV2Page';
import { TrainingV2Page } from '@/pages/v2/TrainingV2Page';
import { CaseV2Page } from '@/pages/v2/CaseV2Page';
import { MessageV2Page } from '@/pages/v2/MessageV2Page';
import { ReviewV2Page } from '@/pages/v2/ReviewV2Page';
import { TaskV2Page } from '@/pages/v2/TaskV2Page';
import { replicaRoute } from '@/pages/v2/ReplicaRoute';
import { ImportCenterPage } from '@/pages/ImportCenterPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { DemandCockpitPage } from '@/pages/DemandCockpitPage';
import { CourseCockpitPage } from '@/pages/CourseCockpitPage';
import { LecturerCockpitPage } from '@/pages/LecturerCockpitPage';
import { TrainingCockpitPage } from '@/pages/TrainingCockpitPage';
import { CaseCockpitPage } from '@/pages/CaseCockpitPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { useAuthStore } from '@/shared/store/authStore';

/**
 * 路由表由 {@link ROUTE_PAGES} 生成，保证「导航菜单」与「路由」不会各自维护一份而走偏。
 * 运营专属页面是否套 {@link OperatorOnly}，同样取 navigation 里的 {@code operatorOnly} 标记——
 * 侧栏过滤与路由兜底读同一份数据，不会出现「菜单藏了但 URL 能进」。
 *
 * <p><b>驾驶舱主路径与它的详情深链指向同一个组件。</b>{@code /demands} 与 {@code /demands/123}
 * 都渲染 {@code DemandCockpitPage}，区别只是后者的 {@code useParams().id} 有值、右侧面板自动
 * 展开。这样「详情」就不是另一个页面，而是同一屏的一个区域——刷新、后退、复制链接都不需要
 * 单独处理。
 *
 * <p>未登录一律跳登录页（错误码 UNAUTHENTICATED 的前端处理）。
 *
 * <p>V2.0 九页复刻件已齐：总看板、五个驾驶舱、三中心。驾驶舱主路径默认走复刻件，
 * {@code ?legacy=1} 回到阶段 2 业务页；三中心没有旧业务页双轨。
 * 导入中心与配置中心仍是阶段 1 业务页。阶段 3／4 再把 fixtures 换成聚合接口。
 */

/** 已实现的页面。占位页只发给还没做的那些，避免「做完了但路由还指着占位页」。 */
const IMPLEMENTED: Record<string, ComponentType> = {
  '/imports': ImportCenterPage,
  '/settings': SettingsPage,
  /*
   * 双轨：驾驶舱主路径默认渲染《设计文档 V2.0》的复刻件，?legacy=1 回到阶段 2 的业务页。
   * 取舍见 replicaRoute 的注释——阶段 3 的聚合接口还不存在，业务页在没有后端时整页只有
   * 「加载失败」，而复刻件读 fixtures，面板是按设计稿长齐的。
   *
   * 详情深链（/demands/:id）不分派，始终是业务页：深链进来的人要的是能改数据的那一轨。
   */
  '/demands': replicaRoute(DemandCockpitPage, DemandV2Page),
  '/demands/:id': DemandCockpitPage,
  '/courses': replicaRoute(CourseCockpitPage, CourseV2Page),
  '/courses/:id': CourseCockpitPage,
  '/lecturers': replicaRoute(LecturerCockpitPage, LecturerV2Page),
  '/lecturers/:id': LecturerCockpitPage,
  '/trainings': replicaRoute(TrainingCockpitPage, TrainingV2Page),
  '/training-plans/:id': TrainingCockpitPage,
  '/training-sessions/:id': TrainingCockpitPage,
  '/cases': replicaRoute(CaseCockpitPage, CaseV2Page),
  '/cases/:id': CaseCockpitPage,
  // 三中心没有旧业务页双轨：直接承接 V2.0 复刻件（P08 语义是催办台账，见 V-1）。
  '/tasks': TaskV2Page,
  '/escalations': MessageV2Page,
  '/reviews': ReviewV2Page,
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
      <Route element={<AppShellV2 />}>
        <Route path={DASHBOARD_PAGE.path} element={<DashboardV2Page />} />

        {/* 并页前的旧地址。静态段优先级高于动态段，因此这些要排在 :id 之前也没关系——
            react-router v6 按路径特异性而不是声明顺序排名 */}
        {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
          <Route key={from} path={from} element={<Navigate to={to} replace />} />
        ))}

        {/* 设计文档 V2.0 第 5～13 章给每页写的路由（/dashboard、/requirement…）。
            工程沿用既有地址，这些作为别名并存，好让文档里的示例地址能直接访问。
            注意要带上 search，否则跳转会把 ?fixture=1 丢掉、视觉回归模式失效 */}
        {Object.entries(PAGE_ROUTE_ALIASES).map(([from, to]) => (
          <Route
            key={from}
            path={from}
            element={<Navigate to={{ pathname: to, search: window.location.search }} replace />}
          />
        ))}

        {ROUTE_PAGES.filter((page) => page.path !== DASHBOARD_PAGE.path).map((page) => {
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
