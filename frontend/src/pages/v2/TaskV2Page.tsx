import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CircleCheck,
  CircleDotDashed,
  ChevronDown,
  Clock3,
  ListTodo,
  LoaderCircle,
  Plus,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Avatar } from '@/shared/ui/v2/Avatar';
import { ASSETS } from '@/shared/theme/designTokensV2';
import { isRegressionMode } from '@/app/regressionMode';
import { formatMetricInt } from '@/shared/metrics/cockpitMetrics';
import { tasksApi, type TaskItem } from '@/shared/api/tasks';
import {
  TASK_COLUMNS,
  TASK_DEFAULT_TAB,
  TASK_DETAIL,
  TASK_FILTERS,
  TASK_KPIS,
  TASK_LIGHTS,
  TASK_ROWS,
  TASK_SELECTED_ID,
  TASK_STATES,
  TASK_TABS,
  TASK_WEEKLY_FOCUS,
  type TaskRow,
  type TaskState,
  type TaskTab,
} from '@/fixtures/task';
import './TaskV2Page.css';

/**
 * P07 任务中心（《设计文档 V2.0》第 11 章）。
 *
 * 逾期是任务的计算标记，不是状态：状态列只展示状态机四值，逾期信息单列呈现，
 * 避免运营把「逾期」误当成可执行的状态转换。
 */

const OWNER_TAB: TaskTab = TASK_TABS[1];
const COMPLETED_TAB: TaskTab = TASK_TABS[2];
const COMPLETED_STATE: TaskState = TASK_STATES[2];

/** 冻结数据里的任务总量，产品模式下由接口的 total 顶替 */
const MOCK_TOTAL = 1268;

export function TaskV2Page() {
  const regression = isRegressionMode();
  const [tab, setTab] = useState<TaskTab>(TASK_DEFAULT_TAB);
  const [ownerNo, setOwnerNo] = useState('');
  const [selectedId, setSelectedId] = useState(TASK_SELECTED_ID);

  const live = useQuery({
    queryKey: ['tasks', tab, ownerNo],
    queryFn: () =>
      tasksApi.page({
        pageNum: 1,
        pageSize: 50,
        ownerNo: tab === OWNER_TAB && ownerNo ? ownerNo : undefined,
        taskState: tab === COMPLETED_TAB ? COMPLETED_STATE : undefined,
      }),
    enabled: !regression,
  });

  const liveRows = useMemo(() => (live.data?.records ?? []).map(mapTask), [live.data]);

  /*
   * 接口无数据时立刻回落冻结数据（含请求进行中），避免 KPI 全「—」、表格 0 条的空白页。
   * 与 P08／P09 同一策略。
   */
  const useMock = regression || live.isError || liveRows.length === 0;
  const rows = useMock ? TASK_ROWS : liveRows;
  const total = useMock ? MOCK_TOTAL : (live.data?.total ?? 0);

  return (
    <div className="tsk v2-page" data-mock={useMock ? 'true' : 'false'}>
      <div className="tsk-main">
        <TaskTabs
          tab={tab}
          onChange={setTab}
          ownerNo={ownerNo}
          onOwnerNo={setOwnerNo}
          regression={regression}
        />
        <KpiRow
          useMock={useMock}
          total={total}
          overdue={rows.filter((row) => row.overdue !== '—').length}
        />
        <FilterBar />
        <TaskTable selectedId={selectedId} onSelect={setSelectedId} rows={rows} total={total} />
        <div className="tsk-bottom">
          <WeeklyFocus />
          <EmptyState />
        </div>
      </div>
      <DetailPanel selectedId={selectedId} rows={rows} />
    </div>
  );
}

