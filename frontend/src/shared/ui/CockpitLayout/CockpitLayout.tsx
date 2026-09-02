import type { ReactNode } from 'react';
import { Card, Typography } from 'antd';
import { fontSize, layout, neutral, radius, space } from '@/shared/theme/designTokens';
import { MetricCardRow, type MetricCardSpec } from './MetricCardRow';
import './CockpitLayout.css';

const { Title, Text } = Typography;

/**
 * 五个驾驶舱共用的一屏版式（《平台驾驶舱全景》10 张设计稿的统一结构）。
 *
 * <p>一屏之内四段，自上而下：<b>指标卡行 → 筛选行 → 主区（左工作区 + 右详情面板）→ 底部分析区</b>。
 *
 * <p><b>为什么把原来的两三页并成一页。</b>需求 8.2／9.2／11.2 把每个驾驶舱写成「列表页 +
 * 详情页 + 态势图页」，那是内容清单不是页面切分。运营的真实动作是「在一批对象里逐条看、
 * 逐条录」，跳页会让每处理一条就丢一次筛选与滚动位置。设计稿的主从版式把这三块并排放，
 * 内容一项不少，路由也仍然保留——{@code /demands/123} 打开的是驾驶舱页且右列自动选中该条。
 *
 * <p><b>右列是固定宽度不是百分比。</b>460px 是详情面板里描述列表两列布局的下限；用百分比
 * 会让 1440px 与 1920px 下的页签内部布局各断一次行，而这两个宽度都要用。
 *
 * <p>展开态下左列整体隐藏而不是压窄：压到 200px 的列表每列都是省略号，读不出任何东西。
 */

/** 详情面板标准宽度。左列在 1440px 下仍有 1152-460-24 = 668px，够放 6～8 列表格 */
const DETAIL_WIDTH = 460;

interface CockpitLayoutProps {
  /** 驾驶舱名称，取设计稿侧栏的叫法 */
  title: string;
  /** 一句话说明这个驾驶舱记录什么。设计原则「平台只记录线下已经发生的事」在这里反复出现 */
  subtitle?: string;
  /** 页头右上角的主动作（新建、导入等） */
  actions?: ReactNode;
  /** 顶部指标卡。阶段 2 传未接入形态，见 MetricCardRow */
  metrics?: MetricCardSpec[];
  /** 筛选行。为空时整行不渲染，不留空卡片 */
  filters?: ReactNode;
  /** 主区左列：列表、看板或日历 */
  main: ReactNode;
  /**
   * 主区右列：对象详情面板。没选中对象时传假值，右列整个不占位，主区独占整宽。
   * 状态地图与日历这两个主区最吃宽度，让它们在浏览时少四分之一不划算。
   */
  detail?: ReactNode | false;
  /** 详情面板处于展开态时左列让位 */
  detailExpanded?: boolean;
  /** 底部分析区：态势图、数据概览 */
  analytics?: ReactNode;
}

export function CockpitLayout({
  title,
  subtitle,
  actions,
  metrics,
  filters,
  main,
  detail,
  detailExpanded = false,
  analytics,
}: CockpitLayoutProps) {
  const hasDetail = Boolean(detail);

  return (
    <div
      data-testid="cockpit-layout"
      style={{ display: 'flex', flexDirection: 'column', gap: space.md }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: space.md }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Title level={2} style={{ margin: 0, fontSize: fontSize.h2 }}>
            {title}
          </Title>
          {subtitle && (
            <Text type="secondary" style={{ fontSize: fontSize.bodySm }}>
              {subtitle}
            </Text>
          )}
        </div>
        {actions && <div style={{ display: 'flex', gap: space.xs }}>{actions}</div>}
      </div>

      {metrics && metrics.length > 0 && <MetricCardRow items={metrics} />}

      {filters && (
        <Card
          size="small"
          styles={{ body: { padding: space.sm } }}
          style={{ borderRadius: radius.lg, borderColor: neutral[200] }}
        >
          {filters}
        </Card>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: space.md }}>
        {!(hasDetail && detailExpanded) && (
          <div style={{ flex: 1, minWidth: 0 }} data-testid="cockpit-main">
            {main}
          </div>
        )}
        {hasDetail && (
          <div
            data-testid="cockpit-detail-column"
            className="cockpit-detail-column"
            style={{
              width: detailExpanded ? '100%' : DETAIL_WIDTH,
              flexShrink: 0,
              // 详情面板跟随滚动：底部分析区很长，翻到图表时状态区不该滚出视野（体验总纲 P1）
              position: 'sticky',
              top: layout.headerHeight + space.md,
            }}
          >
            {detail}
          </div>
        )}
      </div>

      {analytics && <div data-testid="cockpit-analytics">{analytics}</div>}
    </div>
  );
}
