import { createContext, useCallback, useContext, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  CircleX,
  Search,
  Star,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Avatar } from '@/shared/ui/v2/Avatar';
import { AnimatedNumber } from '@/shared/ui/AnimatedNumber/AnimatedNumber';
import { useDialogMotion } from '@/shared/motion/useDialogMotion';
import { ASSETS, colorV2 } from '@/shared/theme/designTokensV2';
import { isRegressionMode } from '@/app/regressionMode';
import { registerShellCreate } from '@/app/shell/shellCreate';
import { message } from 'antd';
import { lecturerApi, type Lecturer } from '@/shared/api/lecturers';
import { useIsOperator } from '@/shared/store/authStore';
import { LecturerFormModal } from '@/features/lecturer/LecturerFormModal';
import { LecturerBasicInfo } from '@/features/lecturer/LecturerBasicInfo';
import { LecturerTabEdit } from '@/features/lecturer/LecturerTabEdit';
import { courseTrialHref, useFocusedId, useFocusSelection } from '@/shared/hooks/useFocusParam';
import {
  ATTENDEE_SCALE,
  GROWTH_ADVICE,
  LECTURER_DETAIL_ACTIVE_TAB,
  LECTURER_DETAIL_DOMAINS,
  LECTURER_DETAIL_DOMAINS_MORE,
  LECTURER_DETAIL_TABS,
  LECTURER_PRODUCT_TABS,
  LECTURER_CULTIVATION_STATES,
  LECTURER_DETAIL_TITLE,
  LECTURER_DOMAINS,
  LECTURER_DUTY_STATES,
  LECTURER_FILTERS,
  LECTURER_GROUPS,
  LECTURER_LEVELS,
  LECTURER_KPIS,
  LECTURER_POOL,
  LECTURER_SOURCE_DEPTS,
  LECTURER_SELECTED_ID,
  TEACHING_RECORDS,
  TRIAL_CONCLUSION_QUALIFIED,
  TRIAL_CONCLUSION_UNQUALIFIED,
  TRIAL_LEDGER,
  TRIAL_LEDGER_COLUMNS,
  TRIAL_LEDGER_PRODUCT_COLUMNS,
  trialLedgerYesNoOf,
  TRIAL_TIMELINE,
  lecturerArchiveOf,
  lecturerCertRecordsOf,
  lecturerFieldLogsOf,
  lecturerCultivationOf,
  lecturerCultivationRecordsOf,
  lecturerDutyTone,
  lecturerEvaluationsOf,
  lecturerIsReadyToTeach,
  lecturerLevelLogsOf,
  lecturerLevelOf,
  lecturerTeachingOf,
  lecturerTimelineOf,
  lecturerTitleOf,
  type LecturerCard,
  type LecturerDetailField,
  type LecturerGroup,
  type StudentEvaluation,
  type TeachingRecord,
  type TrialTimelineItem,
} from '@/fixtures/lecturer';
import { LECTURER_CERT_DISPLAY, lecturerCertDisplayOf } from '@/features/lecturer/lecturerDisplay';
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
 *
 * <p>产品模式对齐课程工作台：KPI 用「标签 + 色底板 + 大数字 + 月度环比」；点讲师卡
 * 右侧详情跟着换人；详情里每个字段可点开看完整取值。回归模式的 DOM 与几何不动。
 */

type LecturerKpiId = (typeof LECTURER_KPIS)[number]['id'];

interface FieldPeek {
  title: string;
  fields: LecturerDetailField[];
}

interface LecturerPoolFilters {
  query: string;
  dept: string;
  domain: string;
  trial: string;
  level: string;
  cultivation: string;
  cert: string;
  duty: string;
}

const EMPTY_POOL_FILTERS: LecturerPoolFilters = {
  query: '',
  dept: '',
  domain: '',
  trial: '',
  level: '',
  cultivation: '',
  cert: '',
  duty: '',
};

interface LecturerV2ContextValue {
  regression: boolean;
  selectedId: string;
  selectLecturer: (id: string) => void;
  kpiId: LecturerKpiId;
  setKpiId: (id: LecturerKpiId) => void;
  filters: LecturerPoolFilters;
  setFilter: <K extends keyof LecturerPoolFilters>(key: K, value: LecturerPoolFilters[K]) => void;
  peek: FieldPeek | null;
  openPeek: (peek: FieldPeek) => void;
  closePeek: () => void;
  requestEdit: (card: LecturerCard) => void;
}

const LecturerV2Context = createContext<LecturerV2ContextValue | null>(null);

function useLecturerV2(): LecturerV2ContextValue {
  const ctx = useContext(LecturerV2Context);
  if (!ctx) throw new Error('LecturerV2Context missing');
  return ctx;
}

