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
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ASSETS } from '@/shared/theme/designTokensV2';
import { useAuthStore } from '@/shared/store/authStore';
import { isRegressionMode } from '@/app/regressionMode';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { PENDING_ESCALATION_TOTAL, PENDING_TASK_TOTAL } from '@/fixtures/shell';
import {
  DEFAULT_DATE_RANGE,
  PAGE_TITLE,
  SHELL_NAV,
  SHELL_NAV_OPERATION,
  resolveDocumentTitle,
  resolvePageKey,
} from './shellNav';
import { requestShellCreate } from './shellCreate';
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

/** 跳过导航的落点。锚点与 main 的 id 必须同一个常量，改一处漏一处就是死链 */
const MAIN_CONTENT_ID = 'shell-content';

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

  useEffect(() => {
    document.title = resolveDocumentTitle(location.pathname);
  }, [location.pathname]);

  // 回归模式下侧栏恒为展开态：九组实测宽度都是展开态量出来的，
  // 收起态没有对应基线，收起后截图必然失败
  const sidebarCollapsed = regression ? false : collapsed;

  return (
    /*
     * data-collapsed 是收起态的唯一开关：tokens-v2.css 依据它把 --sidebar-w 与
     * --content-x 一起换成收起档。这两个变量必须同时换 —— 正文的左内边距是
     * calc(--content-x - --sidebar-w)，只改侧栏宽度的话内边距会等量变大，
     * 正文一步不动，侧栏与正文之间空出一条 136px 的白带。
     *
     * 收起态由 CSS 变量而不是 React 条件类名承载，因为受影响的是壳层<b>栅格</b>，
     * 九页共用；写成组件内联样式时，凡是读 --content-x 定位的元素都要各自再算一遍。
     */
    <div
      className="shell"
      data-page={pageKey ?? undefined}
      data-collapsed={sidebarCollapsed ? 'true' : undefined}
    >
      {/* SC 2.4.1：侧栏 11 项在每个页面前面，键盘使用者不该每次都 Tab 一遍才进正文。
          它必须是 DOM 里第一个可聚焦元素，位置错了就等于没做 */}
      <a className="shell-skip-link" href={`#${MAIN_CONTENT_ID}`}>
        跳至主内容
      </a>

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

          <div className="shell-topbar-search">{regression && <ShellSearch />}</div>

          <div className="shell-topbar-actions">
            {!regression && <ShellSearchToggle />}
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
            {/* 需求与课程的登记入口在筛选行，顶栏再放一颗空「新建」会被当成第二个入口。 */}
            {pageKey !== 'requirement' && pageKey !== 'course' && <ShellCreateButton />}
            <button type="button" className="shell-help" aria-label="帮助">
              <HelpCircle size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            </button>
          </div>
        </header>

        {/* tabIndex=-1 是跳过导航能生效的前提：<main> 默认不可聚焦，
            光有 id 时回车只滚动页面、焦点仍留在链接上，下一次 Tab 又回到侧栏 */}
        <main className="shell-content" id={MAIN_CONTENT_ID} tabIndex={-1}>
          {/* 屏障放在正文里而不是壳层外：某一页崩了，侧栏与顶栏仍可用，
              运营能直接切到别的驾驶舱。resetKey 传 pathname，换页即自动恢复 */}
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
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

/**
 * 产品模式的全局搜索：顶栏只留放大镜，点开后再展开输入框。
 * 回归模式仍走 {@link ShellSearch}，九页顶栏几何钉在居中那条 360px 搜索框上。
 */
function ShellSearchToggle() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div className="shell-search-toggle" data-open={open} ref={rootRef}>
      <div className="shell-search-expand">
        <input
          ref={inputRef}
          className="shell-search-input"
          type="search"
          placeholder="搜索需求 / 课程 / 讲师 / 组织 / 案例…"
          aria-label="全局搜索"
          aria-hidden={!open}
          tabIndex={open ? 0 : -1}
        />
      </div>
      <button
        type="button"
        className="shell-search-icon"
        aria-label={open ? '收起全局搜索' : '打开全局搜索'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Search size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      </button>
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
    <button type="button" className="shell-create" onClick={requestShellCreate}>
      <CirclePlus size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      <span>新建</span>
    </button>
  );
}
