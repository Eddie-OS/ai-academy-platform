import type { ReactNode } from 'react';
import { Button } from 'antd';
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import {
  elevation,
  fontSize,
  lineHeight,
  neutral,
  radius,
  redLightReason,
  semantic,
  space,
  warningLight,
  RED_LIGHT_SUMMARY_LABEL,
  type RedLightReason,
} from '@/shared/theme/designTokens';

/**
 * 三色灯（设计规范 2.5、6.4；语义见 {@link warningLight} 的说明）。
 *
 * <p>灯色取值不在这里手写，取自 {@link warningLight} 的键（纪律 STK-1）。
 *
 * <p>现行口径下<b>蓝灯是健康态</b>（正常运行），红灯合并了「已逾期」与「状态停滞」
 * 两种成因。这与需求 13.4.1a 的原文不同，是业务裁决的结果，理由写在 warningLight 上。
 *
 * <p>把这四条规则写进类型与实现，而不是写进注释里让人自觉遵守：
 * <ul>
 *   <li>WV1：图标、文案、天数三者同时渲染，没有「只给一个色点」的调用方式；
 *   <li>WV2：四态图标形状互不相同（对号／三角／实心圆／无图标）；
 *   <li>WV3：句式由 {@link warningLightText} 唯一产出，天数语义不可混用，
 *       且三个灯色的 {@code days} 在类型上是必填——漏传天数编译不过；
 *   <li>红灯必须说明成因：{@code reason} 是必填，不许出现一个「不知道为什么红」的红灯。
 * </ul>
 */

export type WarningLightColor = keyof typeof warningLight;
export type AlertColor = Exclude<WarningLightColor, 'NONE'>;

/**
 * 天数的语义按灯色而定（WV3）：剩余／逾期／停滞不可互换。
 *
 * <p>红灯不在这张表里 —— 它的天数说法取决于成因，见 {@link redLightReason}。
 * 「逾期 5 天」和「停滞 5 天」是两个不同的数，从两个不同的时间点起算。
 */
const DAY_PHRASE: Record<Exclude<AlertColor, 'RED'>, string> = {
  BLUE: '剩余',
  YELLOW: '剩余',
};

function dayPhrase(color: AlertColor, reason?: RedLightReason): string {
  return color === 'RED' ? redLightReason[reason ?? 'OVERDUE'].dayPhrase : DAY_PHRASE[color];
}

function colorLabel(color: AlertColor, reason?: RedLightReason, short = false): string {
  const source = color === 'RED' ? redLightReason[reason ?? 'OVERDUE'] : warningLight[color];
  return short ? source.shortLabel : source.label;
}

const TEXT_ON_BG: Record<WarningLightColor, string> = {
  BLUE: semantic.info.textOnBg,
  YELLOW: semantic.warning.textOnBg,
  RED: semantic.danger.textOnBg,
  NONE: neutral[600],
};

const HEALTH_BG = neutral[100];

/**
 * 四态文案的唯一产出口。
 *
 * 这个函数存在的意义是让「句式」成为可被测试的单一实现：文案散落在各页面时，
 * 迟早会出现「已逾期 · 剩余 5 天」这种把天数语义搞反的组合，而它在界面上看不出错。
 */
export function warningLightText(color: 'NONE'): string;
export function warningLightText(color: 'BLUE' | 'YELLOW', days: number): string;
export function warningLightText(color: 'RED', days: number, reason: RedLightReason): string;
export function warningLightText(
  color: WarningLightColor,
  days?: number,
  reason?: RedLightReason,
): string {
  if (color === 'NONE') {
    return warningLight.NONE.label;
  }
  return `${colorLabel(color, reason)} · ${dayPhrase(color, reason)} ${days} 天`;
}

