import { useState } from 'react';
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
import {
  TASK_COLUMNS,
  TASK_DEFAULT_TAB,
  TASK_DETAIL,
  TASK_FILTERS,
  TASK_KPIS,
  TASK_LIGHTS,
  TASK_ROWS,
  TASK_SELECTED_ID,
  TASK_TABS,
  TASK_WEEKLY_FOCUS,
  type TaskRow,
  type TaskTab,
} from '@/fixtures/task';
import './TaskV2Page.css';

/**
 * P07 任务中心（《设计文档 V2.0》第 11 章）。
 *
 * 逾期是任务的计算标记，不是状态：状态列只展示状态机四值，逾期信息单列呈现，
 * 避免运营把「逾期」误当成可执行的状态转换。
 */
export function TaskV2Page() {
  const [tab, setTab] = useState<TaskTab>(TASK_DEFAULT_TAB);
  const [selectedId, setSelectedId] = useState(TASK_SELECTED_ID);

  return (
    <div className="tsk v2-page">
      <TaskTabs tab={tab} onChange={setTab} />
      <KpiRow />
      <FilterBar />
      <TaskTable selectedId={selectedId} onSelect={setSelectedId} />
      <div className="tsk-bottom">
        <WeeklyFocus />
        <EmptyState />
      </div>
      <DetailPanel />
    </div>
  );
}

function TaskTabs({ tab, onChange }: { tab: TaskTab; onChange: (tab: TaskTab) => void }) {
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

function KpiRow() {
  return (
    <section className="tsk-kpis" data-region="R4" aria-label="任务指标概览">
      {TASK_KPIS.map((kpi) => {
        const Icon = KPI_ICONS[kpi.icon]!;
        return (
          <article className="tsk-kpi" key={kpi.id} data-testid="task-kpi" data-kpi={kpi.id}>
            <span className="tsk-kpi-icon" aria-hidden>
              <Icon size={18} strokeWidth={1.75} />
            </span>
            <div>
              <p className="tsk-kpi-label">{kpi.label}</p>
              <p className="tsk-kpi-value">{kpi.value}</p>
            </div>
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
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="panel tsk-table-panel" data-region="R6" aria-label="任务表格">
      <header className="tsk-table-head">
        <h2 className="panel-title">任务清单</h2>
        <span className="panel-count">1,268</span>
        <span className="tsk-table-note">当前展示 1-5 条</span>
      </header>
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
                {column.id === 'select' ? <input type="checkbox" aria-label="全选任务" /> : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TASK_ROWS.map((row) => (
            <TaskTableRow key={row.id} row={row} selected={row.id === selectedId} onSelect={onSelect} />
          ))}
        </tbody>
      </table>
      <footer className="tsk-pager">
        <span>1-5 / 共 1,268 条</span>
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
          </li>
        ))}
      </ol>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="panel tsk-empty" data-region="R8" aria-label="空状态">
      <img src={ASSETS.A13} alt="" aria-hidden />
      <div>
        <p>暂无需要关注的任务</p>
        <span>可手动新建任务，记录线下已确认的待办。</span>
      </div>
      <button type="button">
        <Plus size={14} aria-hidden />
        新建任务
      </button>
    </section>
  );
}

function DetailPanel() {
  return (
    <aside className="panel tsk-detail" data-region="R9" aria-label="任务详情">
      <header className="tsk-detail-head">
        <div>
          <p className="tsk-detail-id">{TASK_DETAIL.id}</p>
          <h2 data-testid="task-detail-title">{TASK_DETAIL.title}</h2>
        </div>
        <button type="button" aria-label="关闭详情">
          <X size={16} />
        </button>
      </header>
      <span className="tsk-state" data-state={TASK_DETAIL.state}>
        {TASK_DETAIL.state}
      </span>

      <dl className="tsk-detail-fields">
        {TASK_DETAIL.fields.map((field) => (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>

      <section className="tsk-description">
        <h3>任务说明</h3>
        <p>{TASK_DETAIL.description}</p>
      </section>

      <section className="tsk-comments" aria-label="任务评论">
        <h3>评论</h3>
        {TASK_DETAIL.comments.map((comment) => (
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
        ))}
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
