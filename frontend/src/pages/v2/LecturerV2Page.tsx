import {
  BadgeCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  CircleX,
  MonitorPlay,
  Search,
  Star,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Avatar } from '@/shared/ui/v2/Avatar';
import { ASSETS, colorV2 } from '@/shared/theme/designTokensV2';
import { isRegressionMode } from '@/app/regressionMode';
import {
  ATTENDEE_SCALE,
  GROWTH_ADVICE,
  LECTURER_DETAIL_ACTIVE_TAB,
  LECTURER_DETAIL_DOMAINS,
  LECTURER_DETAIL_DOMAINS_MORE,
  LECTURER_DETAIL_TABS,
  LECTURER_DETAIL_TITLE,
  LECTURER_FILTERS,
  LECTURER_GROUPS,
  LECTURER_KPIS,
  LECTURER_POOL_TOTAL,
  LECTURER_SELECTED_ID,
  TEACHING_RECORDS,
  TRIAL_CONCLUSION_QUALIFIED,
  TRIAL_LEDGER,
  TRIAL_LEDGER_COLUMNS,
  TRIAL_TIMELINE,
  type LecturerCard,
  type LecturerGroup,
} from '@/fixtures/lecturer';
import './LecturerV2Page.css';

/**
 * P04 讲师与能力地图（《设计文档 V2.0》第 8 章）。
 *
 * <p>五个区域各带 {@code data-region}，编号与文档 8「区域坐标」表一一对应。
 * 版式与前三页最大的不同是 <b>R7 讲师详情与左栏同起同止</b>（y=203～956），
 * 而 KPI 行独占上方一条横带 —— P03 的详情是从顶栏下方直落到底的。
 *
 * <p><b>页名叫「能力地图」，但这一页没有能力地图。</b>一期该页的范围是需求 10.2 的
 * P3-1 讲师池列表 / P3-2 讲师详情 / P3-3 试讲台账 三块；讲师层级、能力标签、熟练度
 * 随二期上线（N6、需求 10.1）。文档 8 的区域表也只有这三块，没有第四个区域。
 *
 * <p>字段口径与 V2.0 表面文字的出入逐条写在 {@link file://./../../fixtures/lecturer.ts} 头注里。
 * 核心三条：试讲结论只有 合格／不合格、讲师没有「信誉度」这个字段、成长建议属二期。
 */
export function LecturerV2Page() {
  return (
    <div className="lct v2-page">
      <KpiRow />

      <div className="lct-main">
        <div className="lct-left">
          <FilterBar />
          <PoolPanel />
          <LedgerPanel />
        </div>
        <DetailPanel />
      </div>
    </div>
  );
}

const KPI_ICONS: Record<string, LucideIcon> = {
  Users,
  BadgeCheck,
  MonitorPlay,
  Star,
};

/**
 * R3 四张 KPI：252,64,1150,112。
 *
 * <p>1150 只在回归模式下写死。正文宽是 1310，其余三个区域（812 + 17 + 481）正好铺满，
 * 只有这一行短 160px —— 设计图上右上角确实是白的。产品模式拉满，理由见 CSS。
 *
 * <p>四个图标底板<b>统一用品牌浅蓝</b>。设计图第四张是玫红底的星，而 WV4 规定四个语义色
 * 不得出现在装饰图形里：一屏之内玫红底板与红灯同时出现时，两者的意思完全不同。
 */
function KpiRow() {
  return (
    <section className="lct-kpis" data-region="R3" aria-label="讲师指标概览">
      {LECTURER_KPIS.map((kpi) => {
        const Icon = KPI_ICONS[kpi.icon]!;
        return (
          <article className="lct-kpi" key={kpi.id} data-testid="lecturer-kpi" data-kpi={kpi.id}>
            <div className="lct-kpi-text">
              <p className="lct-kpi-label">{kpi.label}</p>
              <p className="lct-kpi-value">
                {kpi.value}
                {'unit' in kpi && <span className="lct-kpi-unit">{kpi.unit}</span>}
              </p>
              <p className="lct-kpi-delta">
                {kpi.delta}
                <span className="lct-kpi-period">较上月</span>
              </p>
            </div>
            <span className="lct-kpi-plate" aria-hidden>
              <Icon size={22} />
            </span>
          </article>
        );
      })}
    </section>
  );
}

/**
 * R4 筛选器：252,203,812,45。
 *
 * <p>45px 装的是「字段名 + 控件」两层：16 + 28 = 44。四个下拉各带字段名，
 * 搜索框与日期范围没有 —— 它们的 placeholder 已经说明了自己是什么。
 */
