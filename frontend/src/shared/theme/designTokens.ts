/**
 * Token 的 TypeScript 镜像，供 AntD 主题映射与单元测试引用。
 *
 * 唯一权威来源是《设计基础规范 V1.1》附录 A 与 tokens.css。
 * 本文件的值必须与 tokens.css 一致，改动时两处同改（附录 A.4：不允许在组件中硬编码规范外的数值）。
 */

export const brand = {
  50: '#E8EEFF',
  100: '#D6E0FF',
  200: '#B8C9FF',
  300: '#94ADFF',
  400: '#7594FF',
  /** 品牌识别色：Logo、插画、图表主序列、≥24px 标题。承载白字仅 3.45:1，不可用于主按钮底 */
  500: '#5B82FF',
  /** 交互主色：主按钮底、正文尺寸链接。承载白字 4.50:1 */
  600: '#4E70DB',
  700: '#3E5AB0',
  800: '#2E4385',
  900: '#1F2D59',
} as const;

export const neutral = {
  0: '#FFFFFF',
  50: '#F9FAFB',
  100: '#F5F7FA',
  200: '#E5E7EB',
  300: '#D2D6DC',
  400: '#ACB3BD',
  500: '#8A929E',
  600: '#667085',
  700: '#4B5563',
  800: '#333B47',
  900: '#1A1F29',
  ink: '#000000',
} as const;

export const semantic = {
  success: { bg: '#DCFCE7', solid: '#22C55E', text: '#178841', textOnBg: '#16803D' },
  warning: { bg: '#FEF3C7', solid: '#F59E0B', text: '#A46A07', textOnBg: '#986207' },
  danger: { bg: '#FEE2E2', solid: '#EF4444', text: '#D73D3D', textOnBg: '#BF3636' },
  info: { bg: '#E0F2FE', solid: '#0EA5E9', text: '#0B7DB1', textOnBg: '#0A74A3' },
} as const;

/**
 * 三色灯。灯色值与语义由需求文档 13.4.1a 锁定。
 *
 * 规则 VC2／WV1：灯色不得作为唯一识别载体，必须同时出现「图标 + 文字标签 + 天数」。
 * 蓝灯是「即将到期」的预警，不是健康态。
 */
export const warningLight = {
  BLUE: { solid: '#0EA5E9', bg: semantic.info.bg, label: '即将到期' },
  YELLOW: { solid: '#F59E0B', bg: semantic.warning.bg, label: '已逾期' },
  RED: { solid: '#EF4444', bg: semantic.danger.bg, label: '状态停滞' },
  NONE: { solid: neutral[600], bg: 'transparent', label: '健康' },
} as const;

export const radius = {
  xs: 4,
  /** 按钮、输入框、下拉框、分段控制器、Tab */
  sm: 6,
  md: 8,
  /** 卡片（默认）、弹窗、抽屉、空态容器 */
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const space = {
  '3xs': 2,
  '2xs': 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

/** 字号（px）。代码里用 rem，这里保留 px 供 AntD token 使用 */
export const fontSize = {
  h1: 32,
  h2: 24,
  h3: 18,
  h4: 16,
  bodyLg: 16,
  /** 正文与表格单元格默认 */
  body: 14,
  bodySm: 13,
  caption: 12,
  metric: 28,
  metricLg: 40,
} as const;

/**
 * 行高一律写成「规范给的行高 / 字号」，不写成小数。
 * 设计规范附录 B.1 明确 VI 页的 6 档字号／行高组合（32/48、24/36、18/28、14/22、12/18、28/36）
 * 属于「完全保留、不做改动」的部分，写成 1.5 这类小数会让后来人看不出它对应哪一档。
 */
export const lineHeight = {
  h1: 48 / 32,
  h2: 36 / 24,
  h3: 28 / 18,
  h4: 24 / 16,
  body: 22 / 14,
  bodySm: 20 / 13,
  caption: 18 / 12,
  metric: 36 / 28,
} as const;

export const layout = {
  headerHeight: 56,
  sidebarExpanded: 240,
  sidebarCollapsed: 64,
  contentPadding: 24,
  cardPadding: 24,
  filterBarHeight: 56,
  /** 基准 1440×900，<1440px 不适配（4.5） */
  minWidth: 1440,
} as const;

export const elevation = {
  0: 'none',
  1: '0 1px 2px 0 rgba(26,31,41,0.06)',
  2: '0 2px 8px 0 rgba(26,31,41,0.08)',
  3: '0 4px 16px 0 rgba(26,31,41,0.10)',
  4: '0 8px 32px 0 rgba(26,31,41,0.14)',
  sticky: '0 2px 4px 0 rgba(26,31,41,0.06)',
} as const;

export const fontFamily =
  "Inter, 'Noto Sans SC', 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif";
