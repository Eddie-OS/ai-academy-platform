import { Fragment, useMemo } from 'react';
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Diamond,
  FileText,
  Info,
  PieChart,
  Rocket,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Target,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { Chart } from '@/shared/ui/v2/Chart';
import { Avatar } from '@/shared/ui/v2/Avatar';
import { ActionGuard } from '@/shared/ui/ActionGuard';
import { WarningLight } from '@/shared/ui/WarningLight';
import { ASSETS, colorV2 } from '@/shared/theme/designTokensV2';
import { space } from '@/shared/theme/designTokens';
import {
  DEMAND_ACTION_AVAILABILITY,
  DEMAND_ACTION_ORDER,
  DEMAND_BAR_AXIS_TICKS,
  DEMAND_DATE_RANGE,
  DEMAND_DESCRIPTION,
  DEMAND_DESCRIPTION_MORE,
  DEMAND_DETAIL_ACTIVE_TAB,
  DEMAND_DETAIL_FIELDS,
  DEMAND_DETAIL_META,
  DEMAND_DETAIL_PEOPLE,
  DEMAND_DETAIL_SECTION_TITLE,
  DEMAND_DETAIL_TABS,
  DEMAND_DOMAIN_BARS,
  DEMAND_FEED,
  DEMAND_FILTERS,
  DEMAND_FUNNEL,
  DEMAND_FUNNEL_NOTE,
  DEMAND_ID_PREFIX,
  DEMAND_KPIS,
  DEMAND_OUTLETS,
  DEMAND_PAGE_ITEMS,
  DEMAND_PAGINATION,
  DEMAND_ROWS,
  DEMAND_SEARCH_PLACEHOLDER,
  DEMAND_SELECTED_ID,
  DEMAND_TREND_TABS,
  funnelShare,
  type DemandRow,
} from '@/fixtures/demand';
import './DemandV2Page.css';

/**
 * P02 AI需求驾驶舱（《设计文档 V2.0》第 6 章）。
 *
 * <p>七个区域各带 {@code data-region}，编号与文档 6「区域坐标」表一一对应。
 * R5 与 R7 同起同止（y=264，都到 958），R6 接在 R5 下面 —— 左栏 419+17+258 = 694 = R7 的高。
 *
 * <p>表格与详情的字段口径与 V2.0 表面文字有出入，逐条替换依据写在
 * {@link file://./../../fixtures/demand.ts} 的头注里。核心一条：需求是
 * 「一个分流出口字段 + 两组互斥的状态字段」，所以没有一个对所有行都成立的「开发状态」列，
 * 那一列是需求 12.x 定的「当前处理状态」。
 */
export function DemandV2Page() {
  return (
    <div className="dmd v2-page">
      <KpiRow />
      <FilterBar />

      <div className="dmd-main">
        <div className="dmd-left">
          <DemandTablePanel />
          <AnalysisPanel />
        </div>
        <DetailPanel />
      </div>
    </div>
  );
}

/**
 * R3 七张 KPI 的图标，按 fixture 的稳定 id 索引（同 P01 的理由：
 * 按位置索引在增删一张卡时不报错，只会让七个图标整体错位一格）。
 */
const KPI_ICONS: Record<string, LucideIcon> = {
  total: FileText,
  pendingReview: ClipboardCheck,
  reviewing: CircleDot,
  reviewed: Target,
  approved: BarChart3,
  developing: SlidersHorizontal,
  online: Rocket,
};

/**
 * 图标底板的色相，同样按 fixture 的稳定 id 索引。
 *
 * <p>七张卡各一个色相是为了让「需求总数」与后六个状态计数在扫读时能分开 ——
 * 七个同色底板等于没有底板，实测下 brand-50 的底与白卡只差三个灰阶。
 *
 * <p><b>刻意避开四个语义色</b>（#0EA5E9 蓝灯／#F59E0B 黄灯／#EF4444 红灯／中性无灯）：
 * WV4 规定语义色不得出现在装饰图形中。KPI 底板是装饰，用了黄灯色的橙，
 * 运营会以为「已评审」这张卡处在预警态。这里取的是品牌蓝阶 + 三个非语义色相。
 */
const KPI_TONES: Record<string, string> = {
  total: '#5B82FF',
  pendingReview: '#7C6CF0',
  reviewing: '#3974FA',
  reviewed: '#3FA9C9',
  approved: '#8B5CF6',
  developing: '#4E70DB',
  online: '#FF9A3E',
};