function FilterBar() {
  return (
    <section className="lct-filters" data-region="R4" aria-label="讲师筛选">
      <div className="lct-search">
        <Search size={14} color={colorV2.textTertiary} aria-hidden />
        <input type="search" placeholder="搜索讲师姓名 / 擅长领域" aria-label="搜索讲师" />
      </div>

      {LECTURER_FILTERS.map((filter) => (
        <label className="lct-field" key={filter.id} data-testid="lecturer-filter">
          <span className="lct-field-label">{filter.label}</span>
          <span className="lct-select">
            <span>{filter.value}</span>
            <ChevronDown size={14} color={colorV2.textTertiary} aria-hidden />
          </span>
        </label>
      ))}

      <label className="lct-field lct-field-date">
        <span className="lct-field-label">日期</span>
        <span className="lct-select">
          <span className="lct-select-placeholder">选择日期范围</span>
          <ChevronDown size={14} color={colorV2.textTertiary} aria-hidden />
        </span>
      </label>
    </section>
  );
}

/** R5 讲师池：252,264,812,484 */
function PoolPanel() {
  return (
    <section className="panel lct-pool" data-region="R5" aria-label="讲师池">
      <div className="panel-head lct-pool-head">
        <h2 className="panel-title lct-sub-title">讲师池</h2>
        <span className="lct-pool-total">共 {LECTURER_POOL_TOTAL} 人</span>

        <span className="lct-pager">
          <button type="button" aria-label="上一页">
            <ChevronLeft size={14} color={colorV2.textTertiary} aria-hidden />
          </button>
          <button type="button" aria-label="下一页">
            <ChevronRight size={14} color={colorV2.textTertiary} aria-hidden />
          </button>
        </span>
        <a className="panel-action" href="/lecturers">
          查看全部
          <ChevronRight size={14} aria-hidden />
        </a>
      </div>

      <div className="lct-pool-body">
        {LECTURER_GROUPS.map((group) => (
          <PoolGroup key={group.id} group={group} />
        ))}
      </div>
    </section>
  );
}

/**
 * 按擅长领域分组。文档 8：默认展开人工智能基础与大模型应用，数据分析与可视化折叠。
 *
 * <p>分组依据是讲师字段 5「擅长领域」（多选枚举，作战单元字典）。一个讲师可以出现在
 * 多个组里 —— 所以<b>各组人数之和大于池子人数</b>是正常的，不要为了对上而去重。
 */