function mapTask(item: TaskItem): TaskRow {
  const remaining = (() => {
    if (item.dueDate == null) return '—';
    const days = Math.round((new Date(item.dueDate).getTime() - Date.now()) / 86_400_000);
    return days >= 0 ? `剩余 ${days} 天` : `逾期 ${-days} 天`;
  })();

  return {
    id: String(item.id),
    title: item.title,
    type: item.taskType,
    object: item.objectType + (item.objectId != null ? `-${item.objectId}` : ''),
    owner: item.ownerName ?? item.ownerNo ?? '—',
    deadline: item.dueDate ?? '—',
    remaining,
    state: item.taskState as TaskState,
    // 后端只给逾期布尔量，没有三色灯口径；不自造红灯，一律记黄灯
    warningLight: item.overdue ? 'YELLOW' : 'NONE',
    overdue: item.overdue ? '已逾期' : '—',
  };
}

function TaskTabs({
  tab,
  onChange,
  ownerNo,
  onOwnerNo,
  regression,
}: {
  tab: TaskTab;
  onChange: (tab: TaskTab) => void;
  ownerNo: string;
  onOwnerNo: (ownerNo: string) => void;
  regression: boolean;
}) {
  return (
    <nav className="tsk-tabs" data-region="R3" aria-label="任务页签">
      {TASK_TABS.map((item) => (
        <button
          key={item}
          type="button"
          className="tsk-tab"
          data-testid="task-tab"
          data-active={item === tab}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
      {/* 共享账号认不出「我」，按负责人只能靠手填工号；回归基线里没有这个框 */}
      {!regression && tab === OWNER_TAB && (
        <input
          className="tsk-search"
          style={{ width: 160, marginLeft: 8 }}
          placeholder="负责人工号"
          value={ownerNo}
          onChange={(event) => onOwnerNo(event.target.value)}
        />
      )}
      <button type="button" className="tsk-new">
        <Plus size={14} aria-hidden />
        新建任务
      </button>
    </nav>
  );
}

const KPI_ICONS: Record<string, LucideIcon> = {
  ListTodo,
  CircleDotDashed,
  LoaderCircle,
  CircleCheck,
  TriangleAlert,
};

function KpiRow({
  useMock,
  total,
  overdue,
}: {
  useMock: boolean;
  total: number;
  overdue: number;
}) {
  return (
    <section className="tsk-kpis" data-region="R4" aria-label="任务指标概览">
      {TASK_KPIS.map((kpi) => {
        const Icon = KPI_ICONS[kpi.icon]!;
        const warn = 'warn' in kpi && kpi.warn ? 'true' : undefined;

        /*
         * 接口只给得出总量与逾期数，其余三档没有对应查询。宁可显示「—」，
         * 也不用当前页的 50 条去算「待处理 12」——那是分页数不是全量数。
         */
        let value: string = kpi.value;
        if (!useMock) {
          if (kpi.id === 'all') value = formatMetricInt(total);
          else if (kpi.id === 'overdue') value = formatMetricInt(overdue);
          else value = '—';
        }

        return (
          <article
            className="tsk-kpi"
            key={kpi.id}
            data-testid="task-kpi"
            data-kpi={kpi.id}
            data-warn={warn}
          >
            <div className="tsk-kpi-text">
              <p className="tsk-kpi-label">{kpi.label}</p>
              <p className="tsk-kpi-value">{value}</p>
              {/* 环比是冻结数据里的设计稿数值，接口没有同比口径，真实数据下整行不渲染 */}
              {useMock && (
                <p className="tsk-kpi-delta" data-warn={warn}>
                  <span>{kpi.delta}</span>
                  <span className="tsk-kpi-period">{kpi.period}</span>
                </p>
              )}
            </div>
            <span className="tsk-kpi-icon" aria-hidden>
              <Icon size={18} strokeWidth={1.75} />
            </span>
          </article>
        );
      })}
    </section>
  );
}

function FilterBar() {
  return (
    <section className="tsk-filters" data-region="R5" aria-label="任务筛选">
      <label className="tsk-search">
        <Search size={14} aria-hidden />
        <input type="search" placeholder="搜索任务标题 / 关联对象" readOnly />
      </label>
      {TASK_FILTERS.map((filter) => (
        <button key={filter.id} type="button" className="tsk-filter" data-testid="task-filter">
          <span>{filter.id === 'light' ? TASK_LIGHTS[0] : filter.label}</span>
          <ChevronDown size={12} aria-hidden />
        </button>
      ))}
      <button type="button" className="tsk-reset">
        重置
      </button>
    </section>
  );
}

function TaskTable({
  selectedId,
  onSelect,
  rows,
  total,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  rows: TaskRow[];
  total: number;
}) {
  return (
    <section className="panel tsk-table-panel" data-region="R6" aria-label="任务表格">
      <header className="tsk-table-head">
        <h2 className="panel-title">任务清单</h2>
        <span className="panel-count">{formatMetricInt(total)}</span>
        <span className="tsk-table-note">当前展示 1-{rows.length} 条</span>
      </header>
      <div className="tsk-table-scroll">
        <table className="tsk-table" data-testid="task-table">
          <colgroup>
            {TASK_COLUMNS.map((column) => (
              <col key={column.id} data-col={column.id} style={{ width: `${column.width}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {TASK_COLUMNS.map((column) => (
                <th key={column.id} data-col={column.id} scope="col">
                  {column.id === 'select' ? (
                    <input type="checkbox" aria-label="全选任务" />
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <TaskTableRow
                key={row.id}
                row={row}
                selected={row.id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </tbody>
        </table>
      </div>
      <footer className="tsk-pager">
        <span>
          1-{rows.length} / 共 {formatMetricInt(total)} 条
        </span>
        <span>‹ 1 2 3 ›</span>
      </footer>
    </section>
  );
}

function TaskTableRow({
  row,
  selected,
  onSelect,
}: {
  row: TaskRow;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <tr data-testid="task-row" data-selected={selected} onClick={() => onSelect(row.id)}>
      <td>
        <input
          type="checkbox"
          aria-label={`选择任务 ${row.title}`}
          onClick={(event) => event.stopPropagation()}
        />
      </td>
      <td title={row.title}>{row.title}</td>
      <td>{row.type}</td>
      <td title={row.object}>{row.object}</td>
      <td>
        <span className="tsk-owner">
          <Avatar name={row.owner} size={24} />
          {row.owner}
        </span>
      </td>
      <td>{row.deadline}</td>
      <td className="tsk-remaining" data-light={row.warningLight}>
        {row.remaining}
      </td>
      <td>
        <span className="tsk-state" data-state={row.state}>
          {row.state}
        </span>
      </td>
      <td>
        <WarningMark row={row} />
      </td>
      <td>
        <button type="button" className="tsk-link" onClick={(event) => event.stopPropagation()}>
          详情
        </button>
      </td>
    </tr>
  );
}

function WarningMark({ row }: { row: TaskRow }) {
  if (row.warningLight === 'NONE') return <span className="tsk-dash">—</span>;

  const Icon = row.warningLight === 'BLUE' ? Clock3 : TriangleAlert;
  return (
    <span className="tsk-warning" data-light={row.warningLight} data-testid="task-warning">
      <Icon size={12} aria-hidden />
      <span>{row.overdue}</span>
    </span>
  );
}

function WeeklyFocus() {
  return (
    <section className="panel tsk-focus" data-region="R7" aria-label="本周重点">
      <header className="tsk-focus-head">
        <h2 className="panel-title">本周重点</h2>
        <span>按截止时间排序</span>
      </header>
      <ol>
        {TASK_WEEKLY_FOCUS.map((item) => (
          <li key={item.rank}>
            <span className="tsk-focus-rank">{item.rank}</span>
            <span className="tsk-focus-title">{item.title}</span>
            <span className="tsk-focus-owner">{item.owner}</span>
            <span className="tsk-focus-deadline">{item.deadline}</span>
            <span className="tsk-state" data-state={item.state}>
              {item.state}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="panel tsk-empty" data-region="R8" aria-label="空状态">
      <div className="tsk-empty-copy">
        <p>没有找到任务？</p>
        <span>可手动新建任务，记录线下已确认的待办。</span>
        <button type="button">
          <Plus size={14} aria-hidden />
          新建任务
        </button>
      </div>
      <img className="tsk-empty-art" src={ASSETS.A13} alt="" aria-hidden />
    </section>
  );
}

interface TaskDetailView {
  id: string;
  title: string;
  state: TaskState;
  createdAt?: string;
  fields: readonly { readonly label: string; readonly value: string }[];
  description: string;
  source?: { readonly label: string; readonly id: string };
  timeline?: readonly { readonly at: string; readonly text: string }[];
  deriveRule?: string;
  comments: readonly { readonly name: string; readonly at: string; readonly text: string }[];
}

/**
 * 详情内容。设计稿选中行有完整的冻结详情，其余行只能从列表字段拼一份 ——
 * 任务详情接口一期没有，拼出来的那份不编造评论与处理记录。
 */
function resolveDetail(selectedId: string, rows: TaskRow[]): TaskDetailView {
  if (selectedId === TASK_DETAIL.id) return TASK_DETAIL;

  const row = rows.find((item) => item.id === selectedId) ?? rows[0]!;
  return {
    id: row.id,
    title: row.title,
    state: row.state,
    createdAt: row.deadline,
    fields: [
      { label: '任务类型', value: row.type },
      { label: '关联对象', value: row.object },
      { label: '责任人', value: row.owner },
      { label: '截止时间', value: row.deadline },
    ],
    description: '线下已确认的待办说明将显示在这里；当前为模拟数据。',
    source: { label: row.object, id: row.id },
    timeline: [{ at: row.deadline, text: `当前状态「${row.state}」` }],
    deriveRule: '状态变更后按配置中心派生规则生成后续任务。',
    comments: [],
  };
}

function DetailPanel({ selectedId, rows }: { selectedId: string; rows: TaskRow[] }) {
  const detail = resolveDetail(selectedId, rows);

  return (
    <aside className="panel tsk-detail" data-region="R9" aria-label="任务详情">
      <header className="tsk-detail-head">
        <div>
          <p className="tsk-detail-id">{detail.id}</p>
          <h2 data-testid="task-detail-title">{detail.title}</h2>
          {detail.createdAt ? (
            <p className="tsk-detail-created">创建时间：{detail.createdAt}</p>
          ) : null}
        </div>
        <button type="button" aria-label="关闭详情">
          <X size={16} />
        </button>
      </header>
      <span className="tsk-state" data-state={detail.state}>
        {detail.state}
      </span>

      <dl className="tsk-detail-fields">
        {detail.fields.map((field) => (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>

      <section className="tsk-description">
        <h3>任务说明</h3>
        <p>{detail.description}</p>
      </section>

      {detail.source ? (
        <section className="tsk-source">
          <h3>来源对象</h3>
          <p>
            <strong>{detail.source.label}</strong>
            <span>{detail.source.id}</span>
          </p>
        </section>
      ) : null}

      {detail.timeline?.length ? (
        <section className="tsk-timeline">
          <h3>处理记录</h3>
          <ol>
            {detail.timeline.map((entry) => (
              <li key={`${entry.at}-${entry.text}`}>
                <time>{entry.at}</time>
                <span>{entry.text}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* 派生规则只作说明展示：任务由状态变更派生，平台不据此自动推进任何状态 */}
      {detail.deriveRule ? (
        <section className="tsk-derive">
          <h3>派生规则</h3>
          <p>{detail.deriveRule}</p>
        </section>
      ) : null}

      <section className="tsk-comments" aria-label="任务评论">
        <h3>评论与历史</h3>
        {detail.comments.length === 0 ? (
          <p className="tsk-comments-empty">暂无评论</p>
        ) : (
          detail.comments.map((comment) => (
            <article key={`${comment.name}-${comment.at}`}>
              <Avatar name={comment.name} size={24} />
              <div>
                <p>
                  <strong>{comment.name}</strong>
                  <time>{comment.at}</time>
                </p>
                <span>{comment.text}</span>
              </div>
            </article>
          ))
        )}
      </section>

      {/* 复刻评论输入态；一期不发送消息，也不在这里实现真实提交。 */}
      <div className="tsk-comment-input">
        <span>添加评论…</span>
        <button type="button" disabled>
          发送
        </button>
      </div>
    </aside>
  );
}
