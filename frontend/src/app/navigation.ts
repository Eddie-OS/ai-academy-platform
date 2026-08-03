/**
 * 侧栏导航与路由的唯一权威清单。
 *
 * <h3>为什么这里是 11 个入口而需求文档写的是 24 个页面</h3>
 *
 * 需求文档 8.2／9.2／11.2 把每个驾驶舱写成「列表页 + 详情页 + 态势图页」，一期合计 24 个
 * 一级页面。《平台驾驶舱全景》10 张设计稿把同一批内容画成了**每个驾驶舱一整屏**：顶部指标卡、
 * 中部左列表右详情面板、底部分析区，侧栏是扁平的 11 项。
 *
 * <p>二者不冲突：需求文档那 24 项是**内容清单**，设计稿定的是**内容怎么组合**。一项内容都
 * 没少，只是不再各占一个路由。因此本文件保留 {@link CockpitDef.views} 逐条登记「这一屏里
 * 装了需求文档的哪几页」，验收时按编号回查；而 {@link CockpitDef.detailPaths} 保留原来的
 * 详情深链——{@code /demands/123} 仍然可用，只是它渲染的是需求驾驶舱页并自动展开右侧面板，
 * 收藏夹里的旧链接不会失效。
 *
 * <p><b>侧栏名字取设计稿的叫法</b>（「AI需求」而不是「驾驶舱一 · AI需求图」）：二级菜单取消后
 * 「驾驶舱一」这个前缀不再有区分作用，只是占掉一半宽度。
 *
 * <p>导航位置（需求文档首页布局表 F 行）：三中心入口在顶部导航；设计稿在侧栏也放了一份，
 * 两处都保留。
 */

export interface PageDef {
  /** 需求文档中的页面编号，便于提示词与验收报告里精确引用 */
  code: string;
  path: string;
  title: string;
  /** 详情页不进侧栏，只登记路由 */
  inSidebar: boolean;
  /** 仅运营账号可见可用（需求 13.8、13.9 页面性质） */
  operatorOnly?: boolean;
}

export interface CockpitDef {
  key: string;
  /** 驾驶舱主路径，即侧栏点进去落到的地址 */
  path: string;
  /** 侧栏与页头标题 */
  title: string;
  /** 图标名，取自 lucide（决策 D47：以开源图标库为基础） */
  icon: string;
  /** 这一屏承载了需求文档的哪几个页面。仅用于溯源，不生成路由 */
  views: PageDef[];
  /**
   * 详情深链。命中时渲染同一个驾驶舱页并把右侧面板打开在该对象上。
   * 路径里的参数名必须是 {@code id}，各驾驶舱页统一按 {@code useParams().id} 取。
   */
  detailPaths: string[];
}

export const DASHBOARD_PAGE: PageDef = {
  code: 'P0',
  path: '/',
  title: '总看板',
  inSidebar: true,
};

/**
 * 五个驾驶舱。
 *
 * <p>案例驾驶舱在设计稿里叫「案例与组织覆盖」，这里不用那个名字：组织覆盖视图（原 P5-4）、
 * 部门覆盖热力图与 15.4 的 10 个覆盖类指标已随 N18 在需求 V1.2 整体删除，沿用设计稿的名字
 * 等于在侧栏承诺一个不存在的模块。
 */
export const COCKPITS: CockpitDef[] = [
  {
    key: 'demand',
    path: '/demands',
    title: 'AI需求',
    icon: 'Lightbulb',
    views: [
      { code: 'P1-1', path: '/demands', title: '需求列表', inSidebar: true },
      { code: 'P1-2', path: '/demands/:id', title: '需求详情', inSidebar: false },
      { code: 'P1-3', path: '/demands/overview', title: '需求态势图', inSidebar: false },
    ],
    detailPaths: ['/demands/:id'],
  },
  {
    key: 'course',
    path: '/courses',
    title: '课程工作台',
    icon: 'BookOpen',
    views: [
      { code: 'P2-1', path: '/courses', title: '课程列表', inSidebar: true },
      { code: 'P2-2', path: '/courses/:id', title: '课程详情', inSidebar: false },
      { code: 'P2-3', path: '/courses/state-map', title: '课程状态地图', inSidebar: false },
      { code: 'P2-4', path: '/courses/schedule', title: '课程排期日历', inSidebar: false },
    ],
    detailPaths: ['/courses/:id'],
  },
  {
    key: 'lecturer',
    path: '/lecturers',
    title: '讲师与能力地图',
    icon: 'Users',
    views: [
      { code: 'P3-1', path: '/lecturers', title: '讲师池', inSidebar: true },
      { code: 'P3-2', path: '/lecturers/:id', title: '讲师详情', inSidebar: false },
      { code: 'P3-3', path: '/trials', title: '试讲台账', inSidebar: false },
    ],
    detailPaths: ['/lecturers/:id'],
  },
  {
    key: 'training',
    path: '/trainings',
    title: '培训运营地图',
    icon: 'CalendarDays',
    views: [
      { code: 'P4-1', path: '/trainings/calendar', title: '培训排期日历', inSidebar: false },
      { code: 'P4-2', path: '/training-plans', title: '培训计划列表', inSidebar: false },
      { code: 'P4-3', path: '/training-plans/:id', title: '培训计划详情', inSidebar: false },
      { code: 'P4-4', path: '/training-sessions/:id', title: '培训场次详情', inSidebar: false },
    ],
    // 两级对象各有一条深链：计划展开的是计划面板，场次展开的是场次面板
    detailPaths: ['/training-plans/:id', '/training-sessions/:id'],
  },
  {
    key: 'kase',
    path: '/cases',
    title: '案例图',
    icon: 'Trophy',
    views: [
      { code: 'P5-1', path: '/cases/dashboard', title: '案例数据看板', inSidebar: false },
      { code: 'P5-2', path: '/cases', title: '案例列表', inSidebar: true },
      { code: 'P5-3', path: '/cases/:id', title: '案例详情', inSidebar: false },
      { code: 'P5-4', path: '/case-reports', title: '总结报告', inSidebar: false },
    ],
    detailPaths: ['/cases/:id'],
  },
];

