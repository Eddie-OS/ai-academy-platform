/**
 * 一期 24 个一级页面的唯一权威清单。
 *
 * 依据需求文档 V1.2 首页表：总看板 1 + 五驾驶舱 18 + 三中心 3 + 导入中心 1 + 配置中心 1 = 24。
 * 页面数从 25 降为 24 是因为案例驾驶舱的「组织覆盖视图」P5-4 已删除（N12），
 * 原 P5-5 总结报告页编号前移为 P5-4。
 *
 * 导航位置（需求文档 5.x 首页布局表 F 行）：三中心入口在<b>顶部导航</b>，其余在侧栏。
 */

export interface PageDef {
  /** 需求文档中的页面编号，便于提示词里精确引用 */
  code: string;
  path: string;
  title: string;
  /** 详情页不进侧栏，只登记路由 */
  inSidebar: boolean;
  /** 仅运营账号可见可用（需求 13.8、13.9 页面性质） */
  operatorOnly?: boolean;
}

export interface NavGroup {
  key: string;
  title: string;
  /** 图标名，取自 lucide（决策 D47：以开源图标库为基础） */
  icon: string;
  pages: PageDef[];
}

export const DASHBOARD_PAGE: PageDef = {
  code: 'P0',
  path: '/',
  title: '总看板',
  inSidebar: true,
};

export const COCKPIT_GROUPS: NavGroup[] = [
  {
    key: 'demand',
    title: '驾驶舱一 · AI需求图',
    icon: 'Lightbulb',
    pages: [
      { code: 'P1-1', path: '/demands', title: '需求列表', inSidebar: true },
      { code: 'P1-3', path: '/demands/overview', title: '需求态势图', inSidebar: true },
      { code: 'P1-2', path: '/demands/:id', title: '需求详情', inSidebar: false },
    ],
  },
  {
    key: 'course',
    title: '驾驶舱二 · 课程工作台',
    icon: 'BookOpen',
    pages: [
      { code: 'P2-1', path: '/courses', title: '课程列表', inSidebar: true },
      { code: 'P2-3', path: '/courses/state-map', title: '课程状态地图', inSidebar: true },
      { code: 'P2-4', path: '/courses/schedule', title: '课程排期日历', inSidebar: true },
      { code: 'P2-2', path: '/courses/:id', title: '课程详情', inSidebar: false },
    ],
  },
  {
    key: 'lecturer',
    title: '驾驶舱三 · 讲师图',
    icon: 'Users',
    pages: [
      { code: 'P3-1', path: '/lecturers', title: '讲师池', inSidebar: true },
      { code: 'P3-3', path: '/trials', title: '试讲台账', inSidebar: true },
      { code: 'P3-2', path: '/lecturers/:id', title: '讲师详情', inSidebar: false },
    ],
  },
  {
    key: 'training',
    title: '驾驶舱四 · 培训运营图',
    icon: 'CalendarDays',
    pages: [
      { code: 'P4-1', path: '/trainings/calendar', title: '培训排期日历', inSidebar: true },
      { code: 'P4-2', path: '/training-plans', title: '培训计划', inSidebar: true },
      { code: 'P4-3', path: '/training-plans/:id', title: '培训计划详情', inSidebar: false },
      { code: 'P4-4', path: '/training-sessions/:id', title: '培训场次详情', inSidebar: false },
    ],
  },
  {
    key: 'kase',
    title: '驾驶舱五 · 案例图',
    icon: 'Trophy',
    pages: [
      { code: 'P5-1', path: '/cases/dashboard', title: '案例数据看板', inSidebar: true },
      { code: 'P5-2', path: '/cases', title: '案例列表', inSidebar: true },
      { code: 'P5-4', path: '/case-reports', title: '总结报告', inSidebar: true },
      { code: 'P5-3', path: '/cases/:id', title: '案例详情', inSidebar: false },
    ],
  },
];

/**
 * 三中心。「审批中心」已按决策 D42 改名为「评审记录中心」——一期无审批引擎，
 * 原名会造成功能预期偏差；「消息中心」已按 C05 改为「催办记录台账」——系统不发送任何消息。
 */
export const CENTER_PAGES: PageDef[] = [
  { code: 'C-1', path: '/tasks', title: '任务中心', inSidebar: false },
  { code: 'C-2', path: '/escalations', title: '催办记录台账', inSidebar: false },
  { code: 'C-3', path: '/reviews', title: '评审记录中心', inSidebar: false },
];

export const OPERATION_PAGES: PageDef[] = [
  { code: 'S-1', path: '/imports', title: '导入中心', inSidebar: true, operatorOnly: true },
  { code: 'S-2', path: '/settings', title: '配置中心', inSidebar: true, operatorOnly: true },
];

/** 全部 24 个一级页面。骨架阶段用它生成路由与占位页。 */
export const ALL_PAGES: PageDef[] = [
  DASHBOARD_PAGE,
  ...COCKPIT_GROUPS.flatMap((group) => group.pages),
  ...CENTER_PAGES,
  ...OPERATION_PAGES,
];
