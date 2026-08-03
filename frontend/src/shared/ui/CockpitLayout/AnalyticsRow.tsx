import type { ReactNode } from 'react';
import { Card, Typography } from 'antd';
import { fontSize, neutral, radius, space } from '@/shared/theme/designTokens';

const { Text } = Typography;

/**
 * 驾驶舱底部的分析区（设计稿每张稿的最后一段，2～3 块并排）。
 *
 * <p>装的是原来的「态势图」「数据概览」「案例数据看板」这类页面。它们被放到底部而不是
 * 单开一页，是因为看图与看列表是同一个判断动作的两半：图上看出「学员运营域积压 12 条」，
 * 下一步就是回到上面的列表按领域筛。分成两页会让这个动作变成来回跳。
 *
 * <p>每块用等宽栅格，不用 flex 自适应：图表宽度随内容变化会让相邻两块的坐标轴对不齐。
 */

interface AnalyticsRowProps {
  /**
   * 等宽的块数，或直接给 grid-template-columns。
   *
   * <p>给字符串是为了日历这类「明显该占更多宽度」的块——课程工作台底部是日历 + 数据概览，
   * 平分会让日历的每个格子塞不下两条排期。
   */
  columns?: number | string;
  children: ReactNode;
}

export function AnalyticsRow({ columns = 3, children }: AnalyticsRowProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          typeof columns === 'number' ? `repeat(${columns}, minmax(0, 1fr))` : columns,
        gap: space.md,
        alignItems: 'start',
      }}
    >
      {children}
    </div>
  );
}

interface AnalyticsCardProps {
  title: string;
  /** 图表口径说明。「这张图是存量不是转化率」这类话必须写在图上，不能只写在注释里 */
  note?: string;
  extra?: ReactNode;
  children: ReactNode;
}

export function AnalyticsCard({ title, note, extra, children }: AnalyticsCardProps) {
  return (
    <Card
      size="small"
      title={title}
      extra={extra}
      style={{ borderRadius: radius.lg, borderColor: neutral[200] }}
      styles={{ body: { padding: space.md } }}
    >
      {children}
      {note && (
        <div style={{ marginTop: space.sm }}>
          <Text style={{ fontSize: fontSize.caption, color: neutral[500] }}>{note}</Text>
        </div>
      )}
    </Card>
  );
}