/**
 * 三中心。
 *
 * <p>「审批中心」已按决策 D42 改名为「评审记录中心」——一期无审批引擎，原名会造成功能预期偏差。
 *
 * <p><b>设计稿第 8 张「消息中心」整页不实现。</b>那一页画的是发送记录、送达成功／失败、
 * 重新发送与 WeLink／站内信／公众号三个渠道，命中一期不做清单第 4、5 项（全部消息渠道、
 * 消息发送状态与回执）。对应位置放的是「催办记录台账」：系统不发任何消息，只记录
 * 催了谁、催的什么、什么时候催的（需求 13.2.1）。
 */
export const CENTER_PAGES: PageDef[] = [
  { code: 'C-1', path: '/tasks', title: '任务中心', inSidebar: true },
  { code: 'C-2', path: '/escalations', title: '催办记录台账', inSidebar: true },
  { code: 'C-3', path: '/reviews', title: '评审记录中心', inSidebar: true },
];

export const OPERATION_PAGES: PageDef[] = [
  { code: 'S-1', path: '/imports', title: '导入中心', inSidebar: true, operatorOnly: true },
  { code: 'S-2', path: '/settings', title: '配置中心', inSidebar: true, operatorOnly: true },
];

/**
 * 需要生成路由的全部地址。
 *
 * <p>驾驶舱主路径 + 各自的详情深链 + 三中心 + 两个运营页 + 总看板。
 * 驾驶舱内的 {@code views} <b>不再单独生成路由</b>：态势图、状态地图、排期日历都已经并进
 * 驾驶舱页，再留一条独立路由就会有两份实现各自演化。
 */
export const ROUTE_PAGES: PageDef[] = [
  DASHBOARD_PAGE,
  ...COCKPITS.flatMap((cockpit) => [
    { code: cockpit.key, path: cockpit.path, title: cockpit.title, inSidebar: true },
    ...cockpit.detailPaths.map((path) => ({
      code: `${cockpit.key}-detail`,
      path,
      title: cockpit.title,
      inSidebar: false,
    })),
  ]),
  ...CENTER_PAGES,
  ...OPERATION_PAGES,
];

/**
 * 并页前的旧地址 → 现在的落点。
 *
 * <p>态势图、状态地图、排期日历、试讲台账原本各占一个路由，现在是所在驾驶舱页里的一个区域。
 * 这些地址已经出现在阶段 2 三份自检报告与验收记录里，直接 404 会让那些记录变成断链；
 * 而落到「页面不存在」也解释不了「东西还在，只是换了位置」。
 *
 * <p>静态段的优先级高于动态段，因此 {@code /courses/state-map} 会先命中这里的重定向，
 * 不会被 {@code /courses/:id} 当成 id 为「state-map」的课程。
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
  '/demands/overview': '/demands',
  '/courses/state-map': '/courses',
  '/courses/schedule': '/courses',
  '/trainings/calendar': '/trainings',
  '/training-plans': '/trainings',
  '/trials': '/lecturers',
  '/cases/dashboard': '/cases',
  '/case-reports': '/cases',
};

/** 需求文档口径的一期页面清单，供占位页与验收报告溯源。 */
export const REQUIREMENT_PAGES: PageDef[] = [
  DASHBOARD_PAGE,
  ...COCKPITS.flatMap((cockpit) => cockpit.views),
  ...CENTER_PAGES,
  ...OPERATION_PAGES,
];