/** 环比的比较基准，七张卡共用。与顶栏日期区间是同一个口径 */
const DELTA_BASELINE_LABEL = '较上周期';

/** R3 七张 KPI：222,75,1340,108 */
function KpiRow() {
  return (
    <section className="dmd-kpis" data-region="R3" aria-label="需求指标概览">
      {DEMAND_KPIS.map((kpi) => {
        const Icon = KPI_ICONS[kpi.id] ?? FileText;
        const tone = KPI_TONES[kpi.id] ?? colorV2.brandAction;
        return (
          <article className="dmd-kpi" key={kpi.id} data-testid="demand-kpi" data-kpi={kpi.id}>
            <div className="dmd-kpi-top">
              <p className="dmd-kpi-label">{kpi.label}</p>
              {/* 底色由色相加 20% 透明度得到，不再另列七个浅色值：
                  两套色值分开维护时，改了色相忘了改底色，卡片会出现色相不匹配的图标 */}
              <span
                className="dmd-kpi-plate"
                style={{ color: tone, background: `${tone}33` }}
                aria-hidden
              >
                <Icon size={16} strokeWidth={1.8} />
              </span>
            </div>
            <p className="dmd-kpi-value">{kpi.value}</p>
            <p className="dmd-kpi-foot">
              <span className="dmd-kpi-delta">{kpi.delta}</span>
              <span className="dmd-kpi-baseline">{DELTA_BASELINE_LABEL}</span>
            </p>
          </article>
        );
      })}
    </section>
  );
}

/**
 * R4 筛选器：222,201,1340,45。
 *
 * <p>搜索 + 五个下拉 + 日期区间 + 更多筛选 + 重置 + 新建，全部未选中态。
 * 这里刻意用原生 button/input 而不是 AntD Select —— AntD 的下拉高度受主题算法影响，
 * 45px 的整条高度会浮动 1~2px，而 L1 容差就是 2px。
 * 真实交互版在阶段 2 的业务页接管，这一页只负责几何。
 */
function FilterBar() {
  return (
    <section className="dmd-filters" data-region="R4" aria-label="需求筛选">
      <div className="dmd-search">
        <Search size={14} color={colorV2.textTertiary} aria-hidden />
        <input type="search" placeholder={DEMAND_SEARCH_PLACEHOLDER} aria-label="搜索需求" />
      </div>

      {DEMAND_FILTERS.map((filter) => (
        <span className="dmd-filter" key={filter.id} data-testid="demand-filter">
          <span className="dmd-filter-label">{filter.label}</span>
          <button className="dmd-control" type="button" aria-label={filter.label}>
            <span className="dmd-filter-value">{filter.placeholder}</span>
            <ChevronDown size={14} color={colorV2.textTertiary} aria-hidden />
          </button>
        </span>
      ))}

      <span className="dmd-filter" data-testid="demand-daterange">
        <span className="dmd-filter-label">{DEMAND_DATE_RANGE.label}</span>
        {/*
         * 起止两个日期共用一个控件、一个日历图标。
         * 拆成两个各带图标的盒子时，「~」没有落脚处，两个日期读起来像两个互不相干的筛选，
         * 而它们是一个区间的两端。
         */}
        <button className="dmd-control dmd-daterange" type="button" aria-label="日期区间">
          <span className="dmd-date">{DEMAND_DATE_RANGE.from}</span>
          <span className="dmd-date-sep" aria-hidden>
            ～
          </span>
          <span className="dmd-date">{DEMAND_DATE_RANGE.to}</span>
          <CalendarDays size={13} color={colorV2.textTertiary} aria-hidden />
        </button>
      </span>

      {/* 「更多筛选」不是一个筛选项，是抽屉入口。给它描边会被当成第六个下拉 */}
      <button className="dmd-more" type="button">
        <SlidersHorizontal size={14} aria-hidden />
        更多筛选
      </button>

      <button className="dmd-reset" type="button">
        <RotateCcw size={13} aria-hidden />
        重置
      </button>

      <button className="dmd-create" type="button">
        新建需求
      </button>
    </section>
  );
}

/**
 * 十二列的设计宽度，合计 884 = R5 的区域宽（文档 6「内部几何」标注「必须照抄」）。
 * 顺序与表头一一对应，改动要连 tests/visual/p02-demand.spec.ts 的列宽表一起改。
 */
