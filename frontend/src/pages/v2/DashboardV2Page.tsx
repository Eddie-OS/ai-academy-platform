import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronRight,
  FileText,
  Trophy,
  Upload,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EChartsOption, SeriesOption } from 'echarts';
import { Chart } from '@/shared/ui/v2/Chart';
import { Avatar } from '@/shared/ui/v2/Avatar';
import { AnimatedNumber } from '@/shared/ui/AnimatedNumber/AnimatedNumber';
import { WarningLight, WarningSummaryCard, redLightReasonOf } from '@/shared/ui/WarningLight';
import { ASSETS, colorV2 } from '@/shared/theme/designTokensV2';
import { usesFixtureData } from '@/app/fixtureSource';
import { formatMetricInt } from '@/shared/metrics/cockpitMetrics';
import { dashboardApi, type DashboardOverview } from '@/shared/api/dashboard';
import { objectDetailPath } from '@/shared/routing/objectDetailPath';
import { PENDING_TASK_TOTAL } from '@/fixtures/shell';
import {
  DASHBOARD_EFFICIENCY,
  DASHBOARD_ENTRIES,
  DASHBOARD_KPIS,
  DASHBOARD_WARNINGS,
  DASHBOARD_WORKLIST,
  DELTA_BASELINE_LABEL,
  EFFICIENCY_X_LABELS,
  ENTRY_STAT_LABELS,
  WARNING_RULE_LINK,
  WELCOME_LINES,
  warningMoreCount,
  type CockpitSection,
  type DashboardEntry,
  type EntryStat,
  type WorklistRow,
} from '@/fixtures/dashboard';
import './DashboardV2Page.css';

/**
 * P01 总看板（《设计文档 V2.0》第 5 章）。
 *
 * <p>九个区域各带 {@code data-region}，供视觉回归的 L1 坐标断言逐个取 boundingBox。
 * 编号与文档 5「区域坐标」表一一对应，不要改名。
 *
 * <h3>两套数据源</h3>
 *
 * 产品模式取 {@code /api/dashboard/overview}（阶段 3 的 aggregate/metrics 一次性装配好
 * 九个区域要的全部数字）；回归模式取 fixtures 的冻结数据。
 *
 * <p>回归模式<b>整个不发请求</b>（{@code enabled: !regression}），不是「发了再忽略」：
 * 请求回来那一帧会把冻结数字换成真实数字，截图基线随后端数据漂移，
 * 而失败现场是「昨天还过的用例今天红了，代码一行没动」。
 *
 * <p>数字一律由接口给，前端不再算第二遍 —— 同一个指标两套算法时，
 * 前端那套不受配置中心阈值影响（已记入 P-5）。
 *
 * <p>产品模式请求未回（或失败）时数字落「—」，<b>不回落冻结样例</b>。
 * 冻数是视觉回归基线（需求总数「1,268」），拿它填首屏会先闪假数再跳到库里的真数。
 * 演示构建没有后端，走 {@link usesFixtureData}，与回归模式共用冻数、不打回归标记。
 */
export function DashboardV2Page() {
  const fixture = usesFixtureData();
  const overview = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => dashboardApi.overview(),
    enabled: !fixture,
  });
  const data = fixture ? undefined : overview.data;
  const pending = !fixture && data === undefined;

  return (
    <div className="dash v2-page">
      <KpiRow data={data} pending={pending} />
      <EntryRow data={data} pending={pending} />

      <div className="dash-row dash-row-mid">
        <WarningPanel data={data} pending={pending} />
        <WorklistPanel data={data} pending={pending} />
      </div>

      {/* 底部两格。V2.0 这一行是三格，中间的 R8「业务价值」随 V-70 撤销，
          区域编号不重排：R9 仍叫 R9，改编号会让文档 5 的坐标表与代码对不上号 */}
      <div className="dash-row dash-row-bottom">
        <EfficiencyPanel data={data} pending={pending} />
        <WelcomePanel />
      </div>
    </div>
  );
}