export function LecturerV2Page() {
  const regression = isRegressionMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useFocusSelection(LECTURER_SELECTED_ID);
  const [kpiId, setKpiId] = useState<LecturerKpiId>('poolSize');
  const [filters, setFilters] = useState<LecturerPoolFilters>(EMPTY_POOL_FILTERS);
  const [peek, setPeek] = useState<FieldPeek | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTarget, setEditTarget] = useState<Lecturer | undefined>();

  const setFilter = useCallback(<K extends keyof LecturerPoolFilters>(key: K, value: LecturerPoolFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (regression) return;
    return registerShellCreate(() => setCreating(true));
  }, [regression]);

  const requestEdit = useCallback(async (card: LecturerCard) => {
    try {
      const page = await lecturerApi.page({ keyword: card.id }, 1, 20);
      const found = page.records.find((row) => row.lecturerNo === card.id);
      if (!found) {
        message.info('演示数据无法保存，请先「新建讲师」后再编辑');
        return;
      }
      setEditTarget(found);
      setEditing(true);
    } catch {
      message.info('演示数据无法保存，请先「新建讲师」后再编辑');
    }
  }, []);

  const value = useMemo<LecturerV2ContextValue>(
    () => ({
      regression,
      selectedId,
      selectLecturer: setSelectedId,
      kpiId,
      setKpiId,
      filters,
      setFilter,
      peek,
      openPeek: setPeek,
      closePeek: () => setPeek(null),
      requestEdit,
    }),
    [regression, selectedId, setSelectedId, kpiId, filters, setFilter, peek, requestEdit],
  );

  return (
    <LecturerV2Context.Provider value={value}>
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
        <FieldPeekModal />
        <LecturerFormModal
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            void queryClient.invalidateQueries({ queryKey: ['lecturers'] });
            navigate(`/lecturers/${id}`);
          }}
        />
        <LecturerFormModal
          open={editing}
          lecturer={editTarget}
          onClose={() => {
            setEditing(false);
            setEditTarget(undefined);
          }}
          onUpdated={() => {
            setEditing(false);
            setEditTarget(undefined);
            void queryClient.invalidateQueries({ queryKey: ['lecturers'] });
          }}
        />
      </div>
    </LecturerV2Context.Provider>
  );
}

const KPI_ICONS: Record<string, LucideIcon> = {
  Users,
  BadgeCheck,
  UserCheck,
  Star,
};

const KPI_TONES: Record<LecturerKpiId, string> = {
  poolSize: '#5B82FF',
  qualified: '#3FA9C9',
  readyToTeach: '#7C6CF0',
  avgScore: '#4E70DB',
};

const KPI_DELTA_BASELINE = '月度环比（较上月）';

/**
 * R3 四张 KPI：252,64,1150,112。
 *
 * <p>1150 只在回归模式下写死。正文宽是 1310，其余三个区域（812 + 17 + 481）正好铺满，
 * 只有这一行短 160px —— 设计图上右上角确实是白的。产品模式拉满，理由见 CSS。
 *
 * <p>回归模式四个图标底板<b>统一用品牌浅蓝</b>。设计图第四张是玫红底的星，而 WV4 规定
 * 四个语义色不得出现在装饰图形里。产品模式改成与课程工作台同一套：标签顶左、
 * 28px 色底板顶右、大数字、脚注「↑ n% 月度环比（较上月）」。
 */
function KpiRow() {
  const { regression, kpiId, setKpiId } = useLecturerV2();
  return (
    <section className="lct-kpis" data-region="R3" aria-label="讲师指标概览">
      {LECTURER_KPIS.map((kpi) => {
        const Icon = KPI_ICONS[kpi.icon]!;
        if (regression) {
          return (
            <article className="lct-kpi" key={kpi.id} data-testid="lecturer-kpi" data-kpi={kpi.id}>
              <div className="lct-kpi-text">
                <p className="lct-kpi-label">{kpi.label}</p>
                <p className="lct-kpi-value">
                  <AnimatedNumber value={kpi.value} duration={520} />
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
        }
        const tone = KPI_TONES[kpi.id];
        const selected = kpiId === kpi.id;
        return (
          <article
            className="lct-kpi"
            key={kpi.id}
            data-testid="lecturer-kpi"
            data-kpi={kpi.id}
            data-selected={selected ? 'true' : undefined}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            onClick={() => setKpiId(kpi.id)}
            onKeyDown={(event) => activateOnKey(event, () => setKpiId(kpi.id))}
          >
            <div className="lct-kpi-top">
              <p className="lct-kpi-label">{kpi.label}</p>
              <span className="lct-kpi-plate" style={{ color: tone, background: `${tone}33` }} aria-hidden>
                <Icon size={16} strokeWidth={1.8} />
              </span>
            </div>
            <p className="lct-kpi-value">
              <AnimatedNumber value={kpi.value} duration={520} />
              {'unit' in kpi && <span className="lct-kpi-unit">{kpi.unit}</span>}
            </p>
            <p className="lct-kpi-foot">
              <span className="lct-kpi-delta">{kpi.delta}</span>
              <span className="lct-kpi-baseline">{KPI_DELTA_BASELINE}</span>
            </p>
          </article>
        );
      })}
    </section>
  );
}

function activateOnKey(event: KeyboardEvent, action: () => void): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  action();
}

