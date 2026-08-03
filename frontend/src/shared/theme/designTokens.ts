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
 * 三色灯。色值沿用需求 13.4.1a，**语义已由业务重新裁决**（见 docs/文档待修清单.md V-9）。
 *
 * <h3>现行口径</h3>
 *
 * | 灯 | 语义 | 判定依据 |
 * |---|---|---|
 * | 蓝 | 正常运行 | 距预计完成时间尚有余量 |
 * | 黄 | 需要关注 | 临近预计完成时间 |
 * | 红 | 已逾期 **或** 状态停滞 | 超过预计完成时间 ／ `last_state_changed_at` 长期未变 |
 *
 * <h3>与需求 13.4.1a 的差别，以及为什么不是笔误</h3>
 *
 * 需求原文是「蓝=即将到期、黄=已逾期、红=状态停滞」，蓝灯是预警而非健康态。
 * 业务改成了更符合红绿灯直觉的三档：正常 → 需要关注 → 出问题。
 * 连带两个后果，都是有意的：
 *
 * <ul>
 * <li><b>蓝灯成了健康态，预警区不再有第四张「健康对象数」卡。</b>两者讲的是同一件事。</li>
 * <li><b>「状态停滞」并入红灯</b>，用 {@link redLightReason} 区分文案。
 *     停滞按 `last_state_changed_at` 算、逾期按预计完成时间算，是两个独立判定，
 *     合并的只是<b>灯色</b>，不是判定 —— 停滞判定一旦丢掉，催办与九个效率指标就同时失去依据。</li>
 * </ul>
 *
 * <p>需求 13.4.1a 的修订单已记入待修清单；`aggregate/warning`（阶段 3）直接按本口径实现。
 *
 * <p>规则 VC2／WV1 不变：灯色不得作为唯一识别载体，必须同时出现「图标 + 文字标签 + 天数」。
 */
export const warningLight = {
  BLUE: { solid: '#0EA5E9', bg: semantic.info.bg, label: '正常运行', shortLabel: '正常' },
  YELLOW: { solid: '#F59E0B', bg: semantic.warning.bg, label: '需要关注', shortLabel: '关注' },
  // 红灯的 label 是两种成因里的默认值，实际文案取 redLightReason
  RED: { solid: '#EF4444', bg: semantic.danger.bg, label: '已逾期', shortLabel: '逾期' },
  // 无灯 ≠ 健康。健康态现在是蓝灯；无灯表示这个对象压根没有预计完成时间，算不出灯
  NONE: { solid: neutral[600], bg: 'transparent', label: '无预警', shortLabel: '—' },
} as const;

/**
 * 红灯的两种成因。
 *
 * <p>两者的天数说的不是一回事：逾期天数从预计完成时间往后数，
 * 停滞天数从 `last_state_changed_at` 往后数。共用一句「红 N 天」会把两个指标混成一个。
 */
export const redLightReason = {
  OVERDUE: { label: '已逾期', shortLabel: '逾期', dayPhrase: '逾期' },
  STALLED: { label: '状态停滞', shortLabel: '停滞', dayPhrase: '停滞' },
} as const;

/*
 * shortLabel 存在的原因，以及它为什么不是「又一份 label」
 *
 * V2.0 P02 的需求表把灯色列钉死在 42px（文档标注「必须照抄」）。
 * 「正常运行」四个字在 12px 下要 48px，加图标 12px 就是 64px，放不进去。
 * 而 VC2／WV1 说得很硬：任何位置出现无文字标签的纯色状态点，该处即不满足 WCAG AA，
 * 所以「只放图标」不是一个选项。
 *
 * 两个字（24px）+ 图标（12px）+ 间距（4px）= 40px，正好进得去 42px。
 * 于是 42px 的列宽与 WCAG AA 同时成立，这不是取舍。
 *
 * 关键是 shortLabel 与 label 在<b>同一个对象里</b>：改语义时两个值挨着，漏改一个会很显眼。
 * 上一轮删掉的 warningLightV2 是另一回事——那是同一个语义在两个文件里各存一份。
 */

export type RedLightReason = keyof typeof redLightReason;

/**
 * 预警区汇总卡上红灯的标题。
 *
 * <p>汇总卡统计的是<b>两种成因之和</b>，因此不能只写「已逾期」——那会让人以为
 * 停滞的对象没被算进这个数，进而去别处找第二个数字。
 * 这个值是定死的、不需要调用方选择：汇总卡永远聚合，明细行永远分成因。
 *
 * <p>省掉「已」字是为了排版：总看板预警区三张卡横排后每张只有约 157px 宽，
 * 「已逾期或停滞」会折成两行。五个字刚好单行放下，而两种成因都还说得清。
 */
export const RED_LIGHT_SUMMARY_LABEL = '逾期或停滞';

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