function PoolGroup({ group }: { group: LecturerGroup }) {
  const Chevron = group.expanded ? ChevronUp : ChevronDown;

  return (
    <div className="lct-group" data-testid="lecturer-group" data-group={group.id} data-expanded={group.expanded}>
      <header className="lct-group-head">
        <Chevron size={14} color={colorV2.brandAction} aria-hidden />
        <span className="lct-group-name">{group.domain}</span>
        <span className="lct-group-count">{group.count} 人</span>
      </header>

      {group.expanded && (
        <div className="lct-cards">
          {group.cards.map((card) => (
            <LecturerCardView key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

function LecturerCardView({ card }: { card: LecturerCard }) {
  const selected = card.id === LECTURER_SELECTED_ID;

  return (
    <article
      className="lct-card"
      data-testid="lecturer-card"
      data-lecturer={card.id}
      data-selected={selected}
      // 15 组件矩阵：Card selected 用 aria-current，不是 aria-selected
      aria-current={selected ? 'true' : undefined}
    >
      <div className="lct-card-top">
        <Avatar name={card.name} size={40} />
        <div className="lct-card-identity">
          <p className="lct-card-name">{card.name}</p>
          <p className="lct-card-dept" title={card.dept}>
            {card.dept}
          </p>
        </div>
      </div>

      <div className="lct-card-domains">
        {card.domains.map((domain) => (
          <span className="lct-tag" key={domain}>
            {domain}
          </span>
        ))}
      </div>

      <dl className="lct-card-metrics">
        {/* 试讲合格标记是布尔字段（需求 10.3 字段 9），不是状态 —— 所以是勾／叉而不是标签 */}
        <div className="lct-metric" data-metric="trialQualified">
          <dt>试讲合格</dt>
          <dd>
            {card.trialQualified ? (
              <CircleCheck size={14} color={colorV2.success} aria-label="是" />
            ) : (
              <CircleX size={14} color={colorV2.textTertiary} aria-label="否" />
            )}
            {card.cultivationStatus && <span className="lct-badge-warn">{card.cultivationStatus}</span>}
          </dd>
        </div>

        <div className="lct-metric" data-metric="teachingCount">
          <dt>授课次数</dt>
          <dd>{card.teachingCount}</dd>
        </div>

        <div className="lct-metric" data-metric="avgScore">
          <dt>学员评分</dt>
          <dd>{card.avgScore}</dd>
        </div>

        <div className="lct-metric lct-metric-bar" data-metric="attendees">
          <dt>学员人次</dt>
          <dd>
            <span
              className="lct-bar"
              role="progressbar"
              aria-valuenow={card.attendees}
              aria-valuemin={0}
              aria-valuemax={ATTENDEE_SCALE}
              aria-label={`${card.name}累计学员人次`}
            >
              <span
                className="lct-bar-fill"
                style={{ width: `${Math.round((card.attendees / ATTENDEE_SCALE) * 100)}%` }}
              />
            </span>
            <span className="lct-bar-value">{card.attendees.toLocaleString('en-US')}</span>
          </dd>
        </div>
      </dl>
    </article>
  );
}

/**
 * R6 试讲台账：252,778,812,178。
 *
 * <p>八列列宽 200+90+85+105+105+90+90+47 = 812，与区域宽严丝合缝 —— 文档 8 标注
 * 「必须照抄」，而这组数<b>自己是自洽的</b>（P03 的看板那组差 10px）。因此表格左右不留内边距。
 */
function LedgerPanel() {
  return (
    <section className="panel lct-ledger" data-region="R6" aria-label="试讲台账">
      <div className="panel-head lct-ledger-head">
        <h2 className="panel-title lct-sub-title">试讲台账</h2>
        <span className="panel-note">（最近 5 条）</span>
        <a className="panel-action" href="/reviews">
          查看全部台账
          <ChevronRight size={14} aria-hidden />
        </a>
      </div>

      <table className="lct-table">
        <colgroup>
          {TRIAL_LEDGER_COLUMNS.map((column) => (
            <col key={column.id} style={{ width: `${column.width}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {TRIAL_LEDGER_COLUMNS.map((column) => (
              <th key={column.id} scope="col" data-column={column.id}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TRIAL_LEDGER.map((row) => {
            /*
             * 「结论一致」由两列算出来，不从 fixture 读第三个字段。
             * 存成第三列时会出现「两列写着不合格／合格、第三列写着一致」的自相矛盾数据，
             * 而需求 5.6 要的只是一个<b>标记</b>，不是一份持久化的冗余布尔。
             */
            const consistent = row.lecturerConclusion === row.courseConclusion;
            return (
              <tr key={row.id} data-testid="ledger-row" data-consistent={consistent}>
                <td className="lct-cell-course" title={row.course}>
                  {row.course}
                </td>
                <td>{row.round}</td>
                <td>{row.lecturer}</td>
                <td>
                  <Conclusion value={row.lecturerConclusion} />
                </td>
                <td>
                  <Conclusion value={row.courseConclusion} />
                </td>
                <td>
                  <span className="lct-consistent">
                    {consistent ? (
                      <CircleCheck size={13} color={colorV2.success} aria-hidden />
                    ) : (
                      <CircleX size={13} color={colorV2.danger} aria-hidden />
                    )}
                    {consistent ? '一致' : '不一致'}
                  </span>
                </td>
                <td>{row.reviewedAt}</td>
                <td>
                  <a className="lct-link" href={`/courses?trial=${row.id}`}>
                    查看
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/**
 * 试讲结论。取值只有合格／不合格（转换表 5.6、需求 9.7.1）。
 *
 * <p>比较的那个词从 fixtures 取（{@link TRIAL_CONCLUSION_QUALIFIED}）而不是写在这里：
 * 页面里出现 {@code === '合格'} 就是 STK-1 要防的那件事 —— 后端改了结论用词，
 * 页面不报错，只是所有结论都按「不合格」着色。
 */
function Conclusion({ value }: { value: string }) {
  const positive = value === TRIAL_CONCLUSION_QUALIFIED;
  return (
    <span className="lct-conclusion" data-positive={positive}>
      {value}
    </span>
  );
}

/** R7 讲师详情：1081,203,481,753 */
function DetailPanel() {
  const selected = LECTURER_GROUPS.flatMap((group) => group.cards).find(
    (card) => card.id === LECTURER_SELECTED_ID,
  );

  return (
    <section className="panel lct-detail" data-region="R7" aria-label="讲师详情">
      <header className="lct-detail-head">
        <Avatar name={selected?.name ?? ''} size={56} />

        <div className="lct-detail-identity">
          <p className="lct-detail-name">
            {selected?.name}
            {selected?.trialQualified && <span className="lct-badge-ok">试讲合格</span>}
          </p>
          <p className="lct-detail-title">{LECTURER_DETAIL_TITLE}</p>
        </div>

        <button className="lct-detail-close" type="button" aria-label="关闭详情">
          <X size={16} color={colorV2.textTertiary} aria-hidden />
        </button>
      </header>

      <div className="lct-detail-domains">
        {LECTURER_DETAIL_DOMAINS.map((domain) => (
          <span className="lct-tag" key={domain}>
            {domain}
          </span>
        ))}
        {/* 折叠计数，不是第五个领域名 */}
        <span className="lct-tag lct-tag-more">+ {LECTURER_DETAIL_DOMAINS_MORE}</span>
      </div>

      <nav className="lct-tabs" aria-label="讲师详情页签">
        {LECTURER_DETAIL_TABS.map((tab, index) => (
          <button
            className="lct-tab"
            key={tab}
            type="button"
            data-testid="lecturer-tab"
            data-active={index === LECTURER_DETAIL_ACTIVE_TAB}
          >
            {tab}
          </button>
        ))}
      </nav>

      <TrialTimeline />
      <TeachingBlock />
      <GrowthAdvice />
    </section>
  );
}

/** 试讲记录时间线。三轮由新到旧，与试讲台账里李玥那条（第 3 轮 · 合格）对得上 */
function TrialTimeline() {
  return (
    <div className="lct-block lct-timeline" data-testid="trial-timeline">
      {TRIAL_TIMELINE.map((item) => {
        const positive = item.conclusion === TRIAL_CONCLUSION_QUALIFIED;
        return (
          <div className="lct-round" key={item.round} data-testid="trial-round" data-positive={positive}>
            <span className="lct-round-dot" aria-hidden />
            <div className="lct-round-body">
              <p className="lct-round-head">
                <span className="lct-round-no">
                  {item.round}（{item.conclusion}）
                </span>
                <span className="lct-round-date">{item.date}</span>
              </p>
              {/* 设计稿把这一行标成「结论」，但结论只有两个值，这段文字是专家意见 */}
              <p className="lct-round-line">专家意见：{item.opinion}</p>
              {/* 一期没有「评审人」字段，试讲记录上的是参与人 */}
              <p className="lct-round-line">参与人：{item.participants}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 近期授课记录。评分口径是「本场平均评分」（需求 10.5），不是讲师的平均评分 */
function TeachingBlock() {
  return (
    <div className="lct-block lct-teaching" data-testid="teaching-block">
      <h3 className="lct-block-title">近期授课记录</h3>

      <table className="lct-teaching-table">
        <thead>
          <tr>
            <th scope="col">课程名称</th>
            <th scope="col">场次</th>
            <th scope="col">授课日期</th>
            <th scope="col">本场评分</th>
          </tr>
        </thead>
        <tbody>
          {TEACHING_RECORDS.map((record) => (
            <tr key={record.session} data-testid="teaching-row">
              <td title={record.course}>{record.course}</td>
              <td>{record.session}</td>
              <td>{record.taughtOn}</td>
              <td>{record.score}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <a className="panel-action lct-teaching-more" href="/lecturers">
        查看全部授课记录
        <ChevronRight size={14} aria-hidden />
      </a>
    </div>
  );
}

/**
 * 讲师成长建议。<b>只在回归模式渲染。</b>
 *
 * <p>需求 N6 与 10.1：讲师能力评估与培养建议随二期上线。产品模式渲染出来就是
 * 「平台会给培养建议」的承诺，而它背后没有任何模型 —— 一期连能力标签都没有。
 * 保留回归模式是为了 R7 的 753px 版式能对上像素。裁决口径与 P06 的组织覆盖区（V-8）一致。
 */
function GrowthAdvice() {
  if (!isRegressionMode()) return null;

  return (
    <div className="lct-block lct-growth" data-testid="growth-advice">
      <h3 className="lct-block-title lct-growth-title">
        {GROWTH_ADVICE.title}
        <ChevronRight size={14} aria-hidden />
      </h3>

      <div className="lct-growth-body">
        <img className="lct-growth-art" src={ASSETS.A04} alt="" aria-hidden />
        <p className="lct-growth-text">{GROWTH_ADVICE.body}</p>
      </div>

      <button className="lct-growth-action" type="button">
        {GROWTH_ADVICE.action}
        <ChevronRight size={14} aria-hidden />
      </button>
    </div>
  );
}
