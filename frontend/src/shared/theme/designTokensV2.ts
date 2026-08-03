/**
 * tokens-v2.css 的 TypeScript 镜像，对应《设计文档 V2.0》第 2 章与 4.1／4.2。
 *
 * 供 AntD 主题映射、ECharts 配置与 Playwright 视觉回归断言引用。
 * 值必须与 tokens-v2.css 一致，改动时两处同改；tokensV2.test.ts 会逐条比对两个文件。
 *
 * 命名沿用文档的 Token 名（brandAction 而不是 brand600），这样出问题时能直接回查文档章节。
 */

/** 2.1 色彩 */
export const colorV2 = {
  brandPrimary: '#5B82FF',
  brandAction: '#3974FA',
  brandActionHover: '#2F67ED',
  brandActionActive: '#285BD9',
  brand50: '#F4F7FF',
  brand100: '#EAF0FF',

  textPrimary: '#101828',
  textSecondary: '#475467',
  textTertiary: '#667085',
  textPlaceholder: '#ACB3BD',

  bgPage: '#FFFFFF',
  bgMuted: '#F5F7FA',

  borderDefault: '#E5E7EB',
  borderLight: '#EEF1F5',

  success: '#22C55E',
  successBg: '#ECFDF3',
  warning: '#F59E0B',
  warningBg: '#FFF7E6',
  danger: '#EF4444',
  dangerBg: '#FFF1F0',
  info: '#0EA5E9',
  purple: '#8B5CF6',
} as const;

/*
 * 三色灯的 Token 不在这里，在 designTokens.ts 的 warningLight。
 *
 * 原先这里有一份 warningLightV2，四个灯色复用语义色、另抄了一份 label。
 * 它没有任何调用方，而 label 是业务语义、只能有一个来源 ——
 * 灯色语义刚被业务重新裁决过（蓝灯改为健康态、停滞并入红灯），
 * 如果两份 label 都还在，改一份漏一份的结果是界面与后端口径分叉，而且编译不报错。
 *
 * V2.0 的灯色色值与需求 13.4.1a 完全一致（#0EA5E9／#F59E0B／#EF4444），
 * 本来就没有「V2 版灯色」这回事。
 */

/** 2.2 字号／行高／字重。三元组一体，不要只取其中一个值用 */
export const typeV2 = {
  pageTitle: { size: 24, line: 36, weight: 600 },
  panelTitle: { size: 18, line: 28, weight: 600 },
  body: { size: 14, line: 22, weight: 400 },
  bodyMedium: { size: 14, line: 22, weight: 500 },
  table: { size: 13, line: 20, weight: 400 },
  caption: { size: 12, line: 18, weight: 400 },
  badge: { size: 12, line: 16, weight: 500 },
  kpi: { size: 28, line: 36, weight: 600 },
  kpiSmall: { size: 20, line: 28, weight: 600 },
} as const;

export const fontFamilyV2 = "Inter, 'Noto Sans SC', sans-serif";

/** 2.3 几何。间距「只允许此阶梯」，写死成元组便于测试断言越界值 */
export const spaceLadderV2 = [4, 8, 12, 16, 20, 24, 32] as const;

export const radiusV2 = {
  control: 8,
  card: 12,
  tag: 4,
} as const;

export const effectV2 = {
  border: `1px solid ${colorV2.borderDefault}`,
  shadowCard: '0 1px 2px rgba(16,24,40,.06)',
  shadowSelected: '0 4px 12px rgba(57,116,250,.16)',
  transition: '120ms cubic-bezier(.2,0,0,1)',
} as const;

export const zIndexV2 = {
  base: 0,
  sticky: 10,
  dropdown: 1000,
  drawer: 1100,
  modal: 1200,
  toast: 1300,
} as const;

/** 2.4 组件固定尺寸 */
export const sizeV2 = {
  controlHeight: 36,
  controlPadX: 16,
  controlGap: 8,
  compactHeight: 28,
  compactPadX: 10,
  inputPadX: 12,
  createButtonWidth: 78,
  createButtonHeight: 38,
  badgeHeight: 22,
  badgePadX: 8,
  navItemHeight: 40,
  navItemPadX: 12,
  navItemGap: 4,
  kpiIconPlate: 44,
  cardPad: 16,
  cardPadCompact: 12,
  panelGap: 12,
} as const;

