/**
 * 《设计文档 V2.0》4.1 的导航契约。
 *
 * <p>导航顺序按文档原文固定：总看板、AI需求、课程工作台、讲师与能力地图、培训运营地图、
 * 案例与组织覆盖｜任务、消息、评审、导入、配置。顺序参与视觉回归，不得调整。
 *
 * <p><b>路由沿用工程既有地址</b>（{@code /demands} 而不是文档 16.1 建议的 {@code /requirement}）。
 * 文档给的是推荐目录，而既有地址已经写进阶段 1／2 的验收报告与详情深链；改名要连带改
 * 那些记录。文档路由作为别名并存，见 {@link PAGE_ROUTE_ALIASES}，这样文档里
 * {@code /dashboard?fixture=1} 一类的示例仍可直接访问。
 */

import type { PageKey } from '@/shared/theme/designTokensV2';

export interface ShellNavItem {
  /** tokens-v2.css 里 [data-page] 的取值，同时是逐页壳层变量的键 */
  pageKey: PageKey;
  path: string;
  label: string;
  /** lucide 图标名。文档 0.3：图标统一来自 Lucide，禁止用 Emoji 代替功能图标 */
  icon: string;
  /** 分组分隔线画在这一项之前（4.1 导航顺序里的「｜」） */
  dividerBefore?: boolean;
  /** 仅运营账号可见（需求 13.8／13.9 页面性质，纪律 PMI-5） */
  operatorOnly?: boolean;
}

/**
 * 侧栏 11 项。
 *
 * <p><b>第 8 项的名字是「消息中心」，承载的内容是催办记录台账。</b>需求文档 13.2 在 V1.2
 * 把消息中心整节替换为催办记录台账：系统不发任何消息（MSG1），只记录催了谁、催什么、
 * 什么时候催的。设计文档 V2.0 的 P08 画的仍是旧的站内信收件箱（未读红点、送达回执、
 * 重新发送），那些能力命中一期不做清单第 4、5 项。
 *
 * <p>业务裁决：<b>沿用 P08 的三栏几何与壳层尺寸，界面标题用「消息中心」，内容语义是催办台账。</b>
 * 因此代码标识一律用 {@code escalation}（命名对照表：催办台账 = escalation，不用
 * message／notification），只有 {@code label} 和 {@code pageKey} 用 message ——
 * 前者是业务要的界面名，后者要与文档 4.2 的 {@code .page-message} 选择器对上。
 */
export const SHELL_NAV: ShellNavItem[] = [
  { pageKey: 'dashboard', path: '/', label: '总看板', icon: 'Gauge' },
  { pageKey: 'requirement', path: '/demands', label: 'AI需求', icon: 'Lightbulb' },
  { pageKey: 'course', path: '/courses', label: '课程工作台', icon: 'BookOpen' },
  { pageKey: 'instructor', path: '/lecturers', label: '讲师与能力地图', icon: 'Users' },
  { pageKey: 'training', path: '/trainings', label: '培训运营地图', icon: 'CalendarDays' },
  { pageKey: 'case', path: '/cases', label: '案例与组织覆盖', icon: 'Trophy' },
  { pageKey: 'task', path: '/tasks', label: '任务中心', icon: 'ListChecks', dividerBefore: true },
  { pageKey: 'message', path: '/escalations', label: '消息中心', icon: 'Bell' },
  { pageKey: 'review', path: '/reviews', label: '评审记录中心', icon: 'ClipboardCheck' },
];

/**
 * 导入中心与配置中心。
 *
 * <p>它们在 4.1 的导航顺序里，但没有对应的产品截图，因此不进 {@link SHELL_NAV}
 * 的 pageKey 体系 —— 没有截图就没有逐页壳层实测值，硬给一个 pageKey 会让人以为
 * 那两页也有视觉回归基线。
 */
export const SHELL_NAV_OPERATION = [
  { path: '/imports', label: '导入中心', icon: 'Upload', operatorOnly: true },
  { path: '/settings', label: '配置中心', icon: 'Settings', operatorOnly: true },
] as const;

/** 文档 5～13 章给出的路由 → 工程既有路由。仅为让文档示例地址可直接访问 */
export const PAGE_ROUTE_ALIASES: Record<string, string> = {
  '/dashboard': '/',
  '/requirement': '/demands',
  '/course': '/courses',
  '/instructor': '/lecturers',
  '/training': '/trainings',
  '/case': '/cases',
  '/task': '/tasks',
  '/message': '/escalations',
  '/review': '/reviews',
};

/** 页标题（4.1：标题在顶部栏左侧）。与侧栏文案一致，避免同一页两个名字 */
export const PAGE_TITLE: Record<PageKey, string> = {
  dashboard: '总看板',
  requirement: 'AI需求驾驶舱',
  course: '课程工作台',
  instructor: '讲师与能力地图',
  training: '培训运营地图',
  case: '案例与组织覆盖',
  task: '任务中心',
  message: '消息中心',
  review: '评审记录中心',
};

/** 4.1：默认日期区间。文档 0.3 禁止按当前时间改变状态，这个值参与视觉回归 */
export const DEFAULT_DATE_RANGE = { from: '2024-05-12', to: '2024-06-10' } as const;

/** 按路径反查 pageKey。详情深链（/demands/123）落到所属驾驶舱 */
export function resolvePageKey(pathname: string): PageKey | null {
  const exact = SHELL_NAV.find((item) => item.path === pathname);
  if (exact) return exact.pageKey;

  const prefixed = SHELL_NAV.filter(
    (item) => item.path !== '/' && pathname.startsWith(`${item.path}/`),
  ).sort((a, b) => b.path.length - a.path.length)[0];
  if (prefixed) return prefixed.pageKey;

  // 培训的两条深链不以 /trainings 开头（对象是计划与场次，路径按资源名）
  if (pathname.startsWith('/training-plans') || pathname.startsWith('/training-sessions')) {
    return 'training';
  }
  return null;
}