const DEMAND_COLUMN_WIDTHS = [95, 145, 75, 60, 60, 78, 70, 78, 98, 42, 48, 35];

const DEMAND_TABLE_WIDTH = DEMAND_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0);

/** R5 需求表格：222,264,884,419 */
function DemandTablePanel() {
  const { pageNum, pageSize, total } = DEMAND_PAGINATION;

  return (
    <section className="panel dmd-table-panel" data-region="R5" aria-label="需求列表">
      <div className="panel-head">
        <h2 className="panel-title">需求列表</h2>
        {/* 「共 N 条」而不是一个光秃秃的数字徽章：徽章在侧栏与任务中心表示「待处理数」，
            同一个形状在这里表示总数会读成「有 1,268 条待办」 */}
        <span className="dmd-list-count">共 {total.toLocaleString('en-US')} 条</span>
        <button className="dmd-panel-close" type="button" aria-label="收起需求列表">
          <X size={14} color={colorV2.textTertiary} aria-hidden />
        </button>
      </div>

      <table className="dmd-table">
        <colgroup>
          {/*
           * 十二列按百分比分宽，分母 884 是 R5 的区域宽度（文档 6「内部几何」标注「必须照抄」）。
           *
           * 写成百分比而不是像素，是因为产品模式下窗口比设计画布宽时左栏会跟着变宽：
           * 十一列写死、只有名称列伸缩的话，多出来的两百像素全灌进名称列，
           * 那一列宽得能放下一整段话，右边十列却仍旧挤在原处。
           * 百分比下 884 时逐列算回 95/145/75… 与设计稿一致，变宽时十二列同比例长。
           */}
          {DEMAND_COLUMN_WIDTHS.map((width, index) => (
            <col key={index} style={{ width: `${((width / DEMAND_TABLE_WIDTH) * 100).toFixed(4)}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th>需求ID</th>
            <th>需求名称</th>
            <th>领域</th>
            <th>提出人</th>
            <th>负责人</th>
            <th>评审状态</th>
            <th>分流出口</th>
            {/* 「当前处理状态」是需求 12.x 给 P1-1 定的列名。表头只有 78px，取「处理状态」 */}
            <th>处理状态</th>
            <th>预计完成</th>
            <th>灯色</th>
            <th>停滞</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {DEMAND_ROWS.map((row) => (
            <DemandTableRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>

      <div className="dmd-pager">
        <span className="dmd-pager-total">共 {total.toLocaleString('en-US')} 条</span>
        <button className="dmd-pager-size" type="button">
          {pageSize} 条/页
          <ChevronDown size={13} color={colorV2.textTertiary} aria-hidden />
        </button>
        <span className="dmd-pager-pages">
          {/* 上一页在第 1 页不可用。隐藏它会让页码条在翻到第 2 页时整体左移一格 */}
          <button className="dmd-pager-step" type="button" aria-label="上一页" disabled={pageNum === 1}>
            <ChevronLeft size={13} aria-hidden />
          </button>
          {DEMAND_PAGE_ITEMS.map((item, index) =>
            item === null ? (
              // 省略号占位，不可点。key 用下标是安全的：这个数组是冻结常量
              <span className="dmd-pager-gap" key={`gap-${index}`} aria-hidden>
                …
              </span>
            ) : (
              <button
                className="dmd-pager-page"
                key={item}
                type="button"
                data-current={item === pageNum}
                aria-current={item === pageNum ? 'page' : undefined}
              >
                {item}
              </button>
            ),
          )}
          <button className="dmd-pager-step" type="button" aria-label="下一页">
            <ChevronRight size={13} aria-hidden />
          </button>
        </span>
        <span className="dmd-pager-jump">
          跳至
          <span className="dmd-pager-input">{pageNum}</span>页
        </span>
      </div>
    </section>
  );
}

function DemandTableRow({ row }: { row: DemandRow }) {
  const selected = row.id === DEMAND_SELECTED_ID;
  const outlet = row.outlet === null ? null : DEMAND_OUTLETS[row.outlet];

  return (
    <tr data-testid="demand-row" data-demand={row.id} data-selected={selected} aria-selected={selected}>
      {/* 只显示前缀之后那一段，完整 ID 挂 title。理由见 fixture 里 DEMAND_ID_PREFIX 的说明 */}
      <td className="dmd-cell-id" title={row.id}>
        {row.id.startsWith(DEMAND_ID_PREFIX) ? row.id.slice(DEMAND_ID_PREFIX.length) : row.id}
      </td>
      <td className="dmd-cell-name" title={row.name}>
        {row.name}
      </td>
      <td>{row.domain}</td>
      <td>{row.proposer}</td>
      <td>{row.owner}</td>
      <td>
        <ReviewStateTag state={row.reviewState} />
      </td>
      {/* 分流列 70px 放不下 12 字的枚举全称，列内出短标签、title 出全称（见 fixture 头注） */}
      <td title={outlet?.value}>{outlet === null ? <Blank /> : outlet.shortLabel}</td>
      <td>{row.currentState ?? <Blank />}</td>
      <td className="dmd-cell-date">{row.expectedDate}</td>
      <td>
        {/* 灯色列 42px：两字标签 + 图标 = 40px，天数由右边的停滞列承担。
            三者齐全才满足 WV1，缺文字标签就是「纯色状态点」 */}
        {row.light === 'NONE' ? (
          <WarningLight color="NONE" short />
        ) : row.light === 'RED' ? (
          <WarningLight color="RED" reason={row.lightReason ?? 'OVERDUE'} daysShownInSeparateColumn short />
        ) : (
          <WarningLight color={row.light} daysShownInSeparateColumn short />
        )}
      </td>
      <td className="dmd-cell-stalled">{row.stalledDays === null ? <Blank /> : `${row.stalledDays} 天`}</td>
      <td>
        {/*
         * 操作列只有 35px（文档标注「必须照抄」），只放得下「查看」两个字（12px 下 24px）。
         * 设计稿在这一格里同时画了「查看」和一个 ⋮ 菜单，两者合计 36px 已经超出列宽。
         * 留「查看」而不是留 ⋮：⋮ 的内容要点开才知道，而这一列唯一确定存在的动作就是查看，
         * 少一个能看见的入口比少一个藏起来的菜单代价小。
         */}
        <button className="dmd-row-action" type="button" aria-label={`查看 ${row.name}`}>
          查看
        </button>
      </td>
    </tr>
  );
}

/**
 * 评审状态徽章：浅底胶囊 + 色点 + 状态名。
 *
 * <p><b>这里用了语义色，是一处已记录的规范偏离。</b>WV4 规定四个语义色不进状态徽章、
 * 品牌蓝也不进状态徽章，而《设计文档 V2.0》第 6 章的表格恰恰用橙／蓝／绿区分三种评审状态。
 * 业务裁决照设计稿落地，偏离已记入 docs/文档待修清单.md（V-9）。
 *
 * <p>缓解措施是<b>灯色列的四态图标形状与这里完全不同</b>（WV2）：预警靠图标形状识别，
 * 徽章靠色点 + 文字，两套编码不共用形状，色相相近也不会把状态读成预警。
 * 色点与底色都不是唯一编码 —— 状态名一直是文本，去掉颜色信息不丢失。
 */
function ReviewStateTag({ state }: { state: string }) {
  return (
    <span className="dmd-state-tag" data-state={state} data-testid="demand-review-state">
      <span className="dmd-state-dot" aria-hidden />
      {state}
    </span>
  );
}

/** 空值占位。设计规范 3.3：`—` 只表示「无数据」，零值要显示 0 */
function Blank() {
  return <span className="dmd-blank">—</span>;
}

/**
 * 漏斗六段的配色。
 *
 * <p>V2.0 设计稿这里用的是红→蓝→绿→蓝→蓝→绿的跳色，这里没有照抄：
 * 按 WV4，四个语义色不得出现在装饰图形里。把「待评审」染成危险红、「已上线」染成成功绿，
 * 等于用颜色替业务下了「积压是坏事、上线是好事」的判断 —— 而原则一说得很清楚，
 * 平台只记录，不替线下做判断。改成 brand 家族的单色渐深序列，深浅仍能区分六段。
 */
const DEMAND_FUNNEL_COLORS = ['#9DB5FF', '#87A2FF', '#7191FF', '#5B82FF', '#4E70DB', '#3E5AB0'];

/** 左侧竖排口径切换当前选中的那一项。选中项的名字同时是右侧内层卡的标题 */
const ACTIVE_TREND_TAB = DEMAND_TREND_TABS[0];

/** 两个口径各配一个图标。同图标时只剩底色能区分选中态，色盲视野下两项看起来一模一样 */
const TREND_TAB_ICONS: Record<(typeof DEMAND_TREND_TABS)[number]['id'], LucideIcon> = {
  domain: BarChart3,
  state: PieChart,
};

/** R6 分析区：222,700,884,258。左态势图、中状态漏斗、右动态卡 */
function AnalysisPanel() {
  const barOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 0, right: 0, top: 18, bottom: 0, containLabel: true },
      xAxis: {
        type: 'category',
        data: DEMAND_DOMAIN_BARS.map((item) => item.domain),
        axisLabel: {
          // 折成两行：四块比例把柱图让给漏斗与动态卡后，单行七个 4 字名会首尾相接。
          // 每两字一行宽约 19px，七档合计 133px，绘图区绰绰有余
          fontSize: 9,
          color: colorV2.textTertiary,
          // interval:0 强制七个领域名全部显示。默认策略会隔一个丢一个，而丢掉标签的
          // 那三根柱子就成了无名柱——图上看得见高度，却读不出是哪个领域
          interval: 0,
          margin: 6,
          lineHeight: 12,
          formatter: (value: string) => `${value.slice(0, 2)}\n${value.slice(2)}`,
        },
        axisLine: { lineStyle: { color: colorV2.borderDefault } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        min: DEMAND_BAR_AXIS_TICKS[0],
        max: DEMAND_BAR_AXIS_TICKS[DEMAND_BAR_AXIS_TICKS.length - 1],
        interval: DEMAND_BAR_AXIS_TICKS[1] - DEMAND_BAR_AXIS_TICKS[0],
        axisLabel: { fontSize: 9, color: colorV2.textTertiary, margin: 6 },
        splitLine: { lineStyle: { color: colorV2.borderLight } },
      },
      series: [
        {
          type: 'bar',
          data: DEMAND_DOMAIN_BARS.map((item) => item.value),
          // 22px：设计稿柱宽约占类目槽一半。14px 时七根柱像牙签，槽间空白比柱本身还抢眼
          barWidth: 22,
          // brand-500 是图表主序列色（CLAUDE.md 第九节）。交互主色 brand-600 留给按钮与链接
          itemStyle: { color: colorV2.brandPrimary, borderRadius: [3, 3, 0, 0] },
          // 柱顶标数值。七根柱子的高度差在 258px 的面板里已经压得很扁，
          // 只看柱高读不出 76 与 60 的区别
          label: { show: true, position: 'top', fontSize: 10, color: colorV2.textSecondary },
        },
      ],
    }),
    [],
  );

  const funnelOption = useMemo<EChartsOption>(
    () => ({
      series: [
        {
          type: 'funnel',
          left: 0,
          width: '100%',
          top: 2,
          bottom: 2,
          // sort:'none' 保状态推进顺序。真实值不是递减的（已评审 689 > 评审中 214），
          // 若把真实值交给 ECharts 定宽，图会鼓成沙漏——与设计稿的规整漏斗差一截。
          // 段宽改用等差展示值（只决定形状），数量与占比走右边 HTML 图例（V-69）
          sort: 'none',
          gap: 2,
          minSize: '28%',
          maxSize: '100%',
          // 段名与数字走右边的 HTML 图例，不用 ECharts 的外置标签：
          // position:'right' 的标签从各段的右边缘起画，而各段宽度不同，六行文字于是参差不齐
          label: { show: false },
          data: DEMAND_FUNNEL.map((item, index) => ({
            name: item.state,
            value: DEMAND_FUNNEL.length - index,
          })),
        },
      ],
      color: DEMAND_FUNNEL_COLORS,
    }),
    [],
  );

  return (
    <section className="panel dmd-analysis" data-region="R6" aria-label="需求分析">
      {/*
        四块并排（设计稿红框）：口径栏 / 柱图卡 / 漏斗 / 动态卡。
        口径栏与柱图卡不再包进同一列——包在一起时 flex 只会分「趋势 vs 漏斗 vs 动态」
        三份，柱图会把动态卡的宽度吃掉，插画就被压成指甲盖。
      */}
      <div className="dmd-analysis-col dmd-trend-rail">
        <h2 className="panel-title dmd-analysis-title">需求态势图</h2>
        <div className="dmd-trend-tabs" role="tablist" aria-label="统计口径">
          {DEMAND_TREND_TABS.map((tab) => {
            const active = tab.id === ACTIVE_TREND_TAB.id;
            const Icon = TREND_TAB_ICONS[tab.id];
            return (
              <button
                className="dmd-trend-tab"
                key={tab.id}
                type="button"
                role="tab"
                data-testid="demand-trend-tab"
                data-active={active}
                aria-selected={active}
              >
                <Icon size={16} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/*
        卡头复述当前口径。不复述的话「按所属领域统计」这个选中态
        要靠左边那个浅蓝底去认——而图上的七根柱子本身没有任何字说明它按什么分。
      */}
      <div className="dmd-analysis-col dmd-inset dmd-trend-inset">
        <p className="dmd-inset-title">{ACTIVE_TREND_TAB.label}（个）</p>
        <div className="dmd-trend-chart">
          <Chart
            option={barOption}
            height="100%"
            ariaLabel={`${ACTIVE_TREND_TAB.label}：${DEMAND_DOMAIN_BARS.map((item) => `${item.domain} ${item.value}`).join('、')}`}
          />
        </div>
      </div>

      <div className="dmd-analysis-col dmd-funnel">
        <div className="dmd-analysis-head">
          <h2 className="panel-title dmd-analysis-title">按需求评审状态分布</h2>
          <button className="dmd-analysis-select" type="button">
            全部
            <ChevronDown size={13} color={colorV2.textTertiary} aria-hidden />
          </button>
        </div>
        <div className="dmd-funnel-body">
          <div className="dmd-funnel-chart">
            <Chart
              option={funnelOption}
              height="100%"
              ariaLabel={`按需求评审状态分布：${DEMAND_FUNNEL.map(
                (item) => `${item.state} ${item.value}，占 ${funnelShare(item.value)}`,
              ).join('；')}`}
            />
          </div>
          {/*
            六行等分整列高度，于是每行的垂直中心正对漏斗的一段——漏斗六段也是等高的。
            内容与左边的图重复，读屏交给图的 aria-label 念一遍就够了。
          */}
          <ul className="dmd-funnel-legend" aria-hidden>
            {DEMAND_FUNNEL.map((item, index) => (
              <li className="dmd-funnel-legend-row" key={item.state} data-testid="demand-funnel-legend-row">
                <span className="dmd-funnel-dot" style={{ background: DEMAND_FUNNEL_COLORS[index] }} />
                <span className="dmd-funnel-name">{item.state}</span>
                <span className="dmd-funnel-value">{item.value}</span>
                <span className="dmd-funnel-share">({funnelShare(item.value)})</span>
              </li>
            ))}
          </ul>
        </div>
        {/* 六段占比之和 134.9%。不写这句，第一个把六个数加一遍的人就会提一个数据缺陷 */}
        <p className="dmd-funnel-note">{DEMAND_FUNNEL_NOTE}</p>
      </div>

      {/* 需求动态：标题在卡内。卡外再顶一行标题会空出 30px，插画更矮 */}
      <div className="dmd-analysis-col dmd-feed">
        <div className="dmd-inset dmd-feed-inset">
          <h2 className="panel-title dmd-analysis-title">需求动态</h2>
          <div className="dmd-feed-body">
            <img className="dmd-feed-illustration" src={ASSETS.A04} alt="" aria-hidden />
            <div className="dmd-feed-copy">
              <p className="dmd-feed-title">{DEMAND_FEED.title}</p>
              <p className="dmd-feed-caption">{DEMAND_FEED.caption}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** R7 需求详情：1118,264,446,694 */
function DetailPanel() {
  const selected = DEMAND_ROWS.find((row) => row.id === DEMAND_SELECTED_ID);

  return (
    <section className="panel dmd-detail" data-region="R7" aria-label="需求详情">
      {/* 编号、标题、状态排一行。分两行时标题会掉到 y=300 往下，
          六个页签跟着下移，正文能用的高度少掉 26px —— 正好是「查看更多」那一行 */}
      <header className="dmd-detail-head">
        <p className="dmd-detail-id">{selected?.id}</p>
        <h2 className="dmd-detail-name">{selected?.name}</h2>
        {/* 当前评审状态跟在标题旁。列表里那一行也有，两处必须同源，
            所以取的是同一条 row 而不是另写一个字面量 */}
        {selected !== undefined && <ReviewStateTag state={selected.reviewState} />}
        <button className="dmd-panel-close" type="button" aria-label="关闭需求详情">
          <X size={14} color={colorV2.textTertiary} aria-hidden />
        </button>
      </header>

      <nav className="dmd-tabs" aria-label="需求详情页签">
        {DEMAND_DETAIL_TABS.map((tab) => (
          <button
            className="dmd-tab"
            key={tab}
            type="button"
            data-testid="demand-tab"
            // 文档「默认状态与交互」：默认标签「分流与处理」
            data-active={tab === DEMAND_DETAIL_ACTIVE_TAB}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="dmd-detail-body">
        {/* 字段成组装进浅框，组内每行带分隔线。446px 宽的一列里连排十几个
            「灰标签 + 深值」，不分组时读不出哪几行属于同一件事 */}
        <section className="dmd-group">
          <h3 className="dmd-detail-section">{DEMAND_DETAIL_SECTION_TITLE}</h3>
          <dl className="dmd-fields">
            {DEMAND_DETAIL_FIELDS.map((field) => (
              <div className="dmd-field" key={field.label} data-testid="demand-field">
                <dt>
                  <Diamond size={12} color={colorV2.textPlaceholder} aria-hidden />
                  {field.label}
                  {field.hint !== undefined && (
                    <span className="dmd-field-hint" title={field.hint}>
                      <Info size={12} color={colorV2.textTertiary} aria-hidden />
                    </span>
                  )}
                </dt>
                <dd>
                  {field.value === null ? (
                    <Blank />
                  ) : field.tag === true ? (
                    <span className="dmd-value-tag">{field.value}</span>
                  ) : (
                    field.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/*
          人员与它对应的那条元信息排一行两列：负责人配所属领域、提出人配提出时间。
          四项单列排时各占 40px，正文底部的需求描述会被挤到滚动区外面去。
          两个数组按下标配对，顺序由 fixture 保证，不在这里重排。
        */}
        <div className="dmd-people">
          {DEMAND_DETAIL_PEOPLE.map((person, index) => {
            const meta = DEMAND_DETAIL_META[index];
            return (
              <Fragment key={person.role}>
                <div className="dmd-person" data-testid="demand-person">
                  <span className="dmd-person-role">{person.role}</span>
                  <span className="dmd-person-body">
                    <Avatar name={person.name} size={24} />
                    <span className="dmd-person-text">
                      <span className="dmd-person-name">{person.name}</span>
                      {/* 岗位，不是账号角色。一期没有角色表（禁区第 11 项） */}
                      <span className="dmd-person-title">{person.title}</span>
                    </span>
                  </span>
                </div>
                {meta !== undefined && (
                  <div className="dmd-person" data-testid="demand-field">
                    <span className="dmd-person-role">{meta.label}</span>
                    <span className="dmd-person-body dmd-person-plain">
                      {meta.tag ? <span className="dmd-value-tag">{meta.value}</span> : meta.value}
                    </span>
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>

        <section className="dmd-group dmd-desc">
          <h3 className="dmd-detail-section">需求描述</h3>
          <p className="dmd-desc-text">{DEMAND_DESCRIPTION}</p>
          <button className="dmd-desc-more" type="button">
            {DEMAND_DESCRIPTION_MORE}
            <ChevronDown size={13} aria-hidden />
          </button>
        </section>
      </div>

      {/*
        四个按钮走 ActionGuard：可用的可点，不可用的置灰并把状态原因挂成 Tooltip。
        当前行是评审中，所以「开始评审」置灰 —— 按体验总纲 C-1，界面要能解释为什么不能操作，
        而不是把按钮藏掉让运营去猜。
      */}
      <footer className="dmd-detail-actions">
        <ActionGuard
          availability={DEMAND_ACTION_AVAILABILITY}
          // 四个按钮合计 380px（六字的「录入评审结论」一个就占 116px），正文只有 410px：
          // 默认 16px 间距下超 34px，第四个按钮换行。8px 间距刚好排成一行
          gap={space.xs}
          block
          actions={DEMAND_ACTION_ORDER.map((action) => ({
            action,
            type: action === '录入评审结论' ? ('primary' as const) : undefined,
            onClick: () => undefined,
          }))}
        />
      </footer>
    </section>
  );
}