/**
 * 后端 {@code lightReason} → 成因键。
 *
 * <p>`WarningLightService.redReason` 回的是中文（「已逾期」／「状态停滞」），
 * 而本组件的 {@link RedLightReason} 是英文键。下面那个中文串是<b>接口载荷的取值</b>，
 * 不是 {@code redLightReason.OVERDUE.label} 那个展示文案 —— 两者当前恰好同字，
 * 但展示文案是设计可改的，拿它来比对接口值会在改文案的那天静默失配。
 *
 * <p>兜底是「停滞」而不是「逾期」：后端只在「已逾期」时回那一个值，其余红灯一律是停滞。
 * 兜到「逾期」会让一条剩余天数还是正数的行显示「已逾期」，同一行里自己打自己的脸。
 *
 * <p>这个映射<b>必须只有一处</b>。它曾经内联在 {@link WarningLightCell} 里，总看板
 * 于是自己写了一遍，写成了「红灯一律 STALLED」—— 真正逾期的对象在待办清单上被说成停滞，
 * 而两种成因的天数从不同时间点起算，读者无从发现这句话是错的。
 */
export function redLightReasonOf(lightReason: string | null | undefined): RedLightReason {
  return lightReason === '已逾期' ? 'OVERDUE' : 'STALLED';
}

function LightIcon({ color, size }: { color: WarningLightColor; size: number }): ReactNode {
  const solid = warningLight[color].solid;
  switch (color) {
    case 'BLUE':
      // 对号而不是时钟。蓝灯现在的语义是「正常运行」，时钟传达的是「在倒计时」，
      // 那是黄灯的活。WV2 只要求四态形状互异，不限定用哪个形状
      return <CircleCheck size={size} color={solid} aria-hidden />;
    case 'YELLOW':
      return <TriangleAlert size={size} color={solid} aria-hidden />;
    case 'RED':
      // 红灯是「实心圆感叹号」：填充圆底 + 白色感叹号，与黄灯的线性三角在形状与实心度上都不同
      return <CircleAlert size={size} color={neutral[0]} fill={solid} aria-hidden />;
    case 'NONE':
      // 无灯态无图标。但仍占 size 的位置，否则表格里三色灯列的文字会左右错位
      return <span style={{ display: 'inline-block', width: size, height: size }} aria-hidden />;
  }
}

type InlineProps = {
  variant?: 'inline' | 'badge';
  /**
   * 天数已由同一行的独立列给出，本组件只渲染图标与文字标签。
   *
   * <p><b>只有在同一行确实存在天数列时才允许传。</b>属性名刻意写得啰嗦，
   * 就是为了让误用在 code review 里一眼看出来 —— WV1 要求灯色不能是唯一识别载体，
   * 必须同时出现「图标 + 文字标签 + 天数」，三者缺一即不满足 WCAG AA。
   * 这个开关不是取消天数，而是声明天数在别处。
   *
   * <p>加它的原因是 V2.0 P01 的 R6 把「剩余天数」与「预警灯」拆成了两列（80px + 100px），
   * 预警灯列放不下重复一遍的天数：「即将到期 · 剩余 2 天」在 13px 下约 130px，会折行把行高顶高。
   */
  daysShownInSeparateColumn?: boolean;
  /**
   * 两字标签（正常／关注／逾期／停滞），给宽度极窄的表格列用。
   *
   * <p>唯一的使用场景是 V2.0 P02 需求表的灯色列 —— 42px，文档标注「必须照抄」。
   * 详见 designTokens 里 shortLabel 的说明：这不是为了省空间而牺牲可读性，
   * 而是「只放图标」会直接违反 VC2／WV1，两字是同时满足两边的唯一宽度。
   *
   * <p>正文、卡片、详情页一律不要用它 —— 那些地方放得下全称。
   */
  short?: boolean;
} & (
  | { color: 'NONE'; days?: never; reason?: never; daysShownInSeparateColumn?: never }
  // 天数在别处时必须**不传** days，而不是「传了也不显示」。
  // 允许传一个不显示的值，就会有人顺手塞个语义不对的数进来
  // （红灯要的是逾期或停滞天数，手边往往只有剩余天数），
  // 之后谁把这个开关去掉，界面立刻开始说谎
  | { color: 'BLUE' | 'YELLOW'; reason?: never; days: number; daysShownInSeparateColumn?: false }
  | { color: 'BLUE' | 'YELLOW'; reason?: never; days?: never; daysShownInSeparateColumn: true }
  // 红灯的成因是必填：合并「已逾期」与「状态停滞」两种成因之后，
  // 不写成因就等于让界面在两个都不对的说法里随机挑一个
  | { color: 'RED'; reason: RedLightReason; days: number; daysShownInSeparateColumn?: false }
  | { color: 'RED'; reason: RedLightReason; days?: never; daysShownInSeparateColumn: true }
);

