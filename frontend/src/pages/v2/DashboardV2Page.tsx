import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Coins,
  FileText,
  Gauge,
  Trophy,
  Upload,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { Chart } from '@/shared/ui/v2/Chart';
import { Avatar } from '@/shared/ui/v2/Avatar';
import { WarningLight, WarningSummaryCard } from '@/shared/ui/WarningLight';
import { ASSETS, colorV2 } from '@/shared/theme/designTokensV2';
import { isRegressionMode } from '@/app/regressionMode';
import { PENDING_TASK_TOTAL } from '@/fixtures/shell';
import {
  DASHBOARD_EFFICIENCY,
  DASHBOARD_ENTRIES,
  DASHBOARD_KPIS,
  DASHBOARD_VALUE,
  DASHBOARD_WARNINGS,
  DASHBOARD_WORKLIST,
  DELTA_BASELINE_LABEL,
  EFFICIENCY_X_LABELS,
  VALUE_SOURCE_NOTE,
  WARNING_RULE_LINK,
  WELCOME_LINES,
  warningMoreCount,
  type WorklistRow,
} from '@/fixtures/dashboard';
import './DashboardV2Page.css';

/**
 * P01 总看板（《设计文档 V2.0》第 5 章）。
 *
 * <p>九个区域各带 {@code data-region}，供视觉回归的 L1 坐标断言逐个取 boundingBox。
 * 编号与文档 5「区域坐标」表一一对应，不要改名。
 *
 * <p><b>数字全部来自 fixtures，不调接口。</b>54 个指标属阶段 3 的 aggregate/metrics，
 * 此刻在前端现算一遍的后果不是「数字暂时不准」，而是阶段 3 上线后同一个指标有两套算法，
 * 其中一套不受配置中心阈值影响（已记入 P-5）。
 */
export function DashboardV2Page() {
  return (
    <div className="dash v2-page">
      <KpiRow />
      <EntryRow />

      <div className="dash-row dash-row-mid">
        <WarningPanel />
        <WorklistPanel />
      </div>

      <div className="dash-row dash-row-bottom">
        <EfficiencyPanel />
        <ValuePanel />
        <WelcomePanel />
      </div>
    </div>
  );
}

/**
 * R3 六张 KPI 的图标，按 fixture 里的稳定 id 索引。
 *
 * <p>不按位置索引：位置对应的写法在增删一个 KPI 时不会报错，
 * 只会让六个图标整体错位一格，而错位后的图标个个都是「合理」的，评审时极难发现。
 *
 * <p>也不按中文指标名索引：「已发布课程」里含状态词「已发布」，
 * 在页面文件里写这个字面量会撞上 STK-1 门禁，而它确实不该出现在这里。
 */
const KPI_ICONS: Record<string, LucideIcon> = {
  demandTotal: FileText,
  courseTotal: BookOpen,
  coursePublished: Upload,
  lecturerPool: Users,
  trainingSession: CalendarDays,
  caseListed: Trophy,
};

