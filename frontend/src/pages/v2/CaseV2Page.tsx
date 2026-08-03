import { useMemo, useState } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  Download,
  Eye,
  Megaphone,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ThumbsUp,
  Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { Chart } from '@/shared/ui/v2/Chart';
import { ASSETS, colorV2 } from '@/shared/theme/designTokensV2';
import {
  CASE_CARDS,
  CASE_DETAIL,
  CASE_DETAIL_ACTIVE_TAB,
  CASE_DETAIL_TABS,
  CASE_FILTERS,
  CASE_INTERACTION,
  CASE_KPIS,
  CASE_LIBRARY_DEFAULT_VIEW,
  CASE_LIBRARY_VIEWS,
  CASE_RANKING,
  CASE_SELECTED_ID,
  CASE_VIEW_TREND,
  COVERAGE_COLUMNS,
  COVERAGE_DELTA,
  COVERAGE_HEATMAP_GROUPS,
  COVERAGE_RATE,
  COVERAGE_ROWS,
  COVERAGE_TOTAL,
  COVERAGE_TREND,
  type CaseCard,
  type CaseLibraryView,
  type CaseState,
} from '@/fixtures/kase';
import './CaseV2Page.css';

/**
 * P06 案例与组织覆盖（《设计文档 V2.0》第 10 章）。
 *
 * <p>八个区域各带 {@code data-region}。组织覆盖与第六张 KPI 两种模式都渲染（V-65）：
 * 数据仍是 fixture，不接组织架构表；新建案例／分享报告只出禁用按钮对齐版式。
 *
 * <p>字段口径出入见 {@link file://./../../fixtures/kase.ts} 头注。
 */
export function CaseV2Page() {
  const [libraryView, setLibraryView] = useState<CaseLibraryView>(CASE_LIBRARY_DEFAULT_VIEW);
  const [selectedId, setSelectedId] = useState(CASE_SELECTED_ID);

  return (
    <div className="cse v2-page" data-coverage="on">
      <KpiRow />
      <FilterBar />

      <div className="cse-main">
        <div className="cse-left">
          <LibraryPanel
            view={libraryView}
            onViewChange={setLibraryView}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <AnalyticsPanel />
          <CoveragePanel />
        </div>
        <DetailPanel selectedId={selectedId} />
      </div>
    </div>
  );
}

const KPI_ICONS: Record<string, LucideIcon> = {
  Trophy,
  Megaphone,
  Eye,
  ThumbsUp,
  MessageSquare,
  Building2,
};

function KpiRow() {
  return (
    <section
      className="cse-kpis"
      data-region="R3"
      data-count={CASE_KPIS.length}
      aria-label="案例指标概览"
    >
      {CASE_KPIS.map((kpi) => {
        const Icon = KPI_ICONS[kpi.icon]!;
        return (
          <article className="cse-kpi" key={kpi.id} data-testid="case-kpi" data-kpi={kpi.id}>
            <div className="cse-kpi-text">
              <p className="cse-kpi-label">{kpi.label}</p>
              <p className="cse-kpi-value">{kpi.value}</p>
              <p className="cse-kpi-delta">
                <span>{kpi.delta}</span>
                <span className="cse-kpi-period">较上周期</span>
              </p>
            </div>
            <span className="cse-kpi-plate" aria-hidden>
              <Icon size={16} strokeWidth={1.75} />
            </span>
          </article>
        );
      })}
    </section>
  );
}

function FilterBar() {
  return (
    <section className="cse-filters" data-region="R4" aria-label="案例筛选">
      <label className="cse-search">
        <Search size={14} aria-hidden />
        <input type="search" placeholder="搜索案例名称 / 标签" readOnly />
      </label>

      {CASE_FILTERS.map((filter) => (
        <button key={filter.id} type="button" className="cse-select" data-testid="case-filter">
          <span>{filter.value === '全部' ? filter.label : filter.value}</span>
          <ChevronDown size={12} aria-hidden />
        </button>
      ))}

      <div className="cse-filter-actions">
        <button type="button" className="cse-report-btn">
          生成总结报告
        </button>
        <button
          type="button"
          className="cse-create-btn"
          disabled
          title="案例由精品课程自动创建，不可手动新建"
        >
          <Plus size={14} aria-hidden />
          新建案例
        </button>
      </div>
    </section>
  );
}

