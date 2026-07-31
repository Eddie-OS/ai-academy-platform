import type { ReactNode } from 'react';
import { Button } from 'antd';
import { CircleAlert, Clock, TriangleAlert } from 'lucide-react';
import {
  elevation,
  fontSize,
  lineHeight,
  neutral,
  radius,
  semantic,
  space,
  warningLight,
} from '@/shared/theme/designTokens';

/**
 * 三色灯（设计规范 2.5、6.4；需求 13.4.1a）。
 *
 * <p>灯色取值不在这里手写，取自 {@link warningLight} 的键（纪律 STK-1）。
 * 蓝灯是「即将到期」这一级预警，<b>不是健康态</b>——健康是「不亮灯」。
 *
 * <p>把这四条规则写进类型与实现，而不是写进注释里让人自觉遵守：
 * <ul>
 *   <li>WV1：图标、文案、天数三者同时渲染，没有「只给一个色点」的调用方式；
 *   <li>WV2：四态图标形状互不相同（时钟／三角／实心圆／无图标）；
 *   <li>WV3：三种句式由 {@link warningLightText} 唯一产出，天数语义不可混用，
 *       且三个灯色的 {@code days} 在类型上是必填——漏传天数编译不过；
 *   <li>WV5：健康态中性灰底、无图标、不可下钻。
 * </ul>
 */

export type WarningLightColor = keyof typeof warningLight;
export type AlertColor = Exclude<WarningLightColor, 'NONE'>;

/** 三种天数的语义各不相同（WV3）：剩余／逾期／停滞不可互换。 */
const DAY_PHRASE: Record<AlertColor, string> = {
  BLUE: '剩余',
  YELLOW: '逾期',
  RED: '停滞',
};

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
export function warningLightText(color: AlertColor, days: number): string;
export function warningLightText(color: WarningLightColor, days?: number): string {
  if (color === 'NONE') {
    return warningLight.NONE.label;
  }
  return `${warningLight[color].label} · ${DAY_PHRASE[color]} ${days} 天`;
}

function LightIcon({ color, size }: { color: WarningLightColor; size: number }): ReactNode {
  const solid = warningLight[color].solid;
  switch (color) {
    case 'BLUE':
      return <Clock size={size} color={solid} aria-hidden />;
    case 'YELLOW':
      return <TriangleAlert size={size} color={solid} aria-hidden />;
    case 'RED':
      // 红灯是「实心圆感叹号」：填充圆底 + 白色感叹号，与黄灯的线性三角在形状与实心度上都不同
      return <CircleAlert size={size} color={neutral[0]} fill={solid} aria-hidden />;
    case 'NONE':
      // WV5：健康态无图标。但仍占 size 的位置，否则表格里三色灯列的文字会左右错位
      return <span style={{ display: 'inline-block', width: size, height: size }} aria-hidden />;
  }
}

type InlineProps = { variant?: 'inline' | 'badge' } & (
  | { color: 'NONE'; days?: never }
  | { color: AlertColor; days: number }
);

/**
 * 内联形态（表格三色灯列、详情页页头）与徽章形态（卡片、待办条目）。
 *
 * 两种形态只差一层浅底与内边距，组成部分完全一致，因此不拆成两个组件——
 * 拆开就会有一天其中一个漏掉天数。
 */
export function WarningLight(props: InlineProps) {
  const { color, variant = 'inline' } = props;
  const days = props.color === 'NONE' ? undefined : props.days;
  const text =
    props.color === 'NONE' ? warningLightText('NONE') : warningLightText(props.color, props.days);
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

type SummaryProps = {
  color: WarningLightColor;
  count: number;
  /** 副文案，如「距预计完成时间 3 天内」。四张卡各不相同，由调用方给 */
  caption: string;
  /** 健康卡不可下钻（WV5），因此这里给了也不会渲染链接 */
  onDrillDown?: () => void;
};

/**
 * 汇总形态：总看板预警区的四张卡（设计规范 6.4）。
 *
 * <p>健康卡承载的是最大的那个数字，因此卡片不设固定宽度、由栅格分配，避免数字折行。
 */
export function WarningSummaryCard({ color, count, caption, onDrillDown }: SummaryProps) {
  const drillable = color !== 'NONE' && onDrillDown !== undefined;

  return (
    <div
      data-testid="warning-summary-card"
      data-color={color}
      style={{
        background: color === 'NONE' ? HEALTH_BG : warningLight[color].bg,
        borderRadius: radius.lg,
        boxShadow: elevation[1],
        padding: space.lg,
        display: 'flex',
        flexDirection: 'column',
        gap: space.xs,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: space.xs,
          color: TEXT_ON_BG[color],
          fontSize: fontSize.body,
        }}
      >
        <LightIcon color={color} size={20} />
        {warningLight[color].label}
      </span>

      <span
        style={{
          color: TEXT_ON_BG[color],
          fontSize: fontSize.metric,
          lineHeight: lineHeight.metric,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {count}
      </span>

      <span style={{ color: neutral[600], fontSize: fontSize.caption }}>{caption}</span>

      {drillable && (
        <Button type="link" size="small" style={{ padding: 0, alignSelf: 'flex-start' }} onClick={onDrillDown}>
          查看明细
        </Button>
      )}
    </div>
  );
}