/**
 * 文案分派。抽成函数是为了让判别联合的收窄在一处发生 ——
 * 内联三元表达式套三层之后，TypeScript 认不出 color 与 reason 的绑定关系。
 */
function lightText(props: InlineProps): string {
  const short = props.short ?? false;
  if (props.color === 'NONE') {
    return short ? warningLight.NONE.shortLabel : warningLightText('NONE');
  }
  // 天数在别处 → 只出标签；否则出「标签 · 天数」。short 只影响标签的长短，
  // 不影响要不要天数 —— 两个开关管两件事，不要合并
  if (props.daysShownInSeparateColumn) {
    return colorLabel(props.color, props.reason, short);
  }
  return props.color === 'RED'
    ? warningLightText('RED', props.days, props.reason)
    : warningLightText(props.color, props.days);
}

/**
 * 内联形态（表格三色灯列、详情页页头）与徽章形态（卡片、待办条目）。
 *
 * 两种形态只差一层浅底与内边距，组成部分完全一致，因此不拆成两个组件——
 * 拆开就会有一天其中一个漏掉天数。
 */
export function WarningLight(props: InlineProps) {
  // 判别联合要靠 props.xxx 收窄，解构出来的变量会丢掉与 color 的关联
  const { color, variant = 'inline' } = props;
  const days = props.days;
  const text = lightText(props);
  const isBadge = variant === 'badge';

  return (
    <span
      // 天数与语义都在文本里，屏幕阅读器读到的与视觉一致，不需要额外的 aria-label
      data-testid="warning-light"
      data-color={color}
      data-days={days}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: space['2xs'],
        color: TEXT_ON_BG[color],
        fontSize: fontSize.bodySm,
        lineHeight: lineHeight.bodySm,
        ...(isBadge
          ? {
              background: color === 'NONE' ? HEALTH_BG : warningLight[color].bg,
              borderRadius: radius.xs,
              padding: `${space['3xs']}px ${space.xs}px`,
            }
          : null),
      }}
    >
      <LightIcon color={color} size={12} />
      {text}
    </span>
  );
}

/** 预警卡里的示例对象。{@code type} 是对象类型（需求／课程／讲师／培训／案例） */
export interface WarningSample {
  id: string;
  type: string;
}

type SummaryProps = {
  color: WarningLightColor;
  /** 产品模式接口未回时为 null，渲染「—」而不是 0（设计规范 3.3） */
  count: number | null;
  /** 副文案，如「距预计完成时间 3 天内」。三张卡各不相同，由调用方给 */
  caption: string;
  /** 无灯态不可下钻——它不是一类预警，没有明细可看。给了也不会渲染链接 */
  onDrillDown?: () => void;
  /**
   * 示例对象，最多三条。
   *
   * <p>它解决的是「128 是什么」这个问题：只给一个数字，运营得点进明细页才知道
   * 里面装的是需求还是课程。三条样例让这张卡自己把话说完。
   */
  samples?: WarningSample[];
  /** 「更多（N）」里的 N。等于 count 减去已展示的样例数，由调用方算好 */
  moreCount?: number;
  onMore?: () => void;
  /**
   * 一键催办。<b>系统不发任何消息</b>（MSG1）——点它是往催办台账写一条记录，
   * 记下催办对象、内容与时间。文案叫「催办」而不是「通知」正是这个原因。
   */
  onUrge?: () => void;
  /**
   * 紧凑排版。P01 预警区只有 499×282，三张卡各 150×207，
   * 用默认字号阶梯装不下「色名 + 数字 + 副文案 + 三条样例 + 更多 + 按钮」七块内容。
   */
  compact?: boolean;
};

/**
 * 汇总形态：总看板预警区的三张卡（设计规范 6.4）。
 *
 * <p>现行口径下预警区是<b>三张</b>而不是四张：蓝灯即健康态，
 * 原先那张单独的「健康对象数」卡与蓝灯卡讲的是同一件事，已按业务裁决去掉。
 *
 * <p>红灯卡的标题不是「已逾期」而是 {@link RED_LIGHT_SUMMARY_LABEL}：
 * 这个数聚合了逾期与停滞两种成因，只写一种会让人以为另一种没被算进去。
 * 这不需要调用方选择 —— 汇总永远聚合，明细行永远分成因。
 *
 * <p>卡片不设固定宽度、由栅格分配，避免数字折行。
 */