/** 头像「仅这 5 档」（2.4）。传入其他值即为规范外尺寸 */
export const avatarSizesV2 = [24, 32, 40, 56, 64] as const;

/** 4.1 视觉回归基线视口 */
export const viewportV2 = { width: 1586, height: 992 } as const;

/** 3.3 Logo 显示盒。文档 0.1 定义的唯一品牌像素例外 */
export const logoBoxV2 = {
  slotHeight: 64,
  width: 148,
  height: 33,
  left: 16,
  top: 18,
  markWidth: 24,
  markHeight: 27,
  /** 小于这个宽度必须切换到 A02 标志，不得继续缩小横版字标（3.3） */
  minHorizontalWidth: 120,
} as const;

/** 逐页壳层键。与 tokens-v2.css 的 [data-page] 选择器、路由一一对应 */
export type PageKey =
  | 'dashboard'
  | 'requirement'
  | 'course'
  | 'instructor'
  | 'training'
  | 'case'
  | 'task'
  | 'message'
  | 'review';

export interface PageShell {
  /** 文档 4.1 的页编号，验收报告里按这个编号回查 */
  code: string;
  sidebarWidth: number;
  topbarHeight: number;
  contentX: number;
  contentWidth: number;
}

/**
 * 4.1／4.2 九页壳层实测值。
 *
 * 只在视觉回归模式生效。产品模式用 PRODUCT_SHELL 的统一值 ——
 * 文档 0.3 禁止把侧栏宽度重构为单一变量，16.2 又允许正式产品统一，
 * 两条并存的解法就是双轨：回归模式逐页覆盖，产品模式统一。
 */
export const PAGE_SHELL: Record<PageKey, PageShell> = {
  dashboard: { code: 'P01', sidebarWidth: 218, topbarHeight: 70, contentX: 242, contentWidth: 1320 },
  requirement: { code: 'P02', sidebarWidth: 198, topbarHeight: 61, contentX: 222, contentWidth: 1340 },
  course: { code: 'P03', sidebarWidth: 178, topbarHeight: 61, contentX: 198, contentWidth: 1364 },
  instructor: { code: 'P04', sidebarWidth: 222, topbarHeight: 50, contentX: 252, contentWidth: 1310 },
  training: { code: 'P05', sidebarWidth: 253, topbarHeight: 69, contentX: 273, contentWidth: 1289 },
  case: { code: 'P06', sidebarWidth: 196, topbarHeight: 62, contentX: 215, contentWidth: 1347 },
  task: { code: 'P07', sidebarWidth: 200, topbarHeight: 67, contentX: 224, contentWidth: 1338 },
  message: { code: 'P08', sidebarWidth: 199, topbarHeight: 69, contentX: 221, contentWidth: 1341 },
  review: { code: 'P09', sidebarWidth: 216, topbarHeight: 68, contentX: 242, contentWidth: 1320 },
};

export const PRODUCT_SHELL: Omit<PageShell, 'code'> = {
  sidebarWidth: 200,
  topbarHeight: 64,
  contentX: 224,
  contentWidth: 1338,
};

/** 3.1 资产清单。路径指向 normalize-design-assets.py 的产出 */
export const ASSETS = {
  A01: '/assets/brand/a01_logo_horizontal.png',
  A02: '/assets/brand/a02_logo_mark.png',
  A03: '/assets/illustrations/a03_global_coverage.png',
  A04: '/assets/illustrations/a04_data_growth.png',
  A05: '/assets/illustrations/a05_mobile_learning.png',
  A06: '/assets/illustrations/a06_data_analysis.png',
  A07: '/assets/illustrations/a07_collaboration.png',
  A08: '/assets/illustrations/a08_data_operations.png',
  A09: '/assets/illustrations/a09_profile.png',
  A10: '/assets/illustrations/a10_messaging.png',
  A11: '/assets/illustrations/a11_account_profile.png',
  A12: '/assets/illustrations/a12_calendar.png',
  A13: '/assets/illustrations/a13_no_result.png',
  A14: '/assets/heroes/a14_content_review_hero.png',
  A15: '/assets/heroes/a15_monitoring_hero.png',
  A16: '/assets/heroes/a16_training_hero.png',
  A17: '/assets/heroes/a17_ai_workspace_hero.png',
  A18: '/assets/heroes/a18_analytics_hero.png',
} as const;