/** 产品模式未拿到接口时的面板入参。回归模式 {@code pending} 永远是 false，读冻结数据 */
type LivePanelProps = {
  data?: DashboardOverview;
  pending: boolean;
};

/**
 * R3 五张 KPI 的图标，按 fixture 里的稳定 id 索引。
 *
 * <p>不按位置索引：位置对应的写法在增删一个 KPI 时不会报错，
 * 只会让五个图标整体错位一格，而错位后的图标个个都是「合理」的，评审时极难发现。
 * 这一点在 V-70 撤掉「课程总数」时刚兑现过一次。
 *
 * <p>也不按中文指标名索引：「已发布课程」里含状态词「已发布」，
 * 在页面文件里写这个字面量会撞上 STK-1 门禁，而它确实不该出现在这里。
 */
const KPI_ICONS: Record<string, LucideIcon> = {
  demandTotal: FileText,
  coursePublished: Upload,
  lecturerPool: Users,
  trainingSession: CalendarDays,
  caseListed: Trophy,
};

function KpiRow({ data, pending }: LivePanelProps) {
  return (
    <section className="dash-kpis" data-region="R3" aria-label="核心指标">
      {DASHBOARD_KPIS.map((kpi) => {
        const Icon = KPI_ICONS[kpi.id] ?? FileText;
        // fixture 的 id 就是接口 quantity 段的字段名，不需要第二张映射表。
        // 产品模式未回时写「—」，不写冻结的「1,268」——那是回归基线，不是首屏占位
        const value = data
          ? formatMetricInt(data.quantity[kpi.id])
          : pending
            ? '—'
            : kpi.value;
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
            <div className="kpi-value"><AnimatedNumber value={value} duration={520} /></div>
            <div className="kpi-foot">
              {data || pending ? (
                /* 真实数字没有环比可配：对照期的口径属阶段 3 的指标接口，接口没给。
                   把冻结数据的「↑ 12.5%」留在真实数字下面，等于让人拿真数比假基准。
                   基准句仍写出「月度环比」，与需求驾驶舱同一口径，不写「实时统计」 */
                <span className="kpi-baseline">{DELTA_BASELINE_LABEL}</span>
              ) : (
                <>
                  <span className="kpi-delta">{kpi.delta}</span>
                  <span className="kpi-baseline">{DELTA_BASELINE_LABEL}</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/**
 * 与标签元组等长的字段名元组。
 *
 * <p>{@code T} 必须是<b>裸类型参数</b>才能让 TS 按元组同态映射、把长度带过来。
 * 直接把 {@code (typeof ENTRY_STAT_LABELS)[K]} 写进映射类型不行 ——
 * 那时 TS 会去映射 length／join／slice 等全部属性，得到一个每个属性都是 string
 * 的对象类型，长度约束随之失效。
 */
type FieldsFor<T extends readonly unknown[]> = { [I in keyof T]: string };

/**
 * 五张入口卡的底部数各取 {@code cockpits} 分节里的哪几个字段。
 *
 * <p>顺序即渲染顺序，与 {@link ENTRY_STAT_LABELS} 同一分节的标签按下标配对。
 * 标签写在 fixtures 而不是这里，是因为其中几个含状态词会被 STK-1 门禁拦下。
 *
 * <p>类型是<b>按标签表逐节映射</b>出来的，因此每一节的字段个数必须与该节标签个数相同：
 * 培训与案例是两条、其余三节是三条，多一个少一个都编译不过。写成
 * {@code Record<CockpitSection, string[]>} 也能跑，但那样「标签三条、字段两条」
 * 只会让第三个数静静地显示成「—」，看着完全像是后端没给这个指标。
 *
 * <p>键的类型是 {@link CockpitSection}，与标签表同源——少一节或多一节也编译不过。
 * 这一层原先是按 {@code pageKey} 分支的 switch，而 pageKey 的权威定义在侧栏
 * （讲师那项叫 {@code instructor}），switch 里写的是 {@code lecturer}：
 * 两处不一致既不报错也走不到 default 之外，只是讲师卡在产品模式下永远拿不到真实数字。
 */
const ENTRY_LIVE_FIELDS: {
  [K in CockpitSection]: FieldsFor<(typeof ENTRY_STAT_LABELS)[K]>;
} = {
  demands: ['pending', 'developing', 'total'],
  courses: ['developed', 'reviewed', 'published'],
  lecturers: ['pendingTrial', 'cultivating', 'qualified'],
  trainings: ['sessions', 'attendees'],
  cases: ['published', 'views'],
};

/**
 * 把 {@code cockpits} 段折成一张入口卡的底部数。
 *
 * <p>接口回了但缺这一节时不回 {@code null}，而是让每个数落成「—」：{@code null} 会退到
 * 冻结数据，于是「这一节接口没给」在界面上长成一组看着很正常的假数字。
 */
function liveEntry(entry: DashboardEntry, data?: DashboardOverview): EntryStat[] | null {
  if (!data) return null;

  const section = data.cockpits[entry.cockpit];
  const labels: readonly string[] = ENTRY_STAT_LABELS[entry.cockpit];
  const fields: readonly string[] = ENTRY_LIVE_FIELDS[entry.cockpit];

  return labels.map((label, index) => ({
    label,
    value: formatMetricInt(section?.[fields[index]!]),
  }));
}

function placeholderEntryStats(entry: DashboardEntry): EntryStat[] {
  return ENTRY_STAT_LABELS[entry.cockpit].map((label) => ({ label, value: '—' }));
}

function EntryRow({ data, pending }: LivePanelProps) {
  const fixture = usesFixtureData();

  return (
    <section className="dash-entries" data-region="R4" aria-label="业务入口">
      {DASHBOARD_ENTRIES.map((entry) => {
        /* 回归／演示照抄 V2.0 的冻结数。产品模式只用接口；未回时用「—」占位，
           不退冻结数——冻数会在真数到达前闪一帧（需求总数「1,268」就是这样来的） */
        const stats = fixture
          ? entry.stats
          : pending
            ? placeholderEntryStats(entry)
            : (liveEntry(entry, data) ?? placeholderEntryStats(entry));

        return (
          <Link className="entry" to={entry.path} key={entry.pageKey} data-testid="dash-entry">
            <div className="entry-head">
              <span className="entry-title">{entry.title}</span>
              <span className="entry-link">
                去查看
                <ChevronRight size={12} strokeWidth={2} aria-hidden />
              </span>
            </div>

            <img className="entry-illustration" src={entry.illustration} alt="" aria-hidden />

            <div className="entry-stats">
              {stats.map((stat) => (
                <div className="entry-stat" key={stat.label} data-testid="entry-stat">
                  <span className="entry-stat-label">{stat.label}</span>
                  <span className="entry-stat-value">{stat.value}</span>
                </div>
              ))}
            </div>
          </Link>
        );
      })}
    </section>
  );
}

/**
 * R5 三色灯预警，三张卡横排。
 *
 * <p>按业务裁决（V-9）蓝灯即健康态，因此<b>没有第四张「健康对象数」卡</b>——
 * 它与蓝灯卡讲的是同一件事。接口仍回 {@code healthy}，它作为卡头旁的一行小字出现，
 * 不占一张卡的位置。
 *
 * <p>每张卡自带「一键催办」，面板头部因此换成「规则说明」。
 * 三个按钮而不是一个：催办的对象集合按灯色分（催蓝灯对象毫无意义），
 * 头部放一个总催办按钮反而说不清催的是谁。
 */
function WarningPanel({ data, pending }: LivePanelProps) {
  const navigate = useNavigate();

  const cards = data
    ? DASHBOARD_WARNINGS.map((item) => ({
        ...item,
        count:
          item.color === 'BLUE'
            ? data.warnings.blue
            : item.color === 'YELLOW'
              ? data.warnings.yellow
              : data.warnings.red,
        /* 样例对象从待办清单里按灯色挑三条。清单本身就是按紧急度排好的，
           另开一个接口只为取三个名字不值当 */
        samples: data.worklist
          .filter((row) => row.light === item.color)
          .slice(0, 3)
          .map((row) => ({ id: row.objectName, type: row.objectType })),
      }))
    : pending
      ? DASHBOARD_WARNINGS.map((item) => ({ ...item, count: null, samples: [] }))
      : DASHBOARD_WARNINGS;

  return (
    <section className="panel dash-warning" data-region="R5" aria-label="三色灯预警">
      <div className="panel-head">
        <h2 className="panel-title">三色灯预警</h2>
        {data && <span className="panel-note">健康 {formatMetricInt(data.warnings.healthy)}</span>}
        <Link className="panel-action" to="/settings">
          {WARNING_RULE_LINK}
          <ChevronRight size={14} strokeWidth={1.8} />
        </Link>
      </div>
      <div className="warning-grid">
        {cards.map((item) => (
          <WarningSummaryCard
            key={item.color}
            color={item.color}
            count={item.count}
            caption={item.caption}
            samples={item.samples}
            moreCount={item.count == null ? 0 : warningMoreCount(item.count, item.samples.length)}
            /* 回归模式不给 onMore：冻结数据下点进明细页只会看到与卡上对不上的真实数据。
               不传时「更多（N）」整个不渲染，这也是三张卡在基线里的样子 */
            onMore={data ? () => navigate(`/warnings?light=${item.color}`) : undefined}
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
 * <p>七列合计 810px。V-71b：左右向中间收 —— 责任人要扣掉首列 16px 内边距后
 * 仍能放下三字名；右侧日期／天数／灯／操作加宽，避免「2026-08-24」叠到「244 天」上。
 * 业务对象与当前节点收窄（短文案不需要中间留白）。
 *
 * <p><b>七列都写死宽度</b>，不再留一列 width:undefined。缺一列时，面板比 810 宽的
 * 那截余量会全部灌进这一列，中间空一大块、左右照样挤 —— 截图里的样子就是这样来的。
 * 七列都有宽度时，余量按列宽比例分给每一列，左右一起往中间长。
 */
const WORKLIST_COLUMNS = [
  { key: 'owner', label: '责任人', width: 152 },
  { key: 'object', label: '业务对象', width: 120 },
  { key: 'node', label: '当前节点', width: 88 },
  { key: 'deadline', label: '截止日期', width: 118 },
  { key: 'days', label: '剩余天数', width: 88 },
  { key: 'light', label: '预警灯', width: 124 },
  { key: 'action', label: '操作', width: 120 },
] as const;

function WorklistPanel({ data, pending }: LivePanelProps) {
  const rows: WorklistRow[] = data
    ? data.worklist.map((item, index) => ({
        // 同一个对象可能同时因多条规则进清单，objectType+objectId 不唯一，补下标兜住 key
        id: `W-${item.objectType}-${item.objectId}-${index}`,
        objectType: item.objectType,
        objectId: item.objectId,
        /* 只展示姓名。缺姓名时写「—」而不是工号——工号落在责任人列会被读成
           「这人叫 E01234」，三字人名的列宽也装不下工号 */
        owner: item.ownerName?.trim() || '—',
        object: item.objectName,
        node: item.currentState,
        deadline: item.expectFinishDate ?? '—',
        remainingDays: item.remainingDays ?? 0,
        light: item.light,
        /* 成因取接口的 lightReason。这里曾把红灯一律写成「停滞」——
           真正逾期的对象于是在待办清单上被说成停滞，而两种成因的天数从不同时间点起算，
           读者无从发现这一行是错的 */
        lightReason: item.light === 'RED' ? redLightReasonOf(item.lightReason) : undefined,
      }))
    : pending
      ? []
      : DASHBOARD_WORKLIST;

  /* 计数是待办总数。标题旁的数字与表格可见行数可以不同——表格在面板里滚动，
     欢迎卡写的是全量。写成 rows.length 在冻结数据下碰巧对得上，产品模式接口
     只回前 N 条时就会和欢迎卡对不上 */
  const total = data ? data.worklist.length : pending ? '—' : PENDING_TASK_TOTAL;

  return (
    <section className="panel dash-worklist" data-region="R6" aria-label="待办行动清单">
      <div className="panel-head">
        <h2 className="panel-title">待办行动清单</h2>
        <span className="panel-count">{total}</span>
        <Link className="panel-action" to="/tasks">
          全部待办
          <ChevronRight size={14} strokeWidth={1.8} />
        </Link>
      </div>
      {/* 滚动包在表外：表头 sticky 钉在这层顶沿，行高压紧后多出来的行靠这里滚 */}
      <div className="worklist-scroll" data-testid="worklist-scroll">
        <table className="worklist">
          <colgroup>
            {WORKLIST_COLUMNS.map((column) => (
              <col key={column.key} style={{ width: column.width }} />
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
            {rows.map((row) => (
              <WorklistTableRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OwnerCell({ name }: { name: string }) {
  return (
    <span className="worklist-owner">
      <Avatar name={name} size={24} />
      <span className="worklist-owner-name">{name}</span>
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
        {/* 天数在左边那一列；这里只出图标与两字标签（short）。
            WV1 的「图标+标签+天数」由这两列共同满足。全称「状态停滞」在 110px
            里会把徽章撑到贴边，右侧看起来比左侧更挤 */}
        {row.light === 'NONE' ? (
          <WarningLight color="NONE" variant="badge" short />
        ) : row.light === 'RED' ? (
          // 红灯必须说明成因，否则「已逾期」与「状态停滞」二选一时会挑错
          <WarningLight
            color="RED"
            reason={row.lightReason ?? 'OVERDUE'}
            daysShownInSeparateColumn
            variant="badge"
            short
          />
        ) : (
          <WarningLight color={row.light} daysShownInSeparateColumn variant="badge" short />
        )}
      </td>
      <td>
        <Link
          className="worklist-action"
          to={objectDetailPath(row.objectType, row.objectId)}
          data-testid="worklist-action"
        >
          去处理
        </Link>
      </td>
    </tr>
  );
}

/**
 * R7 四条效率指标在 {@code efficiency} 与 {@code efficiencyTrends.series} 里的字段名。
 *
 * <p>顺序与 {@link DASHBOARD_EFFICIENCY} 严格对应：两个数组按下标配对，
 * 错位后画出来的图看不出是错的（四条都是「一条向下的折线」）。
 */
const EFFICIENCY_KEYS = [
  'demandReviewCycle',
  'courseDevCycle',
  'firstRoundPassRate',
  'casePublishCycle',
] as const;

/** 四条里唯一的百分比指标。其余三条是周期均值，单位「天」 */
const PASS_RATE_INDEX = 2;

/**
 * 当期值。接口按 API-5 用字符串传比率与均值，前端只补单位不做四舍五入 ——
 * 保留几位小数是指标口径（3.3：均值 1 位小数），由后端定死。
 */
function efficiencyDisplay(data: DashboardOverview | undefined, index: number): string | null {
  const key = EFFICIENCY_KEYS[index];
  if (!data || !key) return null;
  const raw = data.efficiency[key];
  if (raw == null) return '—';
  return index === PASS_RATE_INDEX ? `${raw}%` : `${raw} 天`;
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
function EfficiencyPanel({ data, pending }: LivePanelProps) {
  // 图表配置与它对应的指标打包在一起。分成两个数组再按下标配对，
  // 一旦两边长度不同步就会画错图，而且画出来的图看不出是错的
  const items = useMemo(
    () =>
      DASHBOARD_EFFICIENCY.map((item, index) => {
        const ticks = item.axisTicks;
        const display = pending ? '—' : (efficiencyDisplay(data, index) ?? item.display);
        const key = EFFICIENCY_KEYS[index];
        const months = data?.efficiencyTrends?.months;
        const rawSeries = key ? data?.efficiencyTrends?.series?.[key] : undefined;

        // 接口给的是 yyyy-MM 六格，横轴只显示月份；冻结数据是八个 MM-DD
        const xLabels = months ? months.map((month) => month.slice(5)) : [...EFFICIENCY_X_LABELS];
        const series = pending
          ? xLabels.map(() => null)
          : rawSeries
            ? rawSeries.map((value) => {
                // 无样本的月份回 null，画成断点而不是 0 —— 0 会被读成「那个月一次都没通过」
                if (value == null) return null;
                const parsed = Number(value);
                return Number.isFinite(parsed) ? parsed : null;
              })
            : [...item.series];

        const lastIndex = series.length - 1;
        const lastValue = series[lastIndex];

        /* 系列拼在选项外面并显式标注类型：数组是用展开拼出来的，
           内联写时 'scatter'／'top' 这些字面量会被拓宽成 string，
           EChartsOption 的判别联合就认不出这是散点系列 */
        const chartSeries: SeriesOption[] = [
          {
            type: 'line',
            data: series,
            smooth: true,
            // 中间月份缺样本时把两端连起来，而不是把折线断成几截。
            // 断点已经由 null 表达（不画数据点），再断线只会让 150px 的图读不出趋势
            connectNulls: true,
            symbol: 'none',
            lineStyle: { width: 2, color: colorV2.brandPrimary },
            areaStyle: { color: colorV2.brand50 },
          },
        ];

        // 终点没样本时整个标注不画：画在 null 上会落到坐标原点，看起来像「最后一期掉到 0」
        if (lastValue != null) {
          chartSeries.push({
            // 终点单独一个散点 + 标注。不用 markPoint：markPoint 的默认气泡
            // 会盖住相邻数据点，而这里只需要一个圆点加一行字
            type: 'scatter',
            data: [[lastIndex, lastValue]],
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
              formatter: `${xLabels[lastIndex]}\n${display}`,
            },
          });
        }

        return {
          ...item,
          display,
          series,
          option: {
            grid: { left: 30, right: 8, top: 16, bottom: 18 },
            xAxis: {
              type: 'category',
              data: xLabels,
              boundaryGap: false,
              axisLine: { lineStyle: { color: colorV2.borderDefault } },
              axisTick: { show: false },
              // 冻结数据的八个日期标签在 150px 的绘图区里必然重叠，隔一个显示。
              // 接口的六格月份放得下，但两种模式共用一套 option，隔一个显示两边都不会挤
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
            series: chartSeries,
          } satisfies EChartsOption,
        };
      }),
    [data, pending],
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
              {/* 环比只在冻结数据下出现：方向按指标语义定（周期越小越好，缩短显示向下箭头），
                  而真实数据的对照期口径属阶段 3 的指标接口，接口没给就不能自己编一个 */}
              {!data && !pending && (
                <span className="efficiency-delta" data-better={item.betterWhen}>
                  {item.betterWhen === 'lower' ? '↓' : '↑'} {item.delta}
                </span>
              )}
            </span>
            <span className="efficiency-baseline">
              {data ? '实时统计' : pending ? '' : '较上周期'}
            </span>
            {/* 高度交给 CSS：设计稿下剩余正好 88px，窗口变高时图跟着长 */}
            <div className="efficiency-chart">
              <Chart
                option={item.option}
                height="100%"
                ariaLabel={`${item.label}近六月趋势，当前 ${item.display}`}
              />
            </div>
          </div>
        ))}
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