/**
 * R4 筛选器：252,203,812,45。
 *
 * <p>回归模式钉死「搜索 + 四下拉 + 日期」，45px 装的是「字段名 + 控件」两层。
 * 产品模式换成七个筛选项 + 按讲师ID／姓名搜索，控件真过滤，行高放开可换行。
 */
function FilterBar() {
  const { regression } = useLecturerV2();
  return regression ? <RegressionFilterBar /> : <ProductFilterBar />;
}

function RegressionFilterBar() {
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

function ProductFilterBar() {
  const { filters, setFilter } = useLecturerV2();
  return (
    <section className="lct-filters" data-region="R4" aria-label="讲师筛选">
      <div className="lct-search">
        <Search size={14} color={colorV2.textTertiary} aria-hidden />
        <input
          type="search"
          placeholder="搜索ID / 姓名"
          aria-label="搜索讲师"
          value={filters.query}
          onChange={(event) => setFilter('query', event.target.value)}
        />
      </div>

      <ProductFilterField
        id="sourceDept"
        label="来源部门"
        value={filters.dept}
        options={LECTURER_SOURCE_DEPTS}
        onChange={(value) => setFilter('dept', value)}
      />
      <ProductFilterField
        id="expertise"
        label="擅长领域"
        value={filters.domain}
        options={LECTURER_DOMAINS}
        onChange={(value) => setFilter('domain', value)}
      />
      <ProductFilterField
        id="trial"
        label="试讲情况"
        value={filters.trial}
        options={[TRIAL_CONCLUSION_QUALIFIED, TRIAL_CONCLUSION_UNQUALIFIED]}
        onChange={(value) => setFilter('trial', value)}
      />
      <ProductFilterField
        id="level"
        label="讲师等级"
        value={filters.level}
        options={LECTURER_LEVELS}
        onChange={(value) => setFilter('level', value)}
      />
      <ProductFilterField
        id="cultivation"
        label="培养状态"
        value={filters.cultivation}
        options={LECTURER_CULTIVATION_STATES}
        onChange={(value) => setFilter('cultivation', value)}
      />
      <ProductFilterField
        id="cert"
        label="认证状态"
        value={filters.cert}
        options={LECTURER_CERT_DISPLAY}
        onChange={(value) => setFilter('cert', value)}
      />
      <ProductFilterField
        id="duty"
        label="上岗状态"
        value={filters.duty}
        options={LECTURER_DUTY_STATES}
        onChange={(value) => setFilter('duty', value)}
      />
    </section>
  );
}

function ProductFilterField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="lct-field" data-testid="lecturer-filter" data-filter={id}>
      <span className="lct-field-label">{label}</span>
      <span className="lct-select">
        <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">全部</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown size={14} color={colorV2.textTertiary} aria-hidden />
      </span>
    </label>
  );
}

function matchesKpi(card: LecturerCard, kpiId: LecturerKpiId): boolean {
  if (kpiId === 'qualified') return card.trialQualified;
  if (kpiId === 'readyToTeach') return lecturerIsReadyToTeach(card);
  return true;
}

function matchesPoolFilters(card: LecturerCard, filters: LecturerPoolFilters): boolean {
  const query = filters.query.trim().toLowerCase();
  if (query && !card.id.toLowerCase().includes(query) && !card.name.toLowerCase().includes(query)) {
    return false;
  }
  if (filters.dept && card.dept !== filters.dept) return false;
  if (filters.domain && !card.domains.includes(filters.domain)) return false;
  if (filters.trial) {
    const trial = card.trialQualified ? TRIAL_CONCLUSION_QUALIFIED : TRIAL_CONCLUSION_UNQUALIFIED;
    if (trial !== filters.trial) return false;
  }
  if (filters.level && lecturerLevelOf(card.teachingCount) !== filters.level) return false;
  if (filters.cultivation && lecturerCultivationOf(card) !== filters.cultivation) return false;
  if (filters.cert && lecturerCertDisplayOf(card.trialQualified, card.cultivationStatus) !== filters.cert) return false;
  if (filters.duty && lecturerArchiveOf(card).dutyState !== filters.duty) return false;
  return true;
}

function matchesVisibleCard(
  card: LecturerCard,
  kpiId: LecturerKpiId,
  filters: LecturerPoolFilters,
  regression: boolean,
): boolean {
  if (!matchesKpi(card, kpiId)) return false;
  return regression || matchesPoolFilters(card, filters);
}