export function WarningSummaryCard({
  color,
  count,
  caption,
  onDrillDown,
  samples,
  moreCount,
  onMore,
  onUrge,
  compact = false,
}: SummaryProps) {
  const drillable = color !== 'NONE' && onDrillDown !== undefined;
  const label = color === 'RED' ? RED_LIGHT_SUMMARY_LABEL : warningLight[color].label;
  const solid = warningLight[color].solid;

  return (
    <div
      data-testid="warning-summary-card"
      data-color={color}
      style={{
        background: color === 'NONE' ? HEALTH_BG : warningLight[color].bg,
        borderRadius: radius.lg,
        boxShadow: elevation[1],
        padding: compact ? space.sm : space.lg,
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? space['2xs'] : space.xs,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: space['2xs'],
          color: TEXT_ON_BG[color],
          fontSize: compact ? fontSize.caption : fontSize.body,
          lineHeight: lineHeight.caption,
        }}
      >
        <LightIcon color={color} size={compact ? 14 : 20} />
        {label}
      </span>

      <span
        style={{
          color: TEXT_ON_BG[color],
          // 紧凑档不用 fontSize.metric（28/36）：150px 宽的卡里 28px 数字加上
          // 七块内容会超出 207px 的卡高。24/30 是能同时容下七块的最大一档
          fontSize: compact ? 24 : fontSize.metric,
          lineHeight: compact ? '30px' : lineHeight.metric,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {/* 3.3：千分位。锁死 en-US 而不是跟随浏览器语言：
            zh-CN 在部分环境下会输出不同的分组方式，那会让视觉基线在不同机器上不一致 */}
        {count == null ? '—' : count.toLocaleString('en-US')}
      </span>

      <span
        style={{
          color: neutral[600],
          fontSize: compact ? 11 : fontSize.caption,
          lineHeight: compact ? '15px' : lineHeight.caption,
        }}
      >
        {caption}
      </span>

      {samples !== undefined && samples.length > 0 && (
        <div style={{ marginTop: space['3xs'] }}>
          <div
            style={{
              color: neutral[600],
              fontSize: 11,
              lineHeight: '15px',
              marginBottom: space['3xs'],
            }}
          >
            示例对象
          </div>
          {samples.map((sample) => (
            <div
              key={sample.id}
              data-testid="warning-sample"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: space['3xs'],
                fontSize: 11,
                lineHeight: '16px',
                color: neutral[700],
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  fontVariantNumeric: 'tabular-nums',
                }}
                title={sample.id}
              >
                {sample.id}
              </span>
              <span style={{ flex: '0 0 auto', color: solid }}>{sample.type}</span>
            </div>
          ))}
        </div>
      )}

      {/* 三块底部内容整体压到卡片底部：三张卡的样例条数相同，但副文案的行数可能不同，
          不贴底会让三个按钮高低不齐 */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: space['3xs'] }}>
        {moreCount !== undefined && onMore !== undefined && (
          <Button
            type="link"
            size="small"
            data-testid="warning-more"
            style={{
              padding: 0,
              alignSelf: 'flex-start',
              height: 'auto',
              fontSize: 11,
              color: solid,
            }}
            onClick={onMore}
          >
            {`更多（${moreCount.toLocaleString('en-US')}）`}
          </Button>
        )}

        {onUrge !== undefined && (
          <Button
            size="small"
            data-testid="warning-urge"
            style={{
              height: compact ? 24 : 28,
              fontSize: compact ? 11 : fontSize.bodySm,
              borderColor: solid,
              color: solid,
              background: 'transparent',
            }}
            onClick={onUrge}
          >
            一键催办
          </Button>
        )}

        {drillable && (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, alignSelf: 'flex-start', height: 'auto' }}
            onClick={onDrillDown}
          >
            查看明细
          </Button>
        )}
      </div>
    </div>
  );
}
