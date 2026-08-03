import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronRight,
  CirclePlus,
  ClipboardCheck,
  Gauge,
  HelpCircle,
  Lightbulb,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Trophy,
  Upload,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ASSETS } from '@/shared/theme/designTokensV2';
import { useAuthStore } from '@/shared/store/authStore';
import { isRegressionMode } from '@/app/regressionMode';
import { PENDING_ESCALATION_TOTAL, PENDING_TASK_TOTAL } from '@/fixtures/shell';
import {
  DEFAULT_DATE_RANGE,
  PAGE_TITLE,
  SHELL_NAV,
  SHELL_NAV_OPERATION,
  resolvePageKey,
} from './shellNav';
import './AppShellV2.css';

/**
 * 图标名 → 组件。文档 0.3：图标统一来自 Lucide，stroke-width=1.8，默认 16px。
 * stroke-width 不是 Lucide 的默认值（默认 2），必须逐处显式传。
 */
const ICONS: Record<string, LucideIcon> = {
  Gauge,
  Lightbulb,
  BookOpen,
  Users,
  CalendarDays,
  Trophy,
  ListChecks,
  Bell,
  ClipboardCheck,
  Upload,
  Settings,
};

const ICON_SIZE = 16;
const ICON_STROKE = 1.8;

function NavIcon({ name }: { name: string }) {
  const Icon = ICONS[name];
  if (!Icon) return null;
  return (
    <span className="shell-nav-icon">
      <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
    </span>
  );
}

/** 侧栏角标计数。数值在 fixtures/shell.ts —— 总看板 R6 的标题计数读同一份 */
const FROZEN_NAV_BADGES: Partial<Record<string, number>> = {
  '/tasks': PENDING_TASK_TOTAL,
  '/escalations': PENDING_ESCALATION_TOTAL,
};

/**
 * 应用壳层（《设计文档 V2.0》第 4 章）。
 *
 * <p>九页共用这一个壳层，逐页差异全部走 CSS 变量：{@code data-page} 属性挂在最外层，
 * tokens-v2.css 依据它在视觉回归模式下覆盖侧栏宽度、顶栏高度与正文起点。文档 16.2
 * 要求的「所有页面使用同一个 AppShell，但 data-page 注入逐页 CSS 变量；不要把九个壳层值
 * 合并为平均数」，就是靠这一处实现的。
 *
 * <p><b>本组件不读业务数据。</b>页标题、日期区间与角标都来自壳层契约或 fixture，
 * 壳层里出现接口调用会让九页的截图基线互相干扰。
 */