/** R5 讲师池：252,264,812,484 */
function PoolPanel() {
  const { kpiId, filters, regression } = useLecturerV2();
  const visible = LECTURER_POOL.filter((card) => matchesVisibleCard(card, kpiId, filters, regression));
  const groups = LECTURER_GROUPS.map((group) => ({
    ...group,
    cards: group.cards.filter((card) => matchesVisibleCard(card, kpiId, filters, regression)),
  })).filter((group) => group.cards.length > 0);

  return (
    <section className="panel lct-pool" data-region="R5" aria-label="讲师池">
      <div className="panel-head lct-pool-head">
        <h2 className="panel-title lct-sub-title">讲师池</h2>
        <span className="lct-pool-total">共 {visible.length.toLocaleString('en-US')} 人</span>

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
        {regression ? (
          groups.map((group) => <PoolGroup key={group.id} group={group} />)
        ) : visible.length === 0 ? (
          <p className="lct-empty">没有符合条件的讲师</p>
        ) : (
          <div className="lct-cards">
            {visible.map((card) => (
              <LecturerCardView key={card.id} card={card} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * 按擅长领域分组。文档 8：默认展开人工智能基础与大模型应用，数据分析与可视化折叠。
 *
 * <p>分组依据是讲师字段 5「擅长领域」（多选枚举）。一个讲师只按第一个领域进一组，
 * 所以各组人数之和等于池子人数。
 */
function PoolGroup({ group }: { group: LecturerGroup }) {
  const Chevron = group.expanded ? ChevronUp : ChevronDown;

  return (
    <div className="lct-group" data-testid="lecturer-group" data-group={group.id} data-expanded={group.expanded}>
      <header className="lct-group-head">
        <Chevron size={14} color={colorV2.brandAction} aria-hidden />
        <span className="lct-group-name">{group.domain}</span>
        <span className="lct-group-count">{group.cards.length} 人</span>
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
  const { regression, selectedId, selectLecturer } = useLecturerV2();
  const focused = useFocusedId(LECTURER_SELECTED_ID);
  const selected = card.id === (regression ? focused : selectedId);

  return (
    <article
      className="lct-card"
      data-testid="lecturer-card"
      data-lecturer={card.id}
      data-selected={selected}
      aria-current={selected ? 'true' : undefined}
      role={regression ? undefined : 'button'}
      tabIndex={regression ? undefined : 0}
      onClick={regression ? undefined : () => selectLecturer(card.id)}
      onKeyDown={regression ? undefined : (event) => activateOnKey(event, () => selectLecturer(card.id))}
    >
      {regression ? <RegressionCardBody card={card} /> : <ProductCardBody card={card} />}
    </article>
  );
}

/** 回归模式卡面：头像／姓名／部门／领域／四行指标。几何由 p04 钉死，不要改。 */
function RegressionCardBody({ card }: { card: LecturerCard }) {
  return (
    <>
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
    </>
  );
}

/**
 * 产品模式卡面：头像、ID、姓名、部门、等级、领域、试讲、上岗、
 * 培养、认证展示、综合评分。授课次数／人次进详情。
 *
 * <p>认证三值只是卡上的展示，由试讲合格与培养状态推出，不落库、没有认证流程
 * （一期禁区 F-1）。培养状态是真字段。
 */
function ProductCardBody({ card }: { card: LecturerCard }) {
  const archive = lecturerArchiveOf(card);
  const trial = card.trialQualified ? TRIAL_CONCLUSION_QUALIFIED : TRIAL_CONCLUSION_UNQUALIFIED;
  const cert = lecturerCertDisplayOf(card.trialQualified, card.cultivationStatus);
  return (
    <>
      <div className="lct-card-top">
        <Avatar name={card.name} size={40} />
        <div className="lct-card-identity">
          <p className="lct-card-name">
            <span className="lct-card-name-text">{card.name}</span>
            <span className="lct-card-level">{archive.lecturerLevel}</span>
          </p>
          <p className="lct-card-idline" title={`${card.id} · ${card.dept}`}>
            <span className="lct-card-id">{card.id}</span>
            <span className="lct-card-dept">{card.dept}</span>
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

      <div className="lct-card-status">
        <span className="lct-card-chip" data-tone={card.trialQualified ? 'ok' : 'muted'}>
          {trial}
        </span>
        <span className="lct-card-chip" data-tone={lecturerDutyTone(card)}>
          {archive.dutyState}
        </span>
      </div>

      <p className="lct-card-score">
        <span>培养状态</span>
        <span className="lct-card-score-value">{lecturerCultivationOf(card)}</span>
      </p>
      <p className="lct-card-score">
        <span>认证状态</span>
        <span className="lct-card-score-value">{cert}</span>
      </p>
      <p className="lct-card-score">
        <span>综合评分</span>
        <span className="lct-card-score-value">{card.avgScore} / 5</span>
      </p>
    </>
  );
}

/**
 * R6 试讲台账：252,778,812,178。
 *
 * <p>八列列宽 200+90+85+105+105+90+90+47 = 812，与区域宽严丝合缝 —— 文档 8 标注
 * 「必须照抄」，而这组数<b>自己是自洽的</b>（P03 的看板那组差 10px）。因此表格左右不留内边距。
 */
function LedgerPanel() {
  const { regression, selectLecturer } = useLecturerV2();
  const location = useLocation();
  const columns = regression ? TRIAL_LEDGER_COLUMNS : TRIAL_LEDGER_PRODUCT_COLUMNS;

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
          {columns.map((column) => (
            <col key={column.id} style={{ width: `${column.width}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} scope="col" data-column={column.id}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TRIAL_LEDGER.map((row) => {
            const consistent = row.lecturerConclusion === row.courseConclusion;
            const lecturer = LECTURER_POOL.find((card) => card.name === row.lecturer);
            return (
              <tr key={row.id} data-testid="ledger-row" data-consistent={consistent}>
                <td className="lct-cell-course" title={row.course}>
                  {row.course}
                </td>
                <td>{row.round}</td>
                <td>
                  {regression || !lecturer ? (
                    row.lecturer
                  ) : (
                    <button
                      className="lct-link-btn"
                      type="button"
                      onClick={() => selectLecturer(lecturer.id)}
                    >
                      {row.lecturer}
                    </button>
                  )}
                </td>
                <td>
                  <Conclusion value={row.lecturerConclusion} yesNo={!regression} />
                </td>
                <td>
                  <Conclusion value={row.courseConclusion} yesNo={!regression} />
                </td>
                {regression ? (
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
                ) : null}
                <td>{row.reviewedAt}</td>
                <td>
                  {regression ? (
                    <a className="lct-link" href={`/courses?trial=${row.id}`}>
                      查看
                    </a>
                  ) : (
                    <a className="lct-link" href={courseTrialHref(row.course, location.search)}>
                      查看
                    </a>
                  )}
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
function Conclusion({ value, yesNo }: { value: string; yesNo?: boolean }) {
  const positive = value === TRIAL_CONCLUSION_QUALIFIED;
  return (
    <span className="lct-conclusion" data-positive={positive}>
      {yesNo ? trialLedgerYesNoOf(value) : value}
    </span>
  );
}

function selectedCardOf(selectedId: string): LecturerCard | undefined {
  return (
    LECTURER_POOL.find((card) => card.id === selectedId) ??
    LECTURER_POOL.find((card) => card.id === LECTURER_SELECTED_ID)
  );
}

/** R7 讲师详情：1081,203,481,753 */
function DetailPanel() {
  const { regression, selectedId, selectLecturer } = useLecturerV2();
  const focusedId = useFocusedId(LECTURER_SELECTED_ID);
  const cards = LECTURER_GROUPS.flatMap((group) => group.cards);
  const selected = regression
    ? (cards.find((card) => card.id === focusedId) ?? cards.find((card) => card.id === LECTURER_SELECTED_ID))
    : selectedCardOf(selectedId);
  const tabs = regression ? LECTURER_DETAIL_TABS : LECTURER_PRODUCT_TABS;
  const [activeTab, setActiveTab] = useState<string>(
    regression ? LECTURER_DETAIL_TABS[LECTURER_DETAIL_ACTIVE_TAB]! : LECTURER_PRODUCT_TABS[0],
  );

  useEffect(() => {
    if (!regression) setActiveTab(LECTURER_PRODUCT_TABS[0]);
  }, [selectedId, regression]);

  const title = regression ? LECTURER_DETAIL_TITLE : lecturerTitleOf(selected?.name ?? '');
  const domains = regression ? LECTURER_DETAIL_DOMAINS : (selected?.domains ?? []);

  return (
    <section className="panel lct-detail" data-region="R7" aria-label="讲师详情">
      <header className="lct-detail-head">
        <Avatar name={selected?.name ?? ''} size={56} />
        <div className="lct-detail-identity">
          <p className="lct-detail-name">
            {selected?.name}
            {selected?.trialQualified && <span className="lct-badge-ok">试讲合格</span>}
          </p>
          <p className="lct-detail-title">{title}</p>
        </div>

        <button
          className="lct-detail-close"
          type="button"
          aria-label="关闭详情"
          onClick={() => {
            if (!regression) selectLecturer(LECTURER_SELECTED_ID);
          }}
        >
          <X size={16} color={colorV2.textTertiary} aria-hidden />
        </button>
      </header>

      <div className="lct-detail-domains">
        {domains.map((domain) => (
          <span className="lct-tag" key={domain}>
            {domain}
          </span>
        ))}
        {regression && <span className="lct-tag lct-tag-more">+ {LECTURER_DETAIL_DOMAINS_MORE}</span>}
      </div>

      <nav className="lct-tabs" aria-label="讲师详情页签">
        {tabs.map((tab, index) => (
          <button
            className="lct-tab"
            key={tab}
            type="button"
            data-testid="lecturer-tab"
            data-active={regression ? index === LECTURER_DETAIL_ACTIVE_TAB : tab === activeTab}
            onClick={regression ? undefined : () => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {regression ? (
        <>
          <TrialTimeline items={TRIAL_TIMELINE} />
          <TeachingBlock records={TEACHING_RECORDS} />
          <GrowthAdvice />
        </>
      ) : (
        selected && <LiveDetailBody tab={activeTab} card={selected} />
      )}
    </section>
  );
}

function LiveDetailBody({ tab, card }: { tab: string; card: LecturerCard }) {
  const { requestEdit } = useLecturerV2();
  const isOperator = useIsOperator();
  return (
    <>
      {isOperator && <LecturerTabEdit onEdit={() => requestEdit(card)} />}
      {tab === '基本信息' ? <BasicInfoBlock card={card} /> : null}
      {tab === '试讲记录' ? <TrialTimeline items={lecturerTimelineOf(card)} /> : null}
      {tab === '培养计划与培养记录' ? <CultivationBlock card={card} /> : null}
      {tab === '认证记录' ? <CertRecordBlock card={card} /> : null}
      {tab === '等级变更记录' ? <LevelLogBlock card={card} /> : null}
      {tab === '授课记录与学员反馈' ? (
        <>
          <TeachingBlock records={lecturerTeachingOf(card)} card={card} />
          <EvaluationBlock items={lecturerEvaluationsOf(card)} />
        </>
      ) : null}
      {tab === '状态流转日志' ? <StateLogBlock card={card} /> : null}
    </>
  );
}

function CultivationBlock({ card }: { card: LecturerCard }) {
  const records = lecturerCultivationRecordsOf(card);
  const archive = lecturerArchiveOf(card);
  return (
    <div className="lct-block" data-testid="cultivation-block">
      <h3 className="lct-block-title">培养计划与培养记录</h3>
      <p className="lct-record-now">
        <span>讲师ID</span>
        <strong>{archive.lecturerNo}</strong>
      </p>
      <p className="lct-record-now">
        <span>讲师姓名</span>
        <strong>{archive.name}</strong>
      </p>
      {records.length === 0 ? (
        <p className="lct-empty">只记录培养结果，不做培养计划引擎。暂无培养计划与培养记录。</p>
      ) : (
        records.map((row, index) => (
          <dl className="lct-profile-grid" key={`${row.planState}-${index}`}>
            <div className="lct-profile-field">
              <dt>培养计划</dt>
              <dd>{row.planText || '—'}</dd>
            </div>
            <div className="lct-profile-field">
              <dt>计划培养周期</dt>
              <dd>
                {row.plannedFrom} 至 {row.plannedTo}
              </dd>
            </div>
            <div className="lct-profile-field">
              <dt>培养类型</dt>
              <dd>{row.cultivationTypes.join('、') || '—'}</dd>
            </div>
            <div className="lct-profile-field">
              <dt>培养记录</dt>
              <dd>{row.recordText || '—'}</dd>
            </div>
            <div className="lct-profile-field">
              <dt>实际培养周期</dt>
              <dd>
                {row.actualFrom} 至 {row.actualTo}
              </dd>
            </div>
            <div className="lct-profile-field">
              <dt>培养状态</dt>
              <dd>{row.planState}</dd>
            </div>
            <div className="lct-profile-field" data-span="full">
              <dt>培养评价</dt>
              <dd>{row.evaluation || '—'}</dd>
            </div>
            <div className="lct-profile-field" data-span="full">
              <dt>备注</dt>
              <dd>{row.remark || '—'}</dd>
            </div>
          </dl>
        ))
      )}
    </div>
  );
}

function CertRecordBlock({ card }: { card: LecturerCard }) {
  const records = lecturerCertRecordsOf(card);
  const archive = lecturerArchiveOf(card);
  return (
    <div className="lct-block" data-testid="cert-block">
      <h3 className="lct-block-title">认证记录</h3>
      <p className="lct-record-now">
        <span>讲师ID</span>
        <strong>{archive.lecturerNo}</strong>
      </p>
      <p className="lct-record-now">
        <span>讲师姓名</span>
        <strong>{archive.name}</strong>
      </p>
      <p className="lct-record-now">
        <span>当前认证状态</span>
        <strong>{lecturerCertDisplayOf(card.trialQualified, card.cultivationStatus)}</strong>
      </p>
      {records.length === 0 ? (
        <p className="lct-empty">只记录认证结果，不做认证审批。暂无认证记录。</p>
      ) : (
        records.map((row, index) => (
          <dl className="lct-profile-grid" key={`${row.certBatch}-${index}`}>
            <div className="lct-profile-field">
              <dt>认证批次</dt>
              <dd>{row.certBatch || '—'}</dd>
            </div>
            <div className="lct-profile-field">
              <dt>讲师等级</dt>
              <dd>{row.lecturerLevel || '—'}</dd>
            </div>
            <div className="lct-profile-field">
              <dt>认证状态</dt>
              <dd>{row.certState}</dd>
            </div>
            <div className="lct-profile-field">
              <dt>认证通过时间</dt>
              <dd>{row.passedOn || '—'}</dd>
            </div>
            <div className="lct-profile-field" data-span="full">
              <dt>评审人</dt>
              <dd>{row.reviewers || '—'}</dd>
            </div>
            <div className="lct-profile-field" data-span="full">
              <dt>认证意见</dt>
              <dd>{row.opinion || '—'}</dd>
            </div>
            <div className="lct-profile-field" data-span="full">
              <dt>认证有效期</dt>
              <dd>
                {row.validFrom} 至 {row.validTo}
              </dd>
            </div>
          </dl>
        ))
      )}
    </div>
  );
}

function LevelLogBlock({ card }: { card: LecturerCard }) {
  const records = lecturerLevelLogsOf(card);
  const archive = lecturerArchiveOf(card);
  return (
    <div className="lct-block" data-testid="level-log-block">
      <h3 className="lct-block-title">等级变更记录</h3>
      <p className="lct-record-now">
        <span>讲师ID</span>
        <strong>{archive.lecturerNo}</strong>
      </p>
      <p className="lct-record-now">
        <span>讲师姓名</span>
        <strong>{archive.name}</strong>
      </p>
      <p className="lct-record-now">
        <span>当前等级</span>
        <strong>{lecturerLevelOf(card.teachingCount)}</strong>
      </p>
      {records.length === 0 ? (
        <p className="lct-empty">只记录等级变更结果，不做评估模型。暂无等级变更记录。</p>
      ) : (
        records.map((row) => (
          <dl className="lct-profile-grid" key={row.changeNo}>
            <div className="lct-profile-field">
              <dt>变更记录编号</dt>
              <dd>{row.changeNo}</dd>
            </div>
            <div className="lct-profile-field">
              <dt>变更后等级</dt>
              <dd>{row.levelAfter}</dd>
            </div>
            <div className="lct-profile-field" data-span="full">
              <dt>变更触发原因</dt>
              <dd>{row.triggerReason || '—'}</dd>
            </div>
            <div className="lct-profile-field" data-span="full">
              <dt>等级变更说明</dt>
              <dd>{row.changeDesc || '—'}</dd>
            </div>
            <div className="lct-profile-field">
              <dt>等级变更时间</dt>
              <dd>{row.changedOn || '—'}</dd>
            </div>
            <div className="lct-profile-field">
              <dt>评审人</dt>
              <dd>{row.reviewer || '—'}</dd>
            </div>
            <div className="lct-profile-field" data-span="full">
              <dt>评审意见</dt>
              <dd>{row.reviewComment || '—'}</dd>
            </div>
            <div className="lct-profile-field">
              <dt>记录创建人</dt>
              <dd>{row.createdBy || '—'}</dd>
            </div>
            <div className="lct-profile-field">
              <dt>记录更新时间</dt>
              <dd>{row.updatedAt || '—'}</dd>
            </div>
          </dl>
        ))
      )}
    </div>
  );
}

function StateLogBlock({ card }: { card: LecturerCard }) {
  const items = lecturerFieldLogsOf(card);
  return (
    <div className="lct-block" data-testid="state-log-block">
      <h3 className="lct-block-title">状态流转日志</h3>
      <p className="lct-record-now">
        <span>讲师ID</span>
        <strong>{card.id}</strong>
      </p>
      <p className="lct-record-now">
        <span>讲师姓名</span>
        <strong>{card.name}</strong>
      </p>
      {items.length === 0 ? (
        <p className="lct-empty">档案字段改值自动留痕，不是状态机。还没有状态变更记录。</p>
      ) : (
        <ol className="lct-state-list">
          {items.map((row, index) => (
            <li className="lct-state-row" key={`${row.operatedAt}-${row.fieldName}-${index}`}>
              <p className="lct-state-when">{row.operatedAt}</p>
              <p className="lct-state-change">{`【${row.fieldName}】由 [${row.oldValue}] 变更为 [${row.newValue}]`}</p>
              <p className="lct-state-who">操作人：{row.operator}</p>
              <p className="lct-state-note">关联备注：{row.remark || '无'}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function BasicInfoBlock({ card }: { card: LecturerCard }) {
  return <LecturerBasicInfo profile={lecturerArchiveOf(card)} />;
}

function TrialTimeline({ items }: { items: TrialTimelineItem[] }) {
  const { regression } = useLecturerV2();
  return (
    <div className="lct-block lct-timeline" data-testid="trial-timeline">
      {items.map((item) => {
        const positive = item.conclusion === TRIAL_CONCLUSION_QUALIFIED;
        const body = regression ? (
          <>
            <span className="lct-round-dot" aria-hidden />
            <div className="lct-round-body">
              <p className="lct-round-head">
                <span className="lct-round-no">
                  {item.round}（{item.conclusion}）
                </span>
                <span className="lct-round-date">{item.date}</span>
              </p>
              <p className="lct-round-line">专家意见：{item.opinion}</p>
              <p className="lct-round-line">参与人：{item.participants}</p>
            </div>
          </>
        ) : (
          <>
            <span className="lct-round-dot" aria-hidden />
            <div className="lct-round-body">
              <p className="lct-round-head">
                <span className="lct-round-no">{item.round}</span>
                <span className="lct-round-date">{item.date}</span>
              </p>
              <p className="lct-round-line">试讲结果：{item.conclusion}</p>
              <p className="lct-round-line">课程名称：{item.courseName || '—'}</p>
              <p className="lct-round-line">整体满意度：{item.satisfaction || '—'}</p>
              <p className="lct-round-line">优化建议：{item.optimizeAdvice || '—'}</p>
              <p className="lct-round-line">试讲时间：{item.date}</p>
            </div>
          </>
        );
        return (
          <div className="lct-round" key={item.round} data-testid="trial-round" data-positive={positive}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

function TeachingBlock({ records, card }: { records: TeachingRecord[]; card?: LecturerCard }) {
  const [allOpen, setAllOpen] = useState(false);
  return (
    <div className="lct-block lct-teaching" data-testid="teaching-block">
      <h3 className="lct-block-title">近期授课记录</h3>

      {card ? (
        <>
          <p className="lct-record-now">
            <span>讲师ID</span>
            <strong>{card.id}</strong>
          </p>
          <p className="lct-record-now">
            <span>讲师姓名</span>
            <strong>{card.name}</strong>
          </p>
        </>
      ) : null}

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
          {records.map((record) => (
            <tr key={record.session} data-testid="teaching-row">
              <td title={record.course}>{record.course}</td>
              <td>{record.session}</td>
              <td>{record.taughtOn}</td>
              <td>{record.score}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {records.length === 0 && <p className="lct-empty">暂无授课记录</p>}

      {card && allOpen
        ? records.map((record) => (
            <dl className="lct-profile-grid" key={`${record.session}-extra`} data-testid="teaching-extra">
              <div className="lct-profile-field">
                <dt>课程名称</dt>
                <dd>{record.course}</dd>
              </div>
              <div className="lct-profile-field">
                <dt>授课类型</dt>
                <dd>{record.trainingForm || '—'}</dd>
              </div>
              <div className="lct-profile-field">
                <dt>综合评分</dt>
                <dd>{record.score} / 5</dd>
              </div>
              <div className="lct-profile-field">
                <dt>记录创建人</dt>
                <dd>{record.createdBy || '—'}</dd>
              </div>
              <div className="lct-profile-field">
                <dt>记录更新时间</dt>
                <dd>{record.updatedAt || '—'}</dd>
              </div>
            </dl>
          ))
        : null}

      {card ? (
        <button
          className="panel-action lct-teaching-more"
          type="button"
          onClick={() => setAllOpen((open) => !open)}
        >
          {allOpen ? '收起授课记录' : '查看全部授课记录'}
          <ChevronRight size={14} aria-hidden />
        </button>
      ) : (
        <a className="panel-action lct-teaching-more" href="/lecturers">
          查看全部授课记录
          <ChevronRight size={14} aria-hidden />
        </a>
      )}
    </div>
  );
}

function EvaluationBlock({ items }: { items: StudentEvaluation[] }) {
  return (
    <div className="lct-block lct-evals" data-testid="evaluation-block">
      <h3 className="lct-block-title">学员评价</h3>
      {items.length === 0 ? (
        <p className="lct-empty">暂无学员评价</p>
      ) : (
        items.map((item) => (
          <div className="lct-eval" key={`${item.student}-${item.session}`}>
            <p className="lct-eval-head">
              <span>{item.student}</span>
              <span>{item.score} / 5</span>
            </p>
            <p className="lct-eval-body">{item.comment}</p>
          </div>
        ))
      )}
    </div>
  );
}

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

function FieldPeekModal() {
  const { peek, closePeek } = useLecturerV2();
  const { closing, requestClose } = useDialogMotion(closePeek);

  useEffect(() => {
    if (!peek) return undefined;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [peek, requestClose]);

  if (!peek) return null;

  return (
    <div className="crs-modal-mask" data-closing={closing} role="presentation" onClick={requestClose}>
      <div
        className="lct-peek"
        role="dialog"
        aria-modal="true"
        aria-label={peek.title}
        data-testid="lecturer-field-peek"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="crs-modal-close" type="button" aria-label="关闭字段详情" onClick={requestClose}>
          <X size={16} aria-hidden />
        </button>
        <h2 className="lct-peek-title">{peek.title}</h2>
        <dl className="lct-peek-fields">
          {peek.fields.map((field) => (
            <div className="lct-peek-row" key={field.label}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