function KpiRow() {
  return (
    <section className="dash-kpis" data-region="R3" aria-label="核心指标">
      {DASHBOARD_KPIS.map((kpi) => {
        const Icon = KPI_ICONS[kpi.id] ?? FileText;
        return (
          <div className="kpi" key={kpi.id} data-testid="dash-kpi" data-kpi={kpi.id}>
            <div className="kpi-top">
              <span className="kpi-label">{kpi.label}</span>
              {/* 图标在右上角的浅色圆角块里。它不承载信息（指标名已是文本），
                  所以 aria-hidden —— 屏幕阅读器读到六个「文件」图标只是噪音 */}
              <span className="kpi-plate" aria-hidden>
                <Icon size={18} strokeWidth={1.8} />
              </span>
            </div>
            <div className="kpi-value">{kpi.value}</div>
            <div className="kpi-foot">
              <span className="kpi-delta">{kpi.delta}</span>
              <span className="kpi-baseline">{DELTA_BASELINE_LABEL}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function EntryRow() {
  const regression = isRegressionMode();

  return (
    <section className="dash-entries" data-region="R4" aria-label="业务入口">
      {DASHBOARD_ENTRIES.map((entry) => (
        <Link className="entry" to={entry.path} key={entry.pageKey} data-testid="dash-entry">
          <div className="entry-head">
            <span className="entry-title">{entry.title}</span>
            <span className="entry-badge">{entry.badge}</span>
            <span className="entry-link">
              去查看
              <ChevronRight size={12} strokeWidth={2} aria-hidden />
            </span>
          </div>

          <img className="entry-illustration" src={entry.illustration} alt="" aria-hidden />

          <div className="entry-stats">
            {/* V-8：回归模式照抄 V2.0 的三数，产品模式换成 productStats（案例卡的组织覆盖
                口径随 N18 删除）。整组换而不是逐条过滤，理由写在 productStats 的注释上 */}
            {(regression ? entry.stats : entry.productStats ?? entry.stats).map((stat) => (
              <div className="entry-stat" key={stat.label} data-testid="entry-stat">
                <span className="entry-stat-label">{stat.label}</span>
                <span className="entry-stat-value">{stat.value}</span>
              </div>
            ))}
          </div>
        </Link>
      ))}
    </section>
  );
}

/**
 * R5 三色灯预警，三张卡横排。
 *
 * <p>按业务裁决（V-9）蓝灯即健康态，因此<b>没有第四张「健康对象数」卡</b>——
 * 它与蓝灯卡讲的是同一件事。
 *
 * <p>每张卡自带「一键催办」，面板头部因此换成「规则说明」。
 * 三个按钮而不是一个：催办的对象集合按灯色分（催蓝灯对象毫无意义），
 * 头部放一个总催办按钮反而说不清催的是谁。
 */
function WarningPanel() {
  return (
    <section className="panel dash-warning" data-region="R5" aria-label="三色灯预警">
      <div className="panel-head">
        <h2 className="panel-title">三色灯预警</h2>
        <Link className="panel-action" to="/settings">
          {WARNING_RULE_LINK}
          <ChevronRight size={14} strokeWidth={1.8} />
        </Link>
      </div>
      <div className="warning-grid">
        {DASHBOARD_WARNINGS.map((item) => (
          <WarningSummaryCard
            key={item.color}
            color={item.color}
            count={item.count}
            caption={item.caption}
            samples={item.samples}
            moreCount={warningMoreCount(item.count, item.samples.length)}
            onMore={() => undefined}
            onUrge={() => undefined}
            compact
          />
        ))}
      </div>
    </section>
  );
}

/**
 * R6 待办行动清单。
 *
 * <p>七列列宽必须照抄（文档 5「内部几何」）：责任人90｜业务对象165｜当前节点135｜
 * 截止日期130｜剩余天数80｜预警灯100｜操作110 = 810px。
 *
 * <p>业务对象列写 165 但设成唯一伸缩列：810 减去其余六列（90+135+130+80+100+110=645）
 * 正好剩 165，所以「伸缩」与「写死 165」在基线宽度下等价；面板变宽时只有它伸长，
 * 其余六列纹丝不动。若让多列都伸缩，1320px 下的四舍五入会在七列上累积成 3～4px。
 */
const WORKLIST_COLUMNS = [
  { key: 'owner', label: '责任人', width: 90 },
  { key: 'object', label: '业务对象', width: undefined },
  { key: 'node', label: '当前节点', width: 135 },
  { key: 'deadline', label: '截止日期', width: 130 },
  { key: 'days', label: '剩余天数', width: 80 },
  { key: 'light', label: '预警灯', width: 100 },
  { key: 'action', label: '操作', width: 110 },
] as const;

function WorklistPanel() {
  return (
    <section className="panel dash-worklist" data-region="R6" aria-label="待办行动清单">
      <div className="panel-head">
        <h2 className="panel-title">待办行动清单</h2>
        {/* 计数是待办总数，不是表格行数。这一屏只展示前五条，「全部待办」才是全量入口；
            写成 DASHBOARD_WORKLIST.length 会得到 5，而同一屏的欢迎卡写着「共 12 项待办」 */}
        <span className="panel-count">{PENDING_TASK_TOTAL}</span>
        <Link className="panel-action" to="/tasks">
          全部待办
          <ChevronRight size={14} strokeWidth={1.8} />
        </Link>
      </div>
      <table className="worklist">
        <colgroup>
          {WORKLIST_COLUMNS.map((column) => (
            <col key={column.key} style={column.width ? { width: column.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {WORKLIST_COLUMNS.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DASHBOARD_WORKLIST.map((row) => (
            <WorklistTableRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function OwnerCell({ name }: { name: string }) {
  return (
    <span className="worklist-owner">
      <Avatar name={name} size={24} />
      {name}
    </span>
  );
}

function WorklistTableRow({ row }: { row: WorklistRow }) {
  const overdue = row.remainingDays < 0;
  return (
    <tr data-testid="worklist-row" data-owner={row.owner}>
      <td>
        <OwnerCell name={row.owner} />
      </td>
      <td className="worklist-cell-object" title={row.object}>
        {row.object}
      </td>
      <td>{row.node}</td>
      <td className="worklist-cell-date">{row.deadline}</td>
      {/*
       * 剩余天数按灯色着色，而不是按天数自己判阈值。
       * 阈值由配置中心可配（需求 13.4.1a），在这里写死一套「≤3 天就变黄」的判断，
       * 配置改了这一列不跟着变，同一行会出现黄字配蓝灯。
       */}
      <td className="worklist-cell-days" data-overdue={overdue} data-light={row.light}>
        {/* 3.3：天数为整数 + 「天」。逾期显示负号，不写「逾期 N 天」——
            那句话已经在同一行的预警灯里，重复两遍会把 80px 的列撑破 */}
        {row.remainingDays} 天
      </td>
      <td>
        {/* 天数在左边那一列，这里只出图标与标签。WV1 的「图标+标签+天数」
            由这两列共同满足，不是省掉了天数 */}
        {row.light === 'NONE' ? (
          <WarningLight color="NONE" variant="badge" />
        ) : row.light === 'RED' ? (
          // 红灯必须说明成因，否则「已逾期」与「状态停滞」二选一时会挑错
          <WarningLight
            color="RED"
            reason={row.lightReason ?? 'OVERDUE'}
            daysShownInSeparateColumn
            variant="badge"
          />
        ) : (
          <WarningLight color={row.light} daysShownInSeparateColumn variant="badge" />
        )}
      </td>
      <td>
        <button type="button" className="worklist-action">
          去处理
        </button>
      </td>
    </tr>
  );
}

/**
 * R7 效率指标四条折线。
 *
 * <p>四张图各带纵轴三档刻度、横轴日期与终点标注。807px 里塞四张图、每张不到 190px，
 * 刻度只给三档（0／中／满）—— 五档会挤成一片灰。
 *
 * <p>纵轴<b>从 0 起且封顶写死</b>（`axisTicks`）：四条序列量级差 10 倍以上
 * （5.6 天 vs 71.2%），让 ECharts 自动定域时每张图的基线各不相同，
 * 四条折线并排看起来像是同一量纲，会读出完全错误的相对高低。
 */
function EfficiencyPanel() {
  // 图表配置与它对应的指标打包在一起。分成两个数组再按下标配对，
  // 一旦两边长度不同步就会画错图，而且画出来的图看不出是错的
  const items = useMemo(
    () =>
      DASHBOARD_EFFICIENCY.map((item) => {
        const ticks = item.axisTicks;
        const lastIndex = item.series.length - 1;
        return {
          ...item,
          option: {
            grid: { left: 30, right: 8, top: 16, bottom: 18 },
            xAxis: {
              type: 'category',
              data: [...EFFICIENCY_X_LABELS],
              boundaryGap: false,
              axisLine: { lineStyle: { color: colorV2.borderDefault } },
              axisTick: { show: false },
              // 八个日期标签在 150px 的绘图区里必然重叠，隔一个显示
              axisLabel: { interval: 1, fontSize: 9, color: colorV2.textTertiary, margin: 6 },
            },
            yAxis: {
              type: 'value',
              min: ticks[0],
              max: ticks[ticks.length - 1],
              interval: ticks[1]! - ticks[0]!,
              axisLine: { show: false },
              axisTick: { show: false },
              axisLabel: {
                fontSize: 9,
                color: colorV2.textTertiary,
                margin: 4,
                formatter: (value: number) => `${value}${item.axisUnit}`,
              },
              splitLine: { lineStyle: { color: colorV2.borderLight, type: 'dashed' } },
            },
            series: [
              {
                type: 'line',
                data: [...item.series],
                smooth: true,
                symbol: 'none',
                lineStyle: { width: 2, color: colorV2.brandPrimary },
                areaStyle: { color: colorV2.brand50 },
              },
              {
                // 终点单独一个散点 + 标注。不用 markPoint：markPoint 的默认气泡
                // 会盖住相邻数据点，而这里只需要一个圆点加一行字
                type: 'scatter',
                data: [[lastIndex, item.series[lastIndex]!]],
                symbolSize: 5,
                itemStyle: { color: colorV2.brandPrimary },
                label: {
                  show: true,
                  position: 'top',
                  // 锚点就在绘图区右边缘，默认的居中对齐会让一半标注溢出被 SVG 裁掉
                  // （表现为「06-1」「5.6 ヌ」这种缺字，textContent 里却是完整的）。
                  // 右对齐让文字整体向左展开
                  align: 'right',
                  distance: 2,
                  fontSize: 9,
                  lineHeight: 11,
                  color: colorV2.textSecondary,
                  formatter: `${EFFICIENCY_X_LABELS[lastIndex]}\n${item.display}`,
                },
              },
            ],
          } satisfies EChartsOption,
        };
      }),
    [],
  );

  return (
    <section className="panel dash-efficiency" data-region="R7" aria-label="效率指标">
      <div className="panel-head">
        <h2 className="panel-title">效率指标</h2>
      </div>
      <div className="efficiency-grid">
        {items.map((item) => (
          <div className="efficiency-item" key={item.label} data-testid="efficiency-item">
            <span className="efficiency-label">{item.label}</span>
            <span className="efficiency-row">
              <span className="efficiency-value">{item.display}</span>
              {/* 方向按指标语义定：周期越小越好，所以缩短要显示向下箭头。
                  四张卡统一朝上并统一涂绿，会把「开发周期变长」也画成向好 */}
              <span className="efficiency-delta" data-better={item.betterWhen}>
                {item.betterWhen === 'lower' ? '↓' : '↑'} {item.delta}
              </span>
            </span>
            <span className="efficiency-baseline">{DELTA_BASELINE_LABEL}</span>
            {/* 高度交给 CSS：设计稿下剩余正好 88px，窗口变高时图跟着长 */}
            <div className="efficiency-chart">
              <Chart
                option={item.option}
                height="100%"
                ariaLabel={`${item.label}近八期趋势，当前 ${item.display}`}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** R8 三条业务价值的图标。与 KPI 一样按稳定 id 索引，不按位置 */
const VALUE_ICONS: Record<string, LucideIcon> = {
  efficiency: Gauge,
  quality: BadgeCheck,
  cost: Coins,
};

/** R8 业务价值。需求第 7 章为人工填报，一期没有计算口径，因此没有环比 */
function ValuePanel() {
  return (
    <section className="panel dash-value" data-region="R8" aria-label="业务价值">
      <div className="panel-head">
        <h2 className="panel-title">业务价值</h2>
        {/* 口径说明紧贴标题，不放在卡片底部：它决定了这三个数能不能被复核，
            读者必须在看到数字之前就知道它是填报来的 */}
        <span className="panel-note">{VALUE_SOURCE_NOTE}</span>
        <Link className="panel-action" to="/settings">
          查看明细
          <ChevronRight size={14} strokeWidth={1.8} />
        </Link>
      </div>
      <div className="value-list">
        {DASHBOARD_VALUE.map((item) => {
          const Icon = VALUE_ICONS[item.id] ?? Gauge;
          return (
            <div className="value-item" key={item.id} data-testid="value-item" data-tone={item.tone}>
              <span className="value-plate" aria-hidden>
                <Icon size={16} strokeWidth={1.8} />
              </span>
              <span className="value-label">{item.label}</span>
              <span className="value-number">
                {item.trend !== null && <span className="value-trend">{item.trend}</span>}
                {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** R9 欢迎卡。素材按文档 5「素材映射」用 A11 */
function WelcomePanel() {
  return (
    <section className="panel welcome dash-welcome" data-region="R9" aria-label="欢迎">
      <div className="welcome-title">欢迎回来，张小北</div>
      {/* 措辞避开「等待处理」：那四个字里夹着状态值「待处理」，会被 STK-1 门禁按子串命中。
          门禁在这里报得没错——页面文件本来就不该出现状态字面量，换个说法比加白名单干净 */}
      {WELCOME_LINES.map((line) => (
        <div className="welcome-caption" key={line}>
          {line}
        </div>
      ))}
      <img className="welcome-illustration" src={ASSETS.A11} alt="" aria-hidden />
    </section>
  );
}