export function AppShellV2() {
  const location = useLocation();
  const account = useAuthStore((state) => state.account);
  const [collapsed, setCollapsed] = useState(false);

  const isOperator = account?.operator ?? false;
  const regression = isRegressionMode();
  const pageKey = resolvePageKey(location.pathname);
  const displayName = account?.displayName ?? '张小北';
  const typeLabel = account?.typeLabel ?? '平台管理员';

  // 回归模式下侧栏恒为展开态：九组实测宽度都是展开态量出来的，
  // 收起态没有对应基线，收起后截图必然失败
  const sidebarCollapsed = regression ? false : collapsed;

  return (
    <div className="shell" data-page={pageKey ?? undefined}>
      <aside className="shell-sidebar">
        <div className="shell-logo">
          {sidebarCollapsed ? (
            <img className="shell-logo-mark" src={ASSETS.A02} alt="AI学院联合作战平台" />
          ) : (
            <img className="shell-logo-img" src={ASSETS.A01} alt="AI学院联合作战平台" />
          )}
        </div>

        <nav className="shell-nav" aria-label="主导航">
          {SHELL_NAV.map((item) => {
            const active = pageKey === item.pageKey;
            const badge = FROZEN_NAV_BADGES[item.path];
            return (
              <div key={item.path}>
                {item.dividerBefore && <div className="shell-nav-divider" />}
                <Link
                  to={item.path}
                  className="shell-nav-item"
                  // 文档 15.1：侧栏 click 后更新 aria-current。
                  // 选中态的视觉与无障碍状态共用这一个属性，不另设 className
                  aria-current={active ? 'page' : undefined}
                  title={item.label}
                >
                  <NavIcon name={item.icon} />
                  {!sidebarCollapsed && <span className="shell-nav-label">{item.label}</span>}
                  {!sidebarCollapsed && badge !== undefined && (
                    <span className="shell-nav-badge">{badge}</span>
                  )}
                </Link>
              </div>
            );
          })}

          {/* 文档 4.1 的导航顺序里只有一个「｜」，就是任务中心之前那一处。
              导入与配置另起一组是工程分类，用留白表示，再画一条线会读成第三个业务分组 */}
          <div className="shell-nav-gap" />
          {SHELL_NAV_OPERATION.filter((item) => !item.operatorOnly || isOperator).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="shell-nav-item"
              aria-current={location.pathname.startsWith(item.path) ? 'page' : undefined}
              title={item.label}
            >
              <NavIcon name={item.icon} />
              {!sidebarCollapsed && <span className="shell-nav-label">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="shell-user">
          <img className="shell-user-avatar" src={ASSETS.A09} alt="" />
          {!sidebarCollapsed && (
            <>
              <div className="shell-user-text">
                <div className="shell-user-name">{displayName}</div>
                {/* 共享账号下使用者需要随时确认自己在用哪个账号。
                    账号名与类型同名时（运营账号）只出一行——同一个词写两遍读不出第二行的用途 */}
                {typeLabel !== displayName && <div className="shell-user-role">{typeLabel}</div>}
              </div>
              <ChevronRight size={ICON_SIZE} strokeWidth={ICON_STROKE} color="var(--text-tertiary)" />
            </>
          )}
        </div>

        {!regression && (
          <button
            type="button"
            className="shell-collapse"
            aria-label={collapsed ? '展开菜单' : '收起菜单'}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <PanelLeftOpen size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            ) : (
              <>
                <PanelLeftClose size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                <span>收起菜单</span>
              </>
            )}
          </button>
        )}
      </aside>

      <div className="shell-main">
        <header className="shell-topbar">
          <div className="shell-page-title">
            {pageKey ? PAGE_TITLE[pageKey] : ''}
            <HelpCircle size={ICON_SIZE} strokeWidth={ICON_STROKE} color="var(--text-tertiary)" />
          </div>
          <ShellDateRange />

          <div className="shell-topbar-search">
            <ShellSearch />
          </div>

          <div className="shell-topbar-actions">
            <ShellIconAction
              icon={ListChecks}
              label="任务"
              to="/tasks"
              badge={PENDING_TASK_TOTAL}
            />
            <ShellIconAction
              icon={Bell}
              label="消息"
              to="/escalations"
              badge={PENDING_ESCALATION_TOTAL}
            />
            <ShellIconAction icon={ClipboardCheck} label="评审记录" to="/reviews" />
            <ShellCreateButton />
            <button type="button" className="shell-help" aria-label="帮助">
              <HelpCircle size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            </button>
          </div>
        </header>

        <main className="shell-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** 顶栏日期区间。文档 4.1 固定默认 2024-05-12～2024-06-10，禁止用当前日期 */
function ShellDateRange() {
  return (
    <div className="shell-date-range">
      <span>
        {DEFAULT_DATE_RANGE.from} ～ {DEFAULT_DATE_RANGE.to}
      </span>
      <CalendarDays size={14} strokeWidth={ICON_STROKE} color="var(--text-tertiary)" />
    </div>
  );
}

function ShellSearch() {
  return (
    <div className="shell-search">
      <Search size={ICON_SIZE} strokeWidth={ICON_STROKE} color="var(--text-tertiary)" />
      <input
        className="shell-search-input"
        type="search"
        placeholder="全局搜索（需求 / 课程 / 讲师 / 组织 / 案例…）"
        aria-label="全局搜索"
      />
      <kbd className="shell-search-kbd">⌘K</kbd>
    </div>
  );
}

function ShellIconAction({
  icon: Icon,
  label,
  to,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  to: string;
  badge?: number;
}) {
  return (
    <Link to={to} className="shell-action" title={label}>
      <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      <span>{label}</span>
      {badge !== undefined && <span className="shell-action-badge">{badge}</span>}
    </Link>
  );
}

/** 顶部新建按钮，固定 78×38、左图标 16px（2.4 组件固定尺寸） */
function ShellCreateButton() {
  return (
    <button type="button" className="shell-create">
      <CirclePlus size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      <span>新建</span>
    </button>
  );
}
