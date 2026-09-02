import type { CSSProperties, ReactNode } from 'react';
import { Card, Tooltip, Typography } from 'antd';
import { Info } from 'lucide-react';
import { AnimatedNumber } from '@/shared/ui/AnimatedNumber/AnimatedNumber';
import {
  brand,
  fontSize,
  lineHeight,
  neutral,
  radius,
  space,
} from '@/shared/theme/designTokens';
import './CockpitLayout.css';

const { Text } = Typography;

/**
 * 驾驶舱顶部的指标卡行（设计稿每张驾驶舱稿的第一段）。
 *
 * <p><b>阶段 2 只交付版式，不交付数字。</b>设计稿上这排卡片写的是 54 个指标里的若干个，
 * 而指标口径、三色灯阈值、环比区间全部属于阶段 3 的 {@code aggregate/metrics}。此刻
 * 在前端各页各算一遍的后果不是「数字暂时不准」，而是阶段 3 上线后同一个指标有两套算法，
 * 且其中一套不受配置中心的阈值影响——那种错会在总看板与驾驶舱对不上时才被发现。
 *
 * <p>因此未接入的卡片显式渲染成 {@code pending} 形态：位置、宽度、字号与最终形态完全一致，
 * 数字位显示「—」并标注「阶段 3 接入」。<b>不显示 0</b>：设计规范 3.3 规定零值显示 0、
 * 「—」才表示无数据，把未接入渲染成 0 会被读成「这个驾驶舱一条数据都没有」。
 */

export interface MetricCardSpec {
  key: string;
  /** 指标名，取需求 15.x 的中文指标名，便于阶段 3 逐条对账 */
  title: string;
  /** 已接入时给格式化好的字符串；未接入传 undefined */
  value?: string;
  /** 数值后缀，如「门」「人次」「天」 */
  suffix?: string;
  /** 指标口径说明，挂在标题旁的问号上 */
  hint?: string;
  icon?: ReactNode;
  /** 需求文档里的指标编号或章节号，验收时按它回查 */
  source?: string;
  /** 环比文案，如「↑ 8.3%」或「—」 */
  delta?: string;
  /** 环比基准说明，默认「月度环比（较上月）」 */
  deltaLabel?: string;
  /** 点卡筛列表时高亮当前卡 */
  selected?: boolean;
  onClick?: () => void;
}

interface MetricCardRowProps {
  items: MetricCardSpec[];
}

export function MetricCardRow({ items }: MetricCardRowProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="metric-card-row"
      style={{
        display: 'grid',
        // 等宽而不是 flex 自适应：卡片宽度随指标名长短变化会让每个驾驶舱的顶部错开一截
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        gap: space.md,
      }}
    >
      {items.map(({ key, ...spec }, index) => (
        <MetricCard key={key} cardKey={key} cardIndex={index} {...spec} />
      ))}
    </div>
  );
}

function MetricCard({
  cardKey,
  cardIndex,
  title,
  value,
  suffix,
  hint,
  icon,
  source,
  delta,
  deltaLabel,
  selected,
  onClick,
}: Omit<MetricCardSpec, 'key'> & { cardKey: string; cardIndex: number }) {
  const pending = value === undefined;
  const clickable = Boolean(onClick);

  return (
    <Card
      size="small"
      data-testid="metric-card"
      data-metric={cardKey}
      data-pending={pending}
      data-selected={selected ? 'true' : undefined}
      className="cockpit-metric-card"
      hoverable={clickable}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-pressed={clickable ? Boolean(selected) : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      styles={{ body: { padding: space.md } }}
      style={{
        borderRadius: radius.lg,
        cursor: clickable ? 'pointer' : undefined,
        '--metric-index': cardIndex,
        // 未接入的卡片不加边框强调，避免它在一排里比真实指标更抢眼
        borderColor: selected ? brand[600] : neutral[200],
      } as CSSProperties}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: space.xs }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: space['2xs'] }}>
            <Text
              style={{ fontSize: fontSize.bodySm, color: neutral[600] }}
              ellipsis={{ tooltip: title }}
            >
              {title}
            </Text>
            {hint && (
              <Tooltip title={hint}>
                <Info size={12} color={neutral[500]} aria-label={`${title}口径说明`} />
              </Tooltip>
            )}
          </div>

          <div
            style={{
              marginTop: space['2xs'],
              fontSize: fontSize.metric,
              lineHeight: lineHeight.metric,
              fontWeight: 600,
              // 表格与卡片里的数字一律 tabular-nums（设计规范 3.3）
              fontVariantNumeric: 'tabular-nums',
              color: pending ? neutral[400] : neutral[900],
            }}
          >
            {pending ? '—' : <AnimatedNumber value={value!} />}
            {!pending && suffix && (
              <span style={{ fontSize: fontSize.body, marginLeft: space['2xs'], fontWeight: 400 }}>
                {suffix}
              </span>
            )}
          </div>

          <Text style={{ fontSize: fontSize.caption, color: neutral[500] }}>
            {pending
              ? `阶段 3 接入${source ? ` · ${source}` : ''}`
              : delta !== undefined
                ? `${delta} · ${deltaLabel ?? '月度环比（较上月）'}`
                : (source ?? '\u00a0')}
          </Text>
        </div>

        {icon && (
          <div
            aria-hidden
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              flexShrink: 0,
              borderRadius: radius.md,
              // 图标底色一律品牌浅调：语义色不得进装饰（规则 VC4）
              background: pending ? neutral[100] : brand[50],
              color: pending ? neutral[400] : brand[500],
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