function LibraryPanel({
  view,
  onViewChange,
  selectedId,
  onSelect,
}: {
  view: CaseLibraryView;
  onViewChange: (next: CaseLibraryView) => void;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="panel cse-library" data-region="R5" aria-label="案例库">
      <header className="panel-head cse-library-head">
        <h2 className="panel-title">案例库</h2>
        <div className="cse-view-switch" role="tablist" aria-label="案例库视图">
          {CASE_LIBRARY_VIEWS.map((item) => (
            <button
              key={item}
              type="button"
              className="cse-view-btn"
              role="tab"
              data-testid="library-view"
              data-active={item === view}
              onClick={() => onViewChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </header>

      {view === '卡片视图' ? (
        <div className="cse-cards" data-testid="case-cards">
          {CASE_CARDS.map((card) => (
            <CaseCardView
              key={card.id}
              card={card}
              selected={card.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <CaseListView selectedId={selectedId} onSelect={onSelect} />
      )}
    </section>
  );
}

function CaseCardView({
  card,
  selected,
  onSelect,
}: {
  card: CaseCard;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <article
      className="cse-card"
      data-testid="case-card"
      data-selected={selected}
      data-case-id={card.id}
      onClick={() => onSelect(card.id)}
    >
      <div className="cse-card-cover">
        <img src={card.cover} alt="" aria-hidden />
        {card.featured && <span className="cse-featured">精品</span>}
      </div>
      <div className="cse-card-body">
        <h3 className="cse-card-title" title={card.title}>
          {card.title}
        </h3>
        <p className="cse-card-domain">{card.domain}</p>
        <div className="cse-card-tags">
          {card.tags.slice(0, 2).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <div className="cse-card-metrics">
          <span>
            <Eye size={11} aria-hidden /> {card.views}
          </span>
          <span>
            <ThumbsUp size={11} aria-hidden /> {card.likes}
          </span>
          <span>
            <MessageSquare size={11} aria-hidden /> {card.comments}
          </span>
        </div>
        <StateTag state={card.state} />
      </div>
    </article>
  );
}

function CaseListView({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <table className="cse-list-table" data-testid="case-list">
      <thead>
        <tr>
          <th>案例名称</th>
          <th>应用领域</th>
          <th>状态</th>
          <th>浏览次数</th>
          <th>点赞</th>
          <th>评论</th>
        </tr>
      </thead>
      <tbody>
        {CASE_CARDS.map((card) => (
          <tr
            key={card.id}
            data-testid="case-list-row"
            data-selected={card.id === selectedId}
            onClick={() => onSelect(card.id)}
          >
            <td title={card.title}>{card.title}</td>
            <td>{card.domain}</td>
            <td>
              <StateTag state={card.state} />
            </td>
            <td>{card.views}</td>
            <td>{card.likes}</td>
            <td>{card.comments}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StateTag({ state }: { state: CaseState }) {
  return (
    <span className="cse-state" data-state={state} data-testid="case-state">
      {state}
    </span>
  );
}

function AnalyticsPanel() {
  const trendOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 28, right: 8, top: 28, bottom: 22 },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 6,
        textStyle: { fontSize: 10, color: colorV2.textTertiary },
        data: ['本期', '上期'],
      },
      xAxis: {
        type: 'category',
        data: [...CASE_VIEW_TREND.labels],
        axisLabel: { fontSize: 10, color: colorV2.textTertiary },
        axisLine: { lineStyle: { color: colorV2.borderDefault } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        splitNumber: 3,
        axisLabel: { fontSize: 10, color: colorV2.textTertiary },
        splitLine: { lineStyle: { color: colorV2.borderLight } },
      },
      series: [
        {
          name: '上期',
          type: 'line',
          data: [...CASE_VIEW_TREND.previous],
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.5, color: colorV2.textPlaceholder, type: 'dashed' },
        },
        {
          name: '本期',
          type: 'line',
          data: [...CASE_VIEW_TREND.current],
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          showSymbol: false,
          lineStyle: { width: 2, color: colorV2.brandAction },
          areaStyle: { color: 'rgba(57,116,250,0.10)' },
          itemStyle: { color: colorV2.brandAction },
        },
      ],
    }),
    [],
  );

  const donutOption = useMemo<EChartsOption>(
    () => ({
      series: [
        {
          type: 'pie',
          radius: ['58%', '78%'],
          center: ['50%', '50%'],
          silent: true,
          label: { show: false },
          data: [
            {
              value: CASE_INTERACTION.slices[0].value,
              name: '点赞',
              itemStyle: { color: colorV2.brandAction },
            },
            {
              value: CASE_INTERACTION.slices[1].value,
              name: '评论',
              itemStyle: { color: '#7EB6FF' },
            },
          ],
        },
      ],
    }),
    [],
  );

  return (
    <section className="panel cse-analytics" data-region="R6" aria-label="案例分析">
      <div className="cse-analytics-col">
        <p className="cse-inset-title">浏览次数趋势</p>
        <Chart option={trendOption} height={120} ariaLabel="浏览次数趋势" />
      </div>

      <div className="cse-analytics-col cse-donut-col">
        <p className="cse-inset-title">互动数据分布</p>
        <div className="cse-donut" data-testid="interaction-donut">
          <div className="cse-donut-chart">
            <Chart option={donutOption} height={110} ariaLabel="互动数据分布" />
            <div className="cse-donut-center">
              <span>{CASE_INTERACTION.total}</span>
              <small>互动总数</small>
            </div>
          </div>
          <ul className="cse-donut-legend">
            {CASE_INTERACTION.slices.map((slice) => (
              <li key={slice.id} data-slice={slice.id}>
                <i className="cse-legend-dot" data-slice={slice.id} aria-hidden />
                <span>{slice.label}</span>
                <strong>{slice.percent}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="cse-analytics-col">
        <p className="cse-inset-title">精选案例排行</p>
        <ol className="cse-rank" data-testid="case-ranking">
          {CASE_RANKING.map((item) => (
            <li key={item.rank} data-rank={item.rank}>
              <span className="cse-rank-no">{item.rank}</span>
              <span className="cse-rank-title" title={item.title}>
                {item.title}
              </span>
              <span className="cse-rank-views">{item.views}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * R7 组织覆盖（V-65：产品／回归都渲染）。
 *
 * <p>热力条用 DOM 树形进度条而不是地理热力——禁区第 14 项禁止地图类可视化。
 * 部门名是展示占位，不对应一期禁止的 {@code org_department} 表。
 */
function CoveragePanel() {
  const trendOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 28, right: 8, top: 28, bottom: 22 },
      xAxis: {
        type: 'category',
        data: [...COVERAGE_TREND.labels],
        axisLabel: { fontSize: 10, color: colorV2.textTertiary },
        axisLine: { lineStyle: { color: colorV2.borderDefault } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: { fontSize: 10, color: colorV2.textTertiary, formatter: '{value}%' },
        splitLine: { lineStyle: { color: colorV2.borderLight } },
      },
      series: [
        {
          type: 'line',
          data: [...COVERAGE_TREND.values],
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2, color: colorV2.brandAction },
          itemStyle: { color: colorV2.brandAction },
          areaStyle: { color: 'rgba(57,116,250,0.08)' },
        },
      ],
      graphic: [
        {
          type: 'text',
          right: 8,
          top: 4,
          style: {
            text: COVERAGE_RATE,
            fill: colorV2.textPrimary,
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'Inter, "Noto Sans SC", sans-serif',
          },
        },
      ],
    }),
    [],
  );

  return (
    <section
      className="panel cse-coverage"
      data-region="R7"
      data-testid="coverage-panel"
      aria-label="组织覆盖"
    >
      <div className="cse-coverage-col">
        <p className="cse-inset-title">部门覆盖分布</p>
        <div className="cse-heat" data-testid="coverage-heat">
          {COVERAGE_HEATMAP_GROUPS.map((group) => (
            <div className="cse-heat-group" key={group.name}>
              <div className="cse-heat-row cse-heat-row-group">
                <span className="cse-heat-name">{group.name}</span>
                <div className="cse-heat-track">
                  <div className="cse-heat-fill" style={{ width: `${group.rate}%` }} />
                </div>
                <span className="cse-heat-rate">{group.rate}%</span>
              </div>
              {group.children.map((child) => (
                <div className="cse-heat-row cse-heat-row-child" key={child.name}>
                  <span className="cse-heat-name">{child.name}</span>
                  <div className="cse-heat-track">
                    <div className="cse-heat-fill" style={{ width: `${child.rate}%` }} />
                  </div>
                  <span className="cse-heat-rate">{child.rate}%</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="cse-coverage-col">
        <p className="cse-inset-title">
          部门覆盖率趋势
          <span className="cse-coverage-delta">{COVERAGE_DELTA}</span>
        </p>
        <Chart option={trendOption} height={180} ariaLabel="部门覆盖率趋势" />
      </div>

      <div className="cse-coverage-col cse-coverage-table-col">
        <p className="cse-inset-title">部门详情</p>
        <table className="cse-coverage-table" data-testid="coverage-table">
          <colgroup>
            {COVERAGE_COLUMNS.map((column) => (
              <col key={column.id} data-col={column.id} style={{ width: column.width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COVERAGE_COLUMNS.map((column) => (
                <th key={column.id} data-col={column.id}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COVERAGE_ROWS.map((row) => (
              <tr key={row.dept}>
                <td>{row.dept}</td>
                <td>{row.headcount}</td>
                <td>{row.trained}</td>
                <td>{row.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="cse-coverage-pager">共 {COVERAGE_TOTAL} 个部门</p>
      </div>
    </section>
  );
}

function DetailPanel({ selectedId }: { selectedId: string }) {
  void selectedId;

  return (
    <section className="panel cse-detail" data-region="R8" aria-label="案例详情">
      <div className="cse-detail-caption">
        <strong>当前选中案例</strong>
        <button type="button" tabIndex={-1}>
          切换案例
        </button>
      </div>
      <header className="cse-detail-head">
        <img className="cse-detail-cover" src={CASE_DETAIL.cover} alt="" aria-hidden />
        <div className="cse-detail-titles">
          <h2 className="cse-detail-name" data-testid="detail-title">
            {CASE_DETAIL.title}
          </h2>
          <p className="cse-detail-domain">{CASE_DETAIL.domain}</p>
          <div className="cse-detail-tags">
            {CASE_DETAIL.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
            {CASE_DETAIL.featured && <span className="cse-featured">精品</span>}
            <StateTag state={CASE_DETAIL.state} />
          </div>
        </div>
      </header>

      <nav className="cse-tabs" aria-label="案例详情页签">
        {CASE_DETAIL_TABS.map((tab, index) => (
          <button
            key={tab}
            type="button"
            className="cse-tab"
            data-testid="case-tab"
            data-active={index === CASE_DETAIL_ACTIVE_TAB}
          >
            {tab}
            {tab === '评论' ? ' 98' : ''}
          </button>
        ))}
      </nav>

      <div className="cse-detail-body">
        <div className="cse-body-block" data-testid="case-body-block">
          <h3>背景与目标</h3>
          <p>{CASE_DETAIL.summary}</p>
        </div>

        <div className="cse-body-block" data-testid="case-body-block">
          <h3>关键成果</h3>
          <ul className="cse-outcome-list">
            {CASE_DETAIL.outcomes.map((item) => (
              <li key={item}>
                <Check size={12} strokeWidth={2.2} aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="cse-body-block" data-testid="case-body-block">
          <h3>适用人群</h3>
          <div className="cse-audience">
            {CASE_DETAIL.audiences.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <div className="cse-report" data-testid="case-report">
          <div className="cse-report-head">
            <h3>总结报告（可编辑）</h3>
            <span>AI 生成于 {CASE_DETAIL.reportGeneratedAt}</span>
          </div>
          <div className="cse-report-body">
            <img className="cse-report-art" src={ASSETS.A08} alt="" aria-hidden />
            <div className="cse-report-text">
              <p className="cse-report-label">核心亮点</p>
              <ul>
                {CASE_DETAIL.reportBullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="cse-report-label">下一步</p>
              <ul>
                {CASE_DETAIL.nextSteps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <footer className="cse-detail-actions">
        <button type="button" className="cse-action-secondary">
          <Download size={14} aria-hidden />
          下载报告
        </button>
        <button
          type="button"
          className="cse-action-secondary"
          disabled
          title="一期不发送任何消息，分享能力不做"
        >
          <Share2 size={14} aria-hidden />
          分享报告
        </button>
        <button type="button" className="cse-action-primary">
          <RefreshCw size={14} aria-hidden />
          更新报告
        </button>
      </footer>
    </section>
  );
}
