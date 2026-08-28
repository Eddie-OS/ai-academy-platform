import { Empty, Space, Typography } from 'antd';
import { brand, neutral, radius, space } from '@/shared/theme/designTokens';

const { Text } = Typography;

/**
 * 分析区的两种小图：横向柱状与漏斗。
 *
 * <p><b>为什么不是 ECharts。</b>技术栈规定图表一律用 ECharts 5，但当前离线环境装不上依赖
 * （同 P-1 记的 openapi 生成器）。这里用的是纯 DOM 条形，语义与取数逻辑与图表库无关，
 * 网络可用后把渲染换成 ECharts 即可，聚合结果不变。已记入 {@code docs/文档待修清单.md}。
 *
 * <p>抽到共享层是因为需求态势图与讲师池分布画的是同一种图。各自实现一份的代价不是多几十行，
 * 而是两处的条宽、标签宽度与零值画法会慢慢分叉，而它们在同一个产品里上下相邻。
 */

export interface ChartItem {
  label: string;
  count: number;
}

interface ChartProps {
  items: ChartItem[];
  emptyText: string;
  /** 标签列宽。领域名与状态名长短不一，由调用方按自己那块的宽度定 */
  labelWidth?: number;
}

/**
 * 横向柱状图。用横向而不是纵向：领域名与状态名是中文短语，纵向柱状图的 X 轴标签会挤成一团，
 * 而分析区每块约 370px 宽，横向排列才有足够的标签宽度。
 */
export function BarChart({ items, emptyText, labelWidth = 104 }: ChartProps) {
  if (items.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <Space direction="vertical" size={space.xs} style={{ width: '100%' }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: space.xs }}>
          <Text style={{ width: labelWidth, color: neutral[700] }} ellipsis={{ tooltip: item.label }}>
            {item.label}
          </Text>
          <div style={{ flex: 1, background: neutral[100], borderRadius: radius.xs, height: 20 }}>
            <div
              data-testid="bar"
              data-label={item.label}
              data-count={item.count}
              style={{
                width: `${(item.count / max) * 100}%`,
                minWidth: item.count > 0 ? 2 : 0,
                height: 20,
                background: brand[500],
                borderRadius: radius.xs,
              }}
            />
          </div>
          {/* 数字列必须 tabular-nums，否则不同行的数字位宽不一，右对齐也对不齐（设计规范 3.3） */}
          <Text style={{ width: 44, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {item.count.toLocaleString()}
          </Text>
        </div>
      ))}
    </Space>
  );
}

/** 漏斗：各档按流程顺序自上而下，宽度按数量。零值照常画出一条细线并显示 0，不跳过——某一档为空本身就是信息。 */
export function FunnelChart({ items, emptyText, labelWidth = 88 }: ChartProps) {
  if (items.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }
  const max = Math.max(...items.map((item) => item.count), 1);
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <Space direction="vertical" size={space.xs} style={{ width: '100%' }}>
      {items.map((item, index) => {
        const share = total <= 0 ? '0.0%' : `${((item.count / total) * 100).toFixed(1)}%`;
        return (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: space.xs }}>
          <Text style={{ width: labelWidth, color: neutral[700] }} ellipsis={{ tooltip: item.label }}>
            {item.label}
          </Text>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <div
              data-testid="funnel-stage"
              data-label={item.label}
              data-count={item.count}
              data-share={share}
              style={{
                width: `${Math.max((item.count / max) * 100, 4)}%`,
                height: 28,
                // 同色系逐档加深：漏斗的各档是同一件事的不同阶段，换色相会读成不同类别
                background: index === 0 ? brand[400] : index === 1 ? brand[500] : brand[600],
                borderRadius: radius.xs,
              }}
            />
          </div>
          <Text style={{ width: 72, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {item.count.toLocaleString()}
            <Text type="secondary" style={{ marginLeft: space['2xs'] }}>
              {share}
            </Text>
          </Text>
        </div>
        );
      })}
    </Space>
  );
}
